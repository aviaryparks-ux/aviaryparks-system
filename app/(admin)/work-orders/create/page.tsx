// app/(admin)/work-orders/create/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
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
  const [newBudgetAmount, setNewBudgetAmount] = useState(0);

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
    if (!newBudgetDesc.trim() || newBudgetAmount <= 0) return;
    setBudgetItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      description: newBudgetDesc,
      category: assignedToDept || "General",
      estimatedCost: newBudgetAmount,
      actualCost: 0
    }]);
    setNewBudgetDesc("");
    setNewBudgetAmount(0);
  };

  const removeBudgetItem = (id: string) => {
    setBudgetItems(prev => prev.filter(b => b.id !== id));
  };

  const getUsersByDept = () => {
    if (!assignedToDept) return [];
    return users.filter(u => u.department === assignedToDept);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!title.trim()) {
      setError("Judul tidak boleh kosong");
      return;
    }
    if (!assignedToDept) {
      setError("Pilih departemen tujuan");
      return;
    }
    if (!photoFile) {
      setError("Mohon upload foto bukti terlebih dahulu");
      return;
    }
    if (!selectedArea) {
      setError("Mohon pilih atau isi Lokasi / Area");
      return;
    }
    if (template && template.areas.length > 0) {
      if (!selectedItem && !isManualItem) {
        setError("Mohon pilih Barang Inventory");
        return;
      }
      if (isManualItem && !manualItemName) {
        setError("Mohon isi nama barang (Manual)");
        return;
      }
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
          setError("Gagal memproses dan mengupload foto");
          setSaving(false);
          return;
        }
      }

      // Calculate SLA hours
      let slaHours = 0;
      if (woType === "urgent" && dueDate && dueTime) {
        const dueDateTime = new Date(`${dueDate}T${dueTime}`);
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
        status: "open",
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
          dueDate,
          dueTime,
          slaHours,
          isOverdue: false
        };
      } else {
        data.milestones = milestones;
        data.budget = budgetItems;
        data.estimatedBudget = estimatedBudget;
        data.actualBudget = 0;
        data.approvalSteps = defaultApprovalSteps();
        data.currentApprovalStep = 0;
      }

      await addDoc(collection(db, "work_orders"), data);

      alert("✅ Work Order berhasil dibuat!");
      router.push("/work-orders");
    } catch (err) {
      console.error("Error creating WO:", err);
      setError("Gagal membuat Work Order: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="max-w-3xl mx-auto space-y-8 p-6 pb-32">
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
          <div className="space-y-5">
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
                  <div className="relative w-full md:w-64 h-48 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  placeholder="Contoh: AC, Listrik, Kebocoran"
                />
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Departemen Tujuan <span className="text-red-500">*</span></label>
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

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Divisi Tujuan</label>
                  <select
                    value={assignedToDivision}
                    onChange={e => setAssignedToDivision(e.target.value)}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!assignedToDept || divisions.length === 0}
                  >
                    <option value="">-- Pilih Divisi (Opsional) --</option>
                    {divisions.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tugaskan ke (Opsional)</label>
                  <select
                    value={assignedToUser}
                    onChange={e => setAssignedToUser(e.target.value)}
                    className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 text-slate-800 hover:bg-slate-100 focus:bg-white transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!assignedToDept}
                  >
                    <option value="">-- Bebas (Siapa saja di Dept) --</option>
                    {getUsersByDept().map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.jabatan || u.role})</option>
                    ))}
                  </select>
                  {!assignedToDept && (
                    <p className="text-xs text-slate-500 mt-2 font-medium">Pilih departemen tujuan terlebih dahulu</p>
                  )}
                </div>
              </div>

            {/* Area & Inventory Dropdowns */}
            {template && template.areas.length > 0 ? (
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 p-5 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                <div>
                  <label className="block text-sm font-bold text-orange-900 mb-2">Lokasi Area</label>
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
                    <label className="block text-sm font-bold text-orange-900 mb-2">Barang / Inventory</label>
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

        {/* SLA Section (Urgent) */}
        {woType === "urgent" && (
          <div className="rounded-2xl bg-white p-6 border border-red-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2 relative z-10">
              <span className="w-6 h-6 rounded-md bg-red-100 text-red-600 flex items-center justify-center text-xs">3</span>
              SLA (Service Level Agreement)
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-medium relative z-10">
              Tentukan deadline penyelesaian. WO otomatis ditandai overdue jika lewat waktu.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal Deadline <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Waktu Deadline <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full border-0 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 text-slate-800"
                />
              </div>
            </div>
            {dueDate && dueTime && (
              <div className="mt-5 p-4 bg-red-50 rounded-xl border border-red-100 relative z-10 flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-0.5">Batas Waktu</p>
                  <p className="text-sm font-bold text-red-700">
                    {new Date(`${dueDate}T${dueTime}`).toLocaleString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>
            )}
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
              <input
                type="number"
                value={estimatedBudget}
                onChange={e => setEstimatedBudget(Number(e.target.value))}
                className="w-full border rounded-lg px-4 py-3"
                placeholder="0"
              />
            </div>

            {/* Budget items */}
            <div className="space-y-2 mb-4">
              {budgetItems.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{b.description}</p>
                    <p className="text-xs text-gray-500">Rp {b.estimatedCost.toLocaleString("id-ID")}</p>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={newBudgetDesc}
                onChange={e => setNewBudgetDesc(e.target.value)}
                placeholder="Deskripsi item..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={newBudgetAmount || ""}
                onChange={e => setNewBudgetAmount(Number(e.target.value))}
                placeholder="Amount"
                className="w-32 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addBudgetItem}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                ➕
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