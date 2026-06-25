// app/(admin)/work-orders/[id]/edit/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useParams } from "next/navigation";
import {
  WorkOrder,
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderPhoto,
  Milestone,
  BudgetItem
} from "@/types/work-order";

export default function EditWorkOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const woId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [woData, setWoData] = useState<WorkOrder | null>(null);

  // Basic info
  const [woType, setWoType] = useState<WorkOrderType>("urgent");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("medium");
  const [assignedToDept, setAssignedToDept] = useState("");
  const [assignedToUser, setAssignedToUser] = useState("");
  const [tags, setTags] = useState("");

  // SLA (for Urgent)
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  // Milestones (for Project)
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");

  // Budget (for Project)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [estimatedBudget, setEstimatedBudget] = useState(0);
  const [newBudgetDesc, setNewBudgetDesc] = useState("");
  const [newBudgetQty, setNewBudgetQty] = useState(1);
  const [newBudgetPrice, setNewBudgetPrice] = useState(0);

  // Users for assignee dropdown
  const [users, setUsers] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Extract unique departments from users
  const departments = useMemo(() => {
    const depts = new Set(
      users
        .map(u => u.department)
        .filter(d => d && d.trim() !== "")
    );
    return Array.from(depts).sort();
  }, [users]);

  useEffect(() => {
    if (woId && user) {
      loadData();
    }
  }, [woId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      // 1. Load users
      const q = query(collection(db, "users"), orderBy("name"));
      const snap = await getDocs(q);
      const userList: any[] = [];
      snap.forEach(doc => {
        userList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(userList);

      // 2. Load WO
      const docRef = doc(db, "work_orders", woId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError("Work Order tidak ditemukan.");
        setLoading(false);
        return;
      }

      const data = { id: docSnap.id, ...docSnap.data() } as WorkOrder;
      
      // Check permissions
      // Cannot edit if completed
      if (data.status === "completed") {
        setError("Work Order yang sudah selesai tidak dapat diedit.");
        setLoading(false);
        return;
      }

      // Only owner, admin, or current approver can edit
      const isAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";
      const isOwner = data.createdBy === user?.uid;
      const isCurrentApprover = data.status === "pending_approval" && data.approvalSteps && data.currentApprovalStep !== undefined && data.currentApprovalStep < data.approvalSteps.length && data.approvalSteps[data.currentApprovalStep].approverId === user?.uid;
      
      if (!isAdmin && !isOwner && !isCurrentApprover) {
        setError("Anda tidak memiliki akses untuk mengedit Work Order ini.");
        setLoading(false);
        return;
      }

      setWoData(data);
      
      // Populate form
      setWoType(data.type);
      setTitle(data.title);
      setDescription(data.description || "");
      setPriority(data.priority);
      setAssignedToDept(data.assignedToDept || "");
      setAssignedToUser(data.assignedToUser || "");
      setTags(data.tags ? data.tags.join(", ") : "");

      if (data.type === "urgent" && data.sla) {
        setDueDate(data.sla.dueDate || "");
        setDueTime(data.sla.dueTime || "");
      } else if (data.type === "project") {
        setMilestones(data.milestones || []);
        setBudgetItems(data.budget || []);
        setEstimatedBudget(data.estimatedBudget || 0);
      }

    } catch (err) {
      console.error("Error loading data:", err);
      setError("Gagal memuat data Work Order.");
    } finally {
      setLoading(false);
    }
  };

  const addMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    setMilestones(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      title: newMilestoneTitle,
      description: "",
      dueDate: newMilestoneDue,
      status: "pending"
    }]);
    setNewMilestoneTitle("");
    setNewMilestoneDue("");
  };

  const removeMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const addBudgetItem = () => {
    if (!newBudgetDesc.trim() || newBudgetQty <= 0 || newBudgetPrice <= 0) return;
    const estimatedCost = newBudgetQty * newBudgetPrice;
    setBudgetItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      description: newBudgetDesc,
      category: assignedToDept || "General",
      qty: newBudgetQty,
      unitPrice: newBudgetPrice,
      estimatedCost: estimatedCost,
      actualCost: 0
    }]);
    setEstimatedBudget(prev => prev + estimatedCost);
    setNewBudgetDesc("");
    setNewBudgetQty(1);
    setNewBudgetPrice(0);
  };

  const removeBudgetItem = (id: string) => {
    const item = budgetItems.find(b => b.id === id);
    if (item) setEstimatedBudget(prev => prev - item.estimatedCost);
    setBudgetItems(prev => prev.filter(b => b.id !== id));
  };

  const getUsersByDept = () => {
    if (!assignedToDept) return [];
    return users.filter(u => u.department === assignedToDept);
  };

  const handleSubmit = async () => {
    if (!user || !woData) return;

    if (!title.trim()) {
      setError("Judul tidak boleh kosong");
      return;
    }
    if (!assignedToDept) {
      setError("Pilih departemen tujuan");
      return;
    }
    if (woType === "urgent" && (!dueDate || !dueTime)) {
      setError("SLA (tanggal & waktu deadline) wajib diisi untuk WO Urgent");
      return;
    }
    if (woType === "project" && milestones.length === 0) {
      setError("Minimal 1 milestone untuk WO Project");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const assigneeUser = users.find(u => u.id === assignedToUser);
      
      const updateData: any = {
        title,
        description,
        priority,
        assignedToDept,
        assignedToUser: assignedToUser || null,
        assignedToUserName: assigneeUser?.name || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        updatedAt: new Date(),
        updatedBy: user.uid,
        updatedByName: user.name
      };

      // Create an update history entry
      const historyEntry = {
        id: Math.random().toString(36).substr(2, 9),
        text: "Memperbarui detail Work Order",
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: new Date()
      };
      updateData.updateHistory = [...(woData.updateHistory || []), historyEntry];

      // Type-specific fields
      if (woType === "urgent") {
        let slaHours = 0;
        if (dueDate && dueTime) {
          const dueDateTime = new Date(`${dueDate}T${dueTime}`);
          const now = new Date();
          slaHours = Math.max(0, Math.round((dueDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)));
        }
        updateData.sla = {
          ...woData.sla,
          dueDate,
          dueTime,
          slaHours
        };
      } else {
        updateData.milestones = milestones;
        updateData.budget = budgetItems;
        updateData.estimatedBudget = estimatedBudget;
      }

      const docRef = doc(db, "work_orders", woId);
      await updateDoc(docRef, updateData);

      alert("✅ Work Order berhasil diperbarui!");
      router.push(`/work-orders/${woId}`);
    } catch (err) {
      console.error("Error updating WO:", err);
      setError("Gagal memperbarui Work Order: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="manage_work_orders">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </ProtectedRoute>
    );
  }

  // If there's an error and we don't have data, just show the error
  if (error && !woData) {
    return (
      <ProtectedRoute requiredFeature="manage_work_orders">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-white rounded-lg border shadow-sm"
            >
              Kembali
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredFeature="manage_work_orders">
      <div className="w-full space-y-8 px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Edit Work Order</h1>
            </div>
            <p className="text-sm text-slate-500 font-mono mt-1">{woData?.woNumber}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="rounded-xl bg-white p-5 shadow-md border">
          <h2 className="font-bold text-lg mb-4">📝 Detail Work Order</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Judul *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
                placeholder="Judul Work Order..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Deskripsi</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border rounded-lg px-4 py-3"
                placeholder="Deskripsi detail Work Order..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as WorkOrderPriority)}
                  className="w-full border rounded-lg px-4 py-3"
                >
                  <option value="low">🟢 Low - Rendah</option>
                  <option value="medium">🟡 Medium - Sedang</option>
                  <option value="high">🟠 High - Tinggi</option>
                  {woType === "urgent" && <option value="critical">🔴 Critical - Kritis</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Tags (pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="maintenance, safety, urgent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Departemen Tujuan *</label>
              <select
                value={assignedToDept}
                onChange={e => {
                  setAssignedToDept(e.target.value);
                  setAssignedToUser("");
                }}
                className="w-full border rounded-lg px-4 py-3"
              >
                <option value="">-- Pilih Departemen --</option>
                {departments.length === 0 ? (
                  <option value="" disabled>Tidak ada departemen di database</option>
                ) : (
                  departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Assignee (Opsional)</label>
              <select
                value={assignedToUser}
                onChange={e => setAssignedToUser(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
                disabled={!assignedToDept}
              >
                <option value="">-- Pilih Staff (Opsional) --</option>
                {getUsersByDept().map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.jabatan || u.role})</option>
                ))}
              </select>
              {!assignedToDept && (
                <p className="text-xs text-gray-400 mt-1">Pilih departemen dulu</p>
              )}
            </div>
          </div>
        </div>

        {/* SLA Section (Urgent) */}
        {woType === "urgent" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-red-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <span>SLA (Service Level Agreement)</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Tanggal Deadline *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Waktu Deadline *</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>
            </div>
          </div>
        )}

        {/* Milestones Section (Project) */}
        {woType === "project" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-purple-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">🏁</span>
              <span>Milestones</span>
            </h2>
            
            {/* Existing milestones */}
            {milestones.length > 0 && (
              <div className="space-y-2 mb-4">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{m.title}</p>
                      {m.dueDate && (
                        <p className="text-xs text-gray-500">Due: {new Date(m.dueDate).toLocaleDateString("id-ID")}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMilestone(m.id)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add milestone */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestoneTitle}
                onChange={e => setNewMilestoneTitle(e.target.value)}
                placeholder="Judul milestone..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={newMilestoneDue}
                onChange={e => setNewMilestoneDue(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addMilestone}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"
              >
                ➕
              </button>
            </div>
          </div>
        )}

        {/* Budget Section (Project) */}
        {woType === "project" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-purple-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span>Budget</span>
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Total Estimated Budget (Rp)</label>
              <div className="w-full border rounded-lg px-4 py-3 bg-gray-50 text-gray-700 font-bold">
                Rp {estimatedBudget.toLocaleString("id-ID")}
              </div>
            </div>

            {/* Budget items */}
            <div className="space-y-2 mb-4">
              {budgetItems.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{b.description}</p>
                    <p className="text-xs text-gray-500">{b.qty} x Rp {(b.unitPrice || 0).toLocaleString("id-ID")} = Rp {b.estimatedCost.toLocaleString("id-ID")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBudgetItem(b.id)}
                    className="p-1 text-red-500 hover:bg-red-100 rounded"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            {/* Add budget item */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={newBudgetDesc}
                onChange={e => setNewBudgetDesc(e.target.value)}
                placeholder="Nama Barang / Kebutuhan..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newBudgetQty || ""}
                  onChange={e => setNewBudgetQty(Number(e.target.value))}
                  placeholder="Qty"
                  className="w-20 border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={newBudgetPrice || ""}
                  onChange={e => setNewBudgetPrice(Number(e.target.value))}
                  placeholder="Harga Satuan (Rp)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addBudgetItem}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-40 md:pl-64">
          <div className="w-full flex justify-end gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
            >
               Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>💾 Simpan Perubahan</>
              )}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
