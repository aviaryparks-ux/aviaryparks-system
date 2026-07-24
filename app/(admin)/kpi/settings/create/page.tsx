"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Trash2, Target, AlertTriangle, Layers, Save, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AVAILABLE_ROLES } from "@/constants/features";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface KPIItem {
  id: string; // temp id for UI
  indicator: string;
  description: string;
  measurement: string;
  weight: number;
}

export default function CreateKPISettingsPage() {
  const router = useRouter();
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [orgData, setOrgData] = useState({
    division: "",
    department: "",
    position: "",
    level: "",
  });

  const [kpiItems, setKpiItems] = useState<KPIItem[]>([
    { id: "1", indicator: "", description: "", measurement: "", weight: 10 }
  ]);

  useEffect(() => {
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

  const availableDivisions = useMemo(() => {
    if (!orgData.department) return [];
    const dept = departmentsList.find(d => d.name === orgData.department);
    return dept?.divisions || [];
  }, [orgData.department, departmentsList]);

  const availablePositions = useMemo(() => {
    if (!orgData.division) return [];
    const div = availableDivisions.find((d: any) => d.name === orgData.division);
    return div?.positions || [];
  }, [orgData.division, availableDivisions]);

  const totalWeight = kpiItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  
  const addKpiItem = () => {
    setKpiItems([...kpiItems, { id: Math.random().toString(), indicator: "", description: "", measurement: "", weight: 10 }]);
  };

  const removeKpiItem = (id: string) => {
    if (kpiItems.length === 1) return;
    setKpiItems(kpiItems.filter(item => item.id !== id));
  };

  const updateKpiItem = (id: string, field: keyof KPIItem, value: any) => {
    setKpiItems(kpiItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    if (!orgData.department || !orgData.division || !orgData.position || !orgData.level) {
      toast.error("Lengkapi data Struktur Organisasi terlebih dahulu");
      return;
    }

    if (kpiItems.some(item => !item.indicator || !item.description || !item.measurement)) {
      toast.error("Lengkapi semua field pada Indikator KPI");
      return;
    }

    if (totalWeight !== 100) {
      toast.error("Total bobot KPI harus tepat 100%");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Menyimpan KPI...");

    try {
      const promises = kpiItems.map(item => {
        return addDoc(collection(db, "kpiSettings"), {
          division: orgData.division,
          department: orgData.department,
          position: orgData.position,
          level: orgData.level,
          indicator: item.indicator,
          description: item.description,
          measurement: item.measurement,
          weight: item.weight,
          isActive: true
        });
      });

      await Promise.all(promises);
      toast.success("Berhasil menambahkan KPI!", { id: toastId });
      router.push("/kpi/settings");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan data", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      {/* Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/kpi/settings" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tambah KPI Baru</h1>
            <p className="text-sm text-slate-500 mt-1">Buat indikator produktivitas massal untuk satu jabatan</p>
          </div>
        </div>
      </div>

      {/* Organisasi Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" /> 1. Tentukan Jabatan
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Departemen</label>
            <select required value={orgData.department} onChange={(e) => setOrgData({ ...orgData, department: e.target.value, division: "", position: "" })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none">
              <option value="">-- Pilih Departemen --</option>
              {departmentsList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Divisi</label>
            <select required value={orgData.division} onChange={(e) => setOrgData({ ...orgData, division: e.target.value, position: "" })} disabled={!orgData.department} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none disabled:bg-slate-100 disabled:text-slate-400">
              <option value="">-- Pilih Divisi --</option>
              {availableDivisions.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Posisi</label>
            <select required value={orgData.position} onChange={(e) => setOrgData({ ...orgData, position: e.target.value })} disabled={!orgData.division} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none disabled:bg-slate-100 disabled:text-slate-400">
              <option value="">-- Pilih Posisi --</option>
              {availablePositions.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Level (Role)</label>
            <select required value={orgData.level} onChange={(e) => setOrgData({ ...orgData, level: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none">
              <option value="">-- Pilih Level --</option>
              {AVAILABLE_ROLES.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Indikator Forms */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" /> 2. Detail Indikator (KPI)
          </h3>
          <button onClick={addKpiItem} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Tambah Baris
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {kpiItems.map((item, index) => (
            <div key={item.id} className="relative bg-slate-50/50 p-5 rounded-xl border border-slate-100 flex flex-col gap-4">
              {kpiItems.length > 1 && (
                <button onClick={() => removeKpiItem(item.id)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center transition-all shadow-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Indikator #{index + 1}</label>
                  <input type="text" required placeholder="Cth: Kualitas Produk" value={item.indicator} onChange={(e) => updateKpiItem(item.id, "indicator", e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Bobot (%)</label>
                  <div className="relative">
                    <input type="number" required value={item.weight} onChange={(e) => updateKpiItem(item.id, "weight", Number(e.target.value))} className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none bg-emerald-50/30" min="1" max="100" />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Deskripsi Singkat</label>
                  <textarea required placeholder="Cth: Kemampuan menghasilkan makanan sesuai standar..." value={item.description} onChange={(e) => updateKpiItem(item.id, "description", e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cara Mengukur</label>
                  <textarea required placeholder="Cth: Penilaian konsistensi rasa setiap minggu..." value={item.measurement} onChange={(e) => updateKpiItem(item.id, "measurement", e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none resize-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Footer / Progress Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40 p-4 transition-all">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full flex items-center gap-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${totalWeight === 100 ? 'bg-emerald-100 text-emerald-600' : totalWeight > 100 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              {totalWeight === 100 ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-bold text-slate-700">Total Bobot Terisi</span>
                <span className={`text-lg font-black ${totalWeight === 100 ? 'text-emerald-600' : totalWeight > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                  {totalWeight}% <span className="text-xs font-medium text-slate-400">/ 100%</span>
                </span>
              </div>
              {/* Progress Bar Container */}
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${totalWeight === 100 ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(totalWeight, 100)}%` }}
                />
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={totalWeight !== 100 || submitting}
            className={`w-full md:w-auto flex-shrink-0 px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              totalWeight === 100 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-5 h-5" />
            {submitting ? 'Menyimpan...' : 'Simpan Indikator'}
          </button>
        </div>
      </div>
    </div>
  );
}
