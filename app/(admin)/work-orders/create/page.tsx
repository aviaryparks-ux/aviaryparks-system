// app/(admin)/work-orders/create/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, getDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useSearchParams } from "next/navigation";
import {
  WorkOrderType,
  WorkOrderPriority,
  generateWONumber,
  defaultApprovalSteps,
  WorkOrderPhoto,
  Milestone,
  BudgetItem,
  WOInventoryTemplate,
  WOArea
} from "@/types/work-order";

export default function CreateWorkOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Basic info
  const [woType, setWoType] = useState<WorkOrderType>("urgent");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(searchParams?.get("desc") || "");
  const [priority, setPriority] = useState<WorkOrderPriority>("medium");
  const [assignedToDept, setAssignedToDept] = useState(searchParams?.get("dept") || "");
  const [assignedToDivision, setAssignedToDivision] = useState("");
  const [assignedToUser, setAssignedToUser] = useState("");
  const [tags, setTags] = useState("");
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  // Area & Inventory (New)
  const [template, setTemplate] = useState<WOInventoryTemplate | null>(null);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [isManualItem, setIsManualItem] = useState(false);
  const [manualItemName, setManualItemName] = useState("");

  // SLA (for Urgent)
  const [responseDueDate, setResponseDueDate] = useState("");
  const [responseDueTime, setResponseDueTime] = useState("");
  const [resolutionDueDate, setResolutionDueDate] = useState("");
  const [resolutionDueTime, setResolutionDueTime] = useState("");

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

  // Approvers (for Project)
  const [approvers, setApprovers] = useState<{ role: string; name: string; uid: string }[]>([]);
  const [newApproverRole, setNewApproverRole] = useState("");
  const [selectedApproverId, setSelectedApproverId] = useState("");

  // Photos
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);

  // Users for assignee dropdown
  const [users, setUsers] = useState<any[]>([]);

  // Extract unique divisions from users based on selected department
  const divisions = useMemo(() => {
    if (!assignedToDept) return [];
    const divs = new Set(
      users
        .filter(u => u.department === assignedToDept && u.division)
        .map(u => u.division)
    );
    return Array.from(divs).sort();
  }, [users, assignedToDept]);

  // Extract unique departments from users
  const departments = useMemo(() => {
    const depts = new Set(
      users
        .map(u => u.department)
        .filter(d => d && d.trim() !== "")
    );
    return Array.from(depts).sort();
  }, [users]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showIMPreview, setShowIMPreview] = useState(false);

  useEffect(() => {
    loadUsers();
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const docRef = doc(db, "wo_inventory_templates", "default");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTemplate(docSnap.data() as WOInventoryTemplate);
      }
    } catch (err) {
      console.error("Error loading template:", err);
    }
  };

  const loadUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("name"));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setUsers(list);
    } catch (err) {
      console.error("Error loading users:", err);
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

  const addApprover = () => {
    if (!newApproverRole.trim() || !selectedApproverId) return;
    const usr = users.find(u => u.id === selectedApproverId);
    if (!usr) return;
    setApprovers(prev => [...prev, { role: newApproverRole, name: usr.name, uid: usr.id }]);
    setNewApproverRole("");
    setSelectedApproverId("");
  };

  const removeApprover = (idx: number) => {
    setApprovers(prev => prev.filter((_, i) => i !== idx));
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
    if (!user) return;

    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!title.trim()) {
      showError("Judul tidak boleh kosong");
      return;
    }
    if (!assignedToDept) {
      showError("Pilih departemen tujuan");
      return;
    }
    if (!photoFile) {
      showError("Mohon upload foto bukti terlebih dahulu");
      return;
    }
    if (!selectedArea) {
      showError("Mohon pilih atau isi Lokasi / Area");
      return;
    }
    if (template && template.areas.length > 0) {
      if (!selectedItem && !isManualItem) {
        showError("Mohon pilih Barang Inventory");
        return;
      }
      if (isManualItem && !manualItemName) {
        showError("Mohon isi nama barang (Manual)");
        return;
      }
    }
    if (woType === "urgent" && (!responseDueDate || !responseDueTime || !resolutionDueDate || !resolutionDueTime)) {
      showError("Batas Waktu Respons dan Batas Waktu Penyelesaian wajib diisi untuk WO Urgent");
      return;
    }
    if (woType === "project") {
      if (approvers.length === 0) {
        showError("Minimal 1 penyetuju (approver) harus ditambahkan untuk Project WO");
        return;
      }
      
      // Tampilkan Preview IM terlebih dahulu jika belum
      if (!showIMPreview) {
        setShowIMPreview(true);
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      // Upload photo if exists
      let uploadedPhotoUrl = "";
      if (photoFile) {
        try {
          const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(photoFile, options);
          const fileName = `wo_${Date.now()}_${compressedFile.name}`;
          const storageRef = ref(storage, `work-orders/${fileName}`);
          const snapshot = await uploadBytes(storageRef, compressedFile);
          uploadedPhotoUrl = await getDownloadURL(snapshot.ref);
        } catch (error) {
          console.error("Error compressing/uploading image:", error);
          showError("Gagal memproses dan mengupload foto");
          setSaving(false);
          return;
        }
      }

      // Calculate SLA hours
      let slaHours = 0;
      if (woType === "urgent" && resolutionDueDate && resolutionDueTime) {
        const dueDateTime = new Date(`${resolutionDueDate}T${resolutionDueTime}`);
        const now = new Date();
        slaHours = Math.max(0, Math.round((dueDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)));
      }

      const woNumber = generateWONumber(woType, assignedToDept);
      const assigneeUser = users.find(u => u.id === assignedToUser);

      const data: any = {
        woNumber,
        title,
        description,
        type: woType,
        status: woType === "project" ? "pending_approval" : "open",
        priority,
        createdBy: user.uid,
        createdByName: user.name,
        createdByDept: user.department || "",
        createdAt: new Date(),
        assignedToDept,
        assignedToDivision: assignedToDivision || null,
        assignedToUser: assignedToUser || null,
        assignedToUserName: assigneeUser?.name || null,
        locationArea: selectedArea || null,
        inventoryItem: isManualItem ? manualItemName : selectedItem || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        photos: uploadedPhotoUrl ? [{
          id: Math.random().toString(36).substr(2, 9),
          url: uploadedPhotoUrl,
          caption: "Foto Bukti Laporan",
          uploadedBy: user.uid,
          uploadedByName: user.name,
          uploadedAt: new Date()
        }] : [],
        notes: "",
        updateHistory: [],
        updatedAt: new Date(),
        updatedBy: user.uid,
        updatedByName: user.name
      };

      // Type-specific fields
      if (woType === "urgent") {
        data.sla = {
          dueDate: resolutionDueDate, // backward compatible
          dueTime: resolutionDueTime, // backward compatible
          slaHours, // backward compatible
          isOverdue: false, // backward compatible
          responseDueDate,
          responseDueTime,
          resolutionDueDate,
          resolutionDueTime,
          totalPausedMinutes: 0
        };
      } else {
        // Project WO
        const steps = [
          {
            id: "step_0",
            step: 0,
            role: "Pemohon / Dibuat Oleh",
            approverId: user?.uid,
            approverName: user?.name,
            status: "approved",
            actionAt: new Date(),
            signatureUrl: user?.signatureUrl || "", // get signature from user profile if exists
          },
          ...approvers.map((a, i) => ({
          id: Math.random().toString(36).substr(2, 9),
          step: i + 1,
          role: a.role,
          approverName: a.name,
          approverId: a.uid,
          status: "pending",
          actionAt: null
        })),];

        data.milestones = milestones;
        data.budget = budgetItems;
        data.estimatedBudget = estimatedBudget;
        data.actualBudget = 0;
        data.approvalSteps = steps;
        data.currentApprovalStep = 1;
      }

      const docRef = await addDoc(collection(db, "work_orders"), data);

      if (isManualItem && manualItemName && template && selectedArea) {
        try {
          const areaIndex = template.areas.findIndex(a => a.name === selectedArea);
          if (areaIndex !== -1) {
            const existingItem = template.areas[areaIndex].items.find(
              i => i.name.toLowerCase() === manualItemName.toLowerCase()
            );
            
            if (!existingItem) {
              const updatedTemplate = { ...template };
              updatedTemplate.areas[areaIndex].items.push({
                id: Math.random().toString(36).substr(2, 9),
                name: manualItemName
              });
              
              const templateRef = doc(db, "wo_inventory_templates", "default");
              await updateDoc(templateRef, {
                areas: updatedTemplate.areas,
                updatedAt: new Date(),
                updatedBy: user.uid
              });
            }
          }
        } catch (templateErr) {
          console.error("Error updating template:", templateErr);
        }
      }

      if (woType === "project" && approvers.length > 0) {
        const firstApproverId = approvers[0].uid;
        await addDoc(collection(db, "notifications"), {
          userId: firstApproverId,
          title: "✍️ Permintaan Persetujuan Project",
          body: `${user.name} meminta persetujuan Anda untuk Internal Memo Project: ${title}`,
          type: "approval_request",
          data: {
            woId: docRef.id,
          },
          isRead: false,
          createdAt: new Date(),
        });
      }

      alert("✅ Work Order berhasil dibuat!");
      router.push("/work-orders");
    } catch (err) {
      console.error("Error creating WO:", err);
      showError("Gagal membuat Work Order: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (showIMPreview) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
        <div className="max-w-4xl mx-auto py-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Preview Internal Memo</h2>
              <button onClick={() => setShowIMPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300">
                ✕
              </button>
            </div>
            
            <div className="p-12 overflow-y-auto bg-white flex-1" style={{ fontFamily: "Arial, sans-serif" }}>
              <div className="text-center mb-8 flex flex-col items-center">
                <img src="/images/logo.png" alt="Aviary Park" className="w-48 mb-4 object-contain" />
                <h1 className="text-3xl font-black text-slate-800 tracking-wider">AVIARY PARK INDONESIA</h1>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em] mt-1">A Butterfly Sanctuary</p>
              </div>

              <h2 className="text-3xl font-bold text-slate-300 mb-8 border-b-2 border-slate-200 pb-4">INTEROFFICE MEMO</h2>

              <div className="grid grid-cols-[100px_10px_1fr] gap-y-3 text-sm font-medium text-slate-800 mb-8">
                <div>Dari</div><div>:</div><div className="uppercase">{user?.name}</div>
                <div>Kepada</div><div>:</div><div className="uppercase">{assignedToDept} {assignedToDivision ? `- ${assignedToDivision}` : ""}</div>
                <div>Tanggal</div><div>:</div><div>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
                <div>Perihal</div><div>:</div><div className="font-bold uppercase">{title}</div>
              </div>

              <div className="border-t border-slate-300 pt-6 min-h-[150px]">
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed mb-6">{description || "-"}</p>
                
                <p className="font-bold mb-2 text-slate-800">Rincian Estimasi Budget:</p>
                <table className="w-full text-sm border-collapse mb-4 border border-slate-300">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">Deskripsi</th>
                      <th className="border border-slate-300 p-2 text-center">Qty</th>
                      <th className="border border-slate-300 p-2 text-right">Harga Satuan</th>
                      <th className="border border-slate-300 p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItems.map(b => (
                      <tr key={b.id}>
                        <td className="border border-slate-300 p-2">{b.description}</td>
                        <td className="border border-slate-300 p-2 text-center">{b.qty}</td>
                        <td className="border border-slate-300 p-2 text-right">Rp {(b.unitPrice || 0).toLocaleString("id-ID")}</td>
                        <td className="border border-slate-300 p-2 text-right">Rp {b.estimatedCost.toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="border border-slate-300 p-2 text-right">Total Estimasi Budget</td>
                      <td className="border border-slate-300 p-2 text-right text-purple-700">Rp {estimatedBudget.toLocaleString("id-ID")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-16 flex justify-between px-10 gap-8">
                <div className="text-center w-48 flex flex-col justify-end h-40 relative">
                  <p className="text-sm font-medium mb-auto">Dibuat Oleh,</p>
                  {user?.signatureUrl ? (
                    <div className="h-20 w-full flex items-center justify-center relative">
                      <img src={user.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center"></div>
                  )}
                  <div className="border-t border-slate-800 pt-2 mt-2 w-full">
                    <p className="font-bold text-sm">{user?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{user?.role || "Pemohon"}</p>
                  </div>
                </div>
                
                {approvers.map((appr, idx) => (
                  <div key={idx} className="text-center w-48 flex flex-col justify-end h-40 relative">
                    <p className="text-sm font-medium mb-auto">Disetujui Oleh,</p>
                    <div className="h-20 w-full flex items-center justify-center text-gray-300 italic text-xs">
                      (Menunggu Persetujuan)
                    </div>
                    <div className="border-t border-slate-800 pt-2 mt-2 w-full">
                      <p className="font-bold text-sm">{appr.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{appr.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-4">
              <button
                onClick={() => setShowIMPreview(false)}
                className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Kembali Edit
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={saving}
                className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                {saving ? "Mengirim..." : "Kirim Pengajuan Resmi"}
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="max-w-6xl mx-auto space-y-8 p-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Buat Work Order</h1>
            <p className="text-sm text-slate-500 mt-1">Pilih tipe dan isi detail laporan</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Type Selection */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs">1</span>
            Tipe Work Order
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWoType("urgent")}
              className={`p-5 rounded-xl border-2 transition-all text-left ${
                woType === "urgent"
                  ? "border-red-500 bg-red-50/50 ring-4 ring-red-50"
                  : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${woType === "urgent" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                  ⚡
                </div>
                <span className={`font-bold text-lg ${woType === "urgent" ? "text-red-700" : "text-slate-700"}`}>Urgent</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">Task mendesak dengan SLA (deadline waktu)</p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> Single assignment</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> SLA tracking real-time</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> Langsung dikerjakan</li>
              </ul>
            </button>

            <button
              type="button"
              onClick={() => setWoType("project")}
              className={`p-5 rounded-xl border-2 transition-all text-left ${
                woType === "project"
                  ? "border-purple-500 bg-purple-50/50 ring-4 ring-purple-50"
                  : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${woType === "project" ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-500"}`}>
                  📁
                </div>
                <span className={`font-bold text-lg ${woType === "project" ? "text-purple-700" : "text-slate-700"}`}>Project</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">Project besar dengan budget & milestones</p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> Budget tracking</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> Milestones per fase</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300"/> Approval chain</li>
              </ul>
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs">2</span>
            Detail Work Order
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Kiri: Info Dasar & Media */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Judul <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 placeholder-slate-400 hover:bg-slate-100 focus:bg-white transition-colors"
                  placeholder="Contoh: AC Lobby Bocor"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Deskripsi Lengkap</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 placeholder-slate-400 hover:bg-slate-100 focus:bg-white transition-colors resize-none"
                  placeholder="Jelaskan detail masalah atau pekerjaan yang harus dilakukan..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Foto Bukti Kerusakan <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                  />
                  {photoPreview && (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview("");
                        }}
                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-lg text-red-600 hover:bg-white shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Foto otomatis dikompres untuk hemat storage server.</p>
                </div>
              </div>
            </div>

            {/* Kanan: Klasifikasi & Lokasi */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Prioritas</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as WorkOrderPriority)}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer"
                  >
                    <option value="low">🟢 Rendah (Low)</option>
                    <option value="medium">🟡 Sedang (Medium)</option>
                    <option value="high">🟠 Tinggi (High)</option>
                    {woType === "urgent" && <option value="critical">🔴 Kritis (Critical)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tags / Label</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 placeholder-slate-400 hover:bg-slate-100 focus:bg-white transition-colors"
                    placeholder="Contoh: AC, Listrik"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  Penugasan Target
                </h3>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Departemen Tujuan <span className="text-red-500">*</span></label>
                  <select
                    value={assignedToDept}
                    onChange={e => {
                      setAssignedToDept(e.target.value);
                      setAssignedToDivision("");
                      setAssignedToUser("");
                    }}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer"
                  >
                    <option value="">-- Pilih Departemen --</option>
                    {departments.length === 0 ? (
                      <option value="" disabled>Belum ada data departemen</option>
                    ) : (
                      departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Divisi (Opsional)</label>
                    <select
                      value={assignedToDivision}
                      onChange={e => setAssignedToDivision(e.target.value)}
                      className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!assignedToDept || divisions.length === 0}
                    >
                      <option value="">-- Divisi --</option>
                      {divisions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Staf (Opsional)</label>
                    <select
                      value={assignedToUser}
                      onChange={e => setAssignedToUser(e.target.value)}
                      className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!assignedToDept}
                    >
                      <option value="">-- Siapa Saja --</option>
                      {getUsersByDept().map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.jabatan || u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Area & Inventory Dropdowns */}
              {template && template.areas.length > 0 ? (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Lokasi & Objek Target
                  </h3>
                  
                  <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100/50 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-orange-900 uppercase tracking-wider mb-2">Lokasi Area</label>
                      <select
                        value={selectedArea}
                        onChange={e => {
                          setSelectedArea(e.target.value);
                          setSelectedItem("");
                          setIsManualItem(false);
                        }}
                        className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-50 transition-colors shadow-sm font-medium cursor-pointer"
                      >
                        <option value="">-- Pilih Area (Opsional) --</option>
                        {template.areas.map(area => (
                          <option key={area.id} value={area.name}>{area.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedArea && (
                      <div>
                        <label className="block text-xs font-bold text-orange-900 uppercase tracking-wider mb-2">Barang / Inventory</label>
                        <select
                          value={isManualItem ? "manual" : selectedItem}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === "manual") {
                              setIsManualItem(true);
                              setSelectedItem("");
                            } else {
                              setIsManualItem(false);
                              setSelectedItem(val);
                            }
                          }}
                          className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-50 transition-colors shadow-sm font-medium cursor-pointer mb-3"
                        >
                          <option value="">-- Pilih Barang --</option>
                          {template.areas.find(a => a.name === selectedArea)?.items.map(item => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                          <option value="manual">+ Lainnya (Isi Manual)</option>
                        </select>

                        {isManualItem && (
                          <input
                            type="text"
                            value={manualItemName}
                            onChange={e => setManualItemName(e.target.value)}
                            className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 placeholder-slate-400 shadow-sm"
                            placeholder="Contoh: AC Ruangan HR"
                            autoFocus

                      />
                    )}
                  </div>
                )}
                  </div>
                </div>
            ) : (
              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Lokasi / Area <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800"
                    placeholder="Contoh: Lobby Utama"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Barang (Opsional)</label>
                  <input
                    type="text"
                    value={selectedItem}
                    onChange={e => {
                      setSelectedItem(e.target.value);
                      setIsManualItem(false); // so it uses selectedItem directly
                    }}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800"
                    placeholder="Contoh: AC Daikin 2PK"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* SLA Section (Urgent) */}
        {woType === "urgent" && (
          <div className="rounded-2xl bg-white p-6 border border-red-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2 relative z-10">
              <span className="w-6 h-6 rounded-md bg-red-100 text-red-600 flex items-center justify-center text-xs">3</span>
              SLA (Service Level Agreement)
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-medium relative z-10">
              Tentukan batas waktu (deadline) respons teknisi dan batas penyelesaian pekerjaan.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              {/* Response SLA */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                  <span>⏱️</span> Batas Waktu Respons
                </h3>
                <p className="text-xs text-yellow-700 mb-4 font-medium">Batas teknisi mengklik "Mulai Kerja"</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={responseDueDate}
                      onChange={e => setResponseDueDate(e.target.value)}
                      className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-500 text-slate-800 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Waktu <span className="text-red-500">*</span></label>
                    <input
                      type="time"
                      value={responseDueTime}
                      onChange={e => setResponseDueTime(e.target.value)}
                      className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-500 text-slate-800 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Resolution SLA */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span>🏁</span> Batas Waktu Penyelesaian
                </h3>
                <p className="text-xs text-red-700 mb-4 font-medium">Batas teknisi mengklik "Selesai"</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={resolutionDueDate}
                      onChange={e => setResolutionDueDate(e.target.value)}
                      className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 text-slate-800 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Waktu <span className="text-red-500">*</span></label>
                    <input
                      type="time"
                      value={resolutionDueTime}
                      onChange={e => setResolutionDueTime(e.target.value)}
                      className="w-full border-0 bg-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 text-slate-800 shadow-sm"
                    />
                  </div>
                </div>
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
            <p className="text-sm text-gray-500 mb-4">
              Tambah milestone/fase project. Setiap milestone bisa di-track statusnya.
            </p>

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
            {milestones.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">Minimal 1 milestone diperlukan</p>
            )}
          </div>
        )}

        {/* Budget Section (Project) */}
        {woType === "project" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-purple-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span>Budget</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Estimation budget keseluruhan dan breakdown per item.
            </p>

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

        {/* Approvers Section (Project) */}
        {woType === "project" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-indigo-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span>Penyetuju (Approvals)</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tambahkan pihak yang harus menyetujui (Internal Memo). Dibuat Oleh (Pemohon) otomatis disetujui.
            </p>

            {/* Approvers list */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-700">Dibuat Oleh (Pemohon)</p>
                  <p className="text-xs text-gray-500">{user?.name} (Otomatis)</p>
                </div>
                <div className="text-xs font-bold text-green-600">Auto-Approve</div>
              </div>
              
              {approvers.map((appr, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-indigo-900">{appr.role}</p>
                    <p className="text-xs text-indigo-700">{appr.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeApprover(idx)}
                    className="p-1 text-red-500 hover:bg-red-100 rounded"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            {/* Add approver */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newApproverRole}
                onChange={e => setNewApproverRole(e.target.value)}
                placeholder="Peran (Cth: Keuangan)"
                className="w-1/3 border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={selectedApproverId}
                onChange={e => setSelectedApproverId(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Pilih User --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.jabatan || u.role})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addApprover}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600"
              >
                Tambah
              </button>
            </div>
          </div>
        )}

        {/* Sticky Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-40 md:pl-64">
          <div className="max-w-3xl mx-auto flex gap-3">
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
              className={`flex-1 ${woType === "urgent" ? "bg-red-600 hover:bg-red-700 focus:ring-red-500" : "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"} text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2`}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  {woType === "urgent" ? "⚡ Buat WO Urgent" : "📁 Buat Project"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </ProtectedRoute>
  );
}