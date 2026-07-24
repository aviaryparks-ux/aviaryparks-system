"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Edit2, Trash2, Settings, Target, AlertTriangle, FileText, CheckCircle2, Activity, Layers, Search, Filter } from "lucide-react";
import { AVAILABLE_ROLES } from "@/constants/features";
import toast from "react-hot-toast";
import Link from "next/link";
import ImportExcelModal from "./ImportExcelModal";
import { Download } from "lucide-react";

interface KPISetting {
  id: string;
  division: string;
  department: string;
  position: string;
  level: string;
  indicator: string;
  description: string;
  measurement: string;
  weight: number;
  isActive: boolean;
}

export default function KPISettingsPage() {
  const [settings, setSettings] = useState<KPISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editing, setEditing] = useState<KPISetting | null>(null);
  
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    division: "",
    department: "",
    position: "",
    level: "",
    indicator: "",
    description: "",
    measurement: "",
    weight: 10,
    isActive: true,
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("ALL");

  useEffect(() => {
    fetchData();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const snap = await getDocs(query(collection(db, "departments"), limit(100)));
      const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDepartmentsList(arr);
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const settingsSnap = await getDocs(collection(db, "kpiSettings"));
      const settingsData = settingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as KPISetting));
      setSettings(settingsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal memuat data KPI");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return; // Only allow editing from this modal now
    
    try {
      await updateDoc(doc(db, "kpiSettings", editing.id), {
        ...formData,
        updatedAt: Timestamp.now(),
      });
      toast.success("KPI berhasil diperbarui");

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Gagal menyimpan KPI");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus pengaturan KPI ini? Data yang sudah dihapus tidak dapat dikembalikan.")) {
      try {
        await deleteDoc(doc(db, "kpiSettings", id));
        toast.success("KPI berhasil dihapus");
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        toast.error("Gagal menghapus KPI");
      }
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      division: "",
      department: "",
      position: "",
      level: "",
      indicator: "",
      description: "",
      measurement: "",
      weight: 10,
      isActive: true,
    });
  };

  const editSetting = (setting: KPISetting) => {
    setEditing(setting);
    setFormData({
      division: setting.division || "",
      department: setting.department || "",
      position: setting.position || "",
      level: setting.level || "",
      indicator: setting.indicator || "",
      description: setting.description || "",
      measurement: setting.measurement || "",
      weight: setting.weight || 0,
      isActive: setting.isActive ?? true,
    });
    setShowModal(true);
  };

  const filteredSettings = useMemo(() => {
    return settings.filter(s => {
      const matchSearch = (s.indicator || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.position || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = filterDepartment === "ALL" || s.department === filterDepartment;
      return matchSearch && matchDept;
    });
  }, [settings, searchTerm, filterDepartment]);

  const totalWeight = filteredSettings.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);

  // Dynamic Dropdowns
  const availableDivisions = useMemo(() => {
    if (!formData.department) return [];
    const dept = departmentsList.find(d => d.name === formData.department);
    return dept?.divisions || [];
  }, [formData.department, departmentsList]);

  const availablePositions = useMemo(() => {
    if (!formData.division) return [];
    const div = availableDivisions.find((d: any) => d.name === formData.division);
    return div?.positions || [];
  }, [formData.division, availableDivisions]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan KPI</h1>
              <p className="text-sm text-slate-500 mt-1">Konfigurasi indikator produktivitas dan efisiensi karyawan</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors shadow-sm active:scale-95"
            >
              <Download className="w-5 h-5" />
              Import Excel / Spreadsheet
            </button>
            <Link
              href="/kpi/settings/create"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Tambah KPI Baru
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Cari indikator atau posisi..."
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="block w-full pl-9 pr-10 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all appearance-none"
            >
              <option value="ALL">Semua Departemen</option>
              {departmentsList.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Info Bobot */}
      {filterDepartment !== "ALL" && (
        <div className={`rounded-2xl p-5 border shadow-sm flex items-center justify-between transition-colors ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${totalWeight === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Total Bobot Departemen {filterDepartment}</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black ${totalWeight === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {totalWeight}%
                </span>
                {totalWeight !== 100 && (
                  <span className="text-sm font-medium text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Belum mencapai 100%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Departemen / Posisi</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Indikator (KPI)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pengukuran</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bobot</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-3 text-sm font-medium text-slate-500">Memuat data KPI...</p>
                  </td>
                </tr>
              ) : filteredSettings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Target className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-lg font-bold text-slate-700">Belum ada Pengaturan KPI</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Silakan tambahkan indikator KPI baru untuk mulai mengukur produktivitas dan efisiensi tim.</p>
                  </td>
                </tr>
              ) : (
                filteredSettings.map((setting) => (
                  <tr key={setting.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{setting.department}</span>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-fit mt-1">{setting.position} ({setting.level})</span>
                        <span className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Layers className="w-3 h-3"/> {setting.division}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800">{setting.indicator}</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">{setting.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-600 max-w-xs leading-relaxed">{setting.measurement}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                        <span className="font-black text-slate-700">{setting.weight}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => editSetting(setting)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors tooltip" title="Edit KPI">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(setting.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors tooltip" title="Hapus KPI">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
           </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-scale-in">
            <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{editing ? "Edit Pengaturan KPI" : "Tambah KPI Baru"}</h2>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {/* Seksi Organisasi */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-emerald-500" /> Struktur Organisasi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Departemen</label>
                    <select required value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value, division: "", position: "" })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none">
                      <option value="">-- Pilih Departemen --</option>
                      {departmentsList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Divisi</label>
                    <select required value={formData.division} onChange={(e) => setFormData({ ...formData, division: e.target.value, position: "" })} disabled={!formData.department} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">-- Pilih Divisi --</option>
                      {availableDivisions.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Posisi</label>
                    <select required value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} disabled={!formData.division} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">-- Pilih Posisi --</option>
                      {availablePositions.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Level (Role)</label>
                    <select required value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none">
                      <option value="">-- Pilih Level --</option>
                      {AVAILABLE_ROLES.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seksi Indikator */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-emerald-500" /> Detail Indikator
                </h3>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Key Performance Indicator (KPI)</label>
                  <input type="text" required placeholder="Cth: Kualitas Produk" value={formData.indicator} onChange={(e) => setFormData({ ...formData, indicator: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Deskripsi Singkat</label>
                  <textarea required placeholder="Cth: Kemampuan menghasilkan makanan sesuai standar..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cara Mengukur KPI</label>
                  <textarea required placeholder="Cth: Rasa konsisten, plating sesuai arahan CDP..." value={formData.measurement} onChange={(e) => setFormData({ ...formData, measurement: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none resize-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Bobot KPI (%)</label>
                    <div className="relative">
                      <input type="number" required value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" min="1" max="100" />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                      <span className="text-sm font-bold text-slate-700">Status Aktif</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-sm transition-all active:scale-95">
                  {editing ? "Simpan Perubahan" : "Tambahkan KPI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportExcelModal 
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => {
            setShowImportModal(false);
            fetchData();
          }} 
        />
      )}
    </div>
  );
}