// app/(admin)/shifts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";

type Shift = {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  color: string;
  isActive: boolean;
  createdAt: any;
  description?: string;
  lateTolerance?: number;
  overtimeRate?: number;
  shiftType?: "morning" | "afternoon" | "night" | "special";
};

// Template shift yang sudah disediakan
const shiftTemplates = [
  { name: "AM1", code: "AM1", startTime: "05:00", endTime: "13:00", type: "morning" },
  { name: "AM2", code: "AM2", startTime: "06:00", endTime: "14:00", type: "morning" },
  { name: "AM3", code: "AM3", startTime: "07:00", endTime: "15:00", type: "morning" },
  { name: "AM4", code: "AM4", startTime: "08:00", endTime: "16:00", type: "morning" },
  { name: "AM5", code: "AM5", startTime: "09:00", endTime: "17:00", type: "morning" },
  { name: "AM6", code: "AM6", startTime: "10:00", endTime: "18:00", type: "morning" },
  { name: "AM7", code: "AM7", startTime: "11:00", endTime: "19:00", type: "morning" },
  { name: "PM1", code: "PM1", startTime: "12:00", endTime: "20:00", type: "afternoon" },
  { name: "PM2", code: "PM2", startTime: "13:00", endTime: "21:00", type: "afternoon" },
  { name: "PM3", code: "PM3", startTime: "14:00", endTime: "22:00", type: "afternoon" },
  { name: "PM4", code: "PM4", startTime: "15:00", endTime: "23:00", type: "afternoon" },
  { name: "PM5", code: "PM5", startTime: "16:00", endTime: "01:00", type: "night" },
  { name: "O", code: "O", startTime: "09:00", endTime: "18:00", type: "special" },
  { name: "PO", code: "PO", startTime: "09:00", endTime: "17:00", type: "special" },
  { name: "Day Off", code: "OFF", startTime: "00:00", endTime: "00:00", type: "special" },
  { name: "PHC", code: "PHC", startTime: "00:00", endTime: "00:00", type: "special" },
  { name: "Pending OFF", code: "PENDING_OFF", startTime: "00:00", endTime: "00:00", type: "special" },
];

const colorOptions = [
  { value: "#22c55e", label: "Hijau", class: "bg-green-500" },
  { value: "#3b82f6", label: "Biru", class: "bg-blue-500" },
  { value: "#f59e0b", label: "Kuning", class: "bg-yellow-500" },
  { value: "#ef4444", label: "Merah", class: "bg-red-500" },
  { value: "#8b5cf6", label: "Ungu", class: "bg-purple-500" },
  { value: "#ec4899", label: "Pink", class: "bg-pink-500" },
  { value: "#06b6d4", label: "Cyan", class: "bg-cyan-500" },
  { value: "#f97316", label: "Orange", class: "bg-orange-500" },
  { value: "#6b7280", label: "Abu-abu", class: "bg-gray-500" },
  { value: "#10b981", label: "Emerald", class: "bg-emerald-500" },
];

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    startTime: "08:00",
    endTime: "17:00",
    color: "#22c55e",
    isActive: true,
    description: "",
    lateTolerance: 15,
    overtimeRate: 0,
    shiftType: "morning" as "morning" | "afternoon" | "night" | "special",
  });

  // Load shifts dari Firestore
  useEffect(() => {
    const q = query(collection(db, "shifts"), orderBy("startTime", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const shiftList: Shift[] = [];
      snap.forEach((doc) => {
        shiftList.push({ id: doc.id, ...doc.data() } as Shift);
      });
      setShifts(shiftList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filter shifts berdasarkan search dan tipe
  const filteredShifts = shifts.filter((shift) => {
    const matchesSearch = shift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          shift.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || shift.shiftType === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi kode unik
    const existingShift = shifts.find(s => s.code === formData.code && s.id !== editingShift?.id);
    if (existingShift) {
      alert(`Kode shift "${formData.code}" sudah digunakan!`);
      return;
    }
    
    try {
      if (editingShift) {
        await updateDoc(doc(db, "shifts", editingShift.id), formData);
        alert("✅ Shift berhasil diupdate");
      } else {
        await addDoc(collection(db, "shifts"), {
          ...formData,
          createdAt: new Date(),
        });
        alert("✅ Shift berhasil ditambahkan");
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving shift:", error);
      alert("❌ Gagal menyimpan shift");
    }
  };

  const handleDelete = async (shift: Shift) => {
    if (confirm(`Yakin ingin menghapus shift "${shift.name}"?`)) {
      try {
        await deleteDoc(doc(db, "shifts", shift.id));
        alert("✅ Shift berhasil dihapus");
      } catch (error) {
        console.error("Error deleting shift:", error);
        alert("❌ Gagal menghapus shift");
      }
    }
  };

  const handleToggleActive = async (shift: Shift) => {
    try {
      await updateDoc(doc(db, "shifts", shift.id), {
        isActive: !shift.isActive,
      });
      alert(shift.isActive ? "Shift dinonaktifkan" : "Shift diaktifkan");
    } catch (error) {
      console.error("Error toggling shift:", error);
      alert("❌ Gagal mengubah status shift");
    }
  };

  const resetForm = () => {
    setEditingShift(null);
    setFormData({
      name: "",
      code: "",
      startTime: "08:00",
      endTime: "17:00",
      color: "#22c55e",
      isActive: true,
      description: "",
      lateTolerance: 15,
      overtimeRate: 0,
      shiftType: "morning",
    });
  };

  const editShift = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      color: shift.color,
      isActive: shift.isActive,
      description: shift.description || "",
      lateTolerance: shift.lateTolerance || 15,
      overtimeRate: shift.overtimeRate || 0,
      shiftType: shift.shiftType || "morning",
    });
    setIsModalOpen(true);
  };

  const addFromTemplate = (template: typeof shiftTemplates[0]) => {
    // Cek apakah sudah ada
    const exists = shifts.some(s => s.code === template.code);
    if (exists) {
      alert(`Shift ${template.name} sudah ada!`);
      return;
    }
    
    // Tentukan warna berdasarkan tipe
    let color = "#22c55e";
    if (template.type === "morning") color = "#f59e0b";
    if (template.type === "afternoon") color = "#ef4444";
    if (template.type === "night") color = "#8b5cf6";
    if (template.type === "special") color = "#06b6d4";
    
    setFormData({
      name: template.name,
      code: template.code,
      startTime: template.startTime,
      endTime: template.endTime,
      color: color,
      isActive: true,
      description: `Shift ${template.name} - ${template.startTime} sampai ${template.endTime}`,
      lateTolerance: template.name.includes("Off") ? 0 : 15,
      overtimeRate: 0,
      shiftType: template.type as any,
    });
    setEditingShift(null);
    setIsTemplateModalOpen(false);
    setIsModalOpen(true);
  };

  const getShiftTypeLabel = (type?: string) => {
    switch (type) {
      case "morning": return { label: "🌅 Pagi", color: "bg-yellow-100 text-yellow-700" };
      case "afternoon": return { label: "🌤️ Siang", color: "bg-orange-100 text-orange-700" };
      case "night": return { label: "🌙 Malam", color: "bg-purple-100 text-purple-700" };
      case "special": return { label: "⭐ Khusus", color: "bg-cyan-100 text-cyan-700" };
      default: return { label: "📋 Umum", color: "bg-gray-100 text-gray-700" };
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              📋 Manajemen Shift Kerja
            </h1>
            <p className="text-gray-500 mt-1">
              Kelola jadwal shift untuk absensi karyawan
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>📋</span>
              Dari Template
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>➕</span>
              Buat Baru
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-600">Total Shift</p>
            <p className="text-2xl font-bold text-blue-800">{shifts.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-sm text-green-600">Shift Aktif</p>
            <p className="text-2xl font-bold text-green-800">
              {shifts.filter((s) => s.isActive).length}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <p className="text-sm text-yellow-600">Shift Pagi</p>
            <p className="text-2xl font-bold text-yellow-800">
              {shifts.filter((s) => s.shiftType === "morning").length}
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <p className="text-sm text-purple-600">Shift Malam</p>
            <p className="text-2xl font-bold text-purple-800">
              {shifts.filter((s) => s.shiftType === "night").length}
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Cari shift (nama atau kode)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="all">Semua Tipe</option>
              <option value="morning">🌅 Pagi</option>
              <option value="afternoon">🌤️ Siang</option>
              <option value="night">🌙 Malam</option>
              <option value="special">⭐ Khusus</option>
            </select>
          </div>
        </div>

        {/* Shift Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-gray-500 text-lg">Belum ada shift yang ditambahkan</p>
            <p className="text-gray-400 text-sm mt-1">
              Klik tombol "Buat Baru" atau "Dari Template" untuk menambahkan shift
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShifts.map((shift) => {
              const shiftTypeInfo = getShiftTypeLabel(shift.shiftType);
              const isSpecial = shift.name === "Day Off" || shift.name === "PHC" || shift.name === "Pending OFF";
              
              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group"
                >
                  <div className="h-1.5" style={{ backgroundColor: shift.color }} />
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-gray-800">
                            {shift.name}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${shiftTypeInfo.color}`}>
                            {shiftTypeInfo.label}
                          </span>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {shift.code}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleActive(shift)}
                        className={`ml-2 w-10 h-5 rounded-full transition-colors relative ${
                          shift.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            shift.isActive ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 w-20">Jam Kerja:</span>
                        {shift.startTime !== "00:00" && shift.endTime !== "00:00" ? (
                          <span className="font-medium">
                            {shift.startTime} - {shift.endTime}
                            {shift.endTime === "01:00" && (
                              <span className="text-xs text-orange-500 ml-1">(+1 hari)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Libur / Tidak masuk</span>
                        )}
                      </div>
                      
                      {shift.startTime !== "00:00" && shift.endTime !== "00:00" && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 w-20">Durasi:</span>
                          <span className="font-medium">
                            {(() => {
                              const start = shift.startTime.split(":").map(Number);
                              const end = shift.endTime.split(":").map(Number);
                              let hours = end[0] - start[0];
                              let minutes = end[1] - start[1];
                              if (minutes < 0) {
                                hours--;
                                minutes += 60;
                              }
                              if (hours < 0) hours += 24;
                              return `${hours} jam ${minutes} menit`;
                            })()}
                          </span>
                        </div>
                      )}

                      {!isSpecial && shift.lateTolerance > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 w-20">Toleransi:</span>
                          <span className="font-medium">{shift.lateTolerance} menit</span>
                        </div>
                      )}
                      
                      {shift.description && (
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                          {shift.description}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => editShift(shift)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(shift)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Template Pilihan */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                📋 Pilih Template Shift
              </h2>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Pagi */}
                <div className="bg-yellow-50 rounded-xl p-3">
                  <h3 className="font-bold text-yellow-800 mb-2">🌅 Shift Pagi</h3>
                  <div className="space-y-2">
                    {shiftTemplates.filter(t => t.type === "morning").map((template) => (
                      <button
                        key={template.code}
                        onClick={() => addFromTemplate(template)}
                        className="w-full text-left p-2 bg-white rounded-lg hover:bg-yellow-100 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {template.startTime} - {template.endTime}
                          </span>
                        </div>
                        <span className="text-green-600">+</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Siang */}
                <div className="bg-orange-50 rounded-xl p-3">
                  <h3 className="font-bold text-orange-800 mb-2">🌤️ Shift Siang</h3>
                  <div className="space-y-2">
                    {shiftTemplates.filter(t => t.type === "afternoon").map((template) => (
                      <button
                        key={template.code}
                        onClick={() => addFromTemplate(template)}
                        className="w-full text-left p-2 bg-white rounded-lg hover:bg-orange-100 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {template.startTime} - {template.endTime}
                          </span>
                        </div>
                        <span className="text-green-600">+</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Malam */}
                <div className="bg-purple-50 rounded-xl p-3">
                  <h3 className="font-bold text-purple-800 mb-2">🌙 Shift Malam</h3>
                  <div className="space-y-2">
                    {shiftTemplates.filter(t => t.type === "night").map((template) => (
                      <button
                        key={template.code}
                        onClick={() => addFromTemplate(template)}
                        className="w-full text-left p-2 bg-white rounded-lg hover:bg-purple-100 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {template.startTime} - {template.endTime}
                          </span>
                        </div>
                        <span className="text-green-600">+</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khusus */}
                <div className="bg-cyan-50 rounded-xl p-3">
                  <h3 className="font-bold text-cyan-800 mb-2">⭐ Shift Khusus</h3>
                  <div className="space-y-2">
                    {shiftTemplates.filter(t => t.type === "special").map((template) => (
                      <button
                        key={template.code}
                        onClick={() => addFromTemplate(template)}
                        className="w-full text-left p-2 bg-white rounded-lg hover:bg-cyan-100 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {template.startTime} - {template.endTime}
                          </span>
                        </div>
                        <span className="text-green-600">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Tambah/Edit Shift */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {editingShift ? "✏️ Edit Shift" : "➕ Tambah Shift Baru"}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Shift *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Contoh: Shift Pagi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Shift *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none font-mono"
                    placeholder="Contoh: MORNING"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipe Shift
                </label>
                <select
                  value={formData.shiftType}
                  onChange={(e) =>
                    setFormData({ ...formData, shiftType: e.target.value as any })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="morning">🌅 Pagi</option>
                  <option value="afternoon">🌤️ Siang</option>
                  <option value="night">🌙 Malam</option>
                  <option value="special">⭐ Khusus</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam Mulai *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam Selesai *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warna Shift
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-full ${color.class} ${
                        formData.color === color.value
                          ? "ring-4 ring-offset-2 ring-gray-400"
                          : ""
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toleransi (menit)
                  </label>
                  <input
                    type="number"
                    value={formData.lateTolerance}
                    onChange={(e) =>
                      setFormData({ ...formData, lateTolerance: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Lembur
                  </label>
                  <input
                    type="number"
                    value={formData.overtimeRate}
                    onChange={(e) =>
                      setFormData({ ...formData, overtimeRate: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder="Deskripsi shift..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Aktifkan shift ini
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  {editingShift ? "Update Shift" : "Simpan Shift"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 rounded-lg transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}