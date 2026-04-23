// app/(admin)/kpi/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface KPISetting {
  id: string;
  aspectId: string;
  aspectName: string;
  competencyId: string;
  competencyName: string;
  target: number;
  weight: number;
  isActive: boolean;
}

interface Aspect {
  id: string;
  name: string;
  code: string;
  competencyId: string;
  competencyName: string;
}

export default function KPISettingsPage() {
  const [settings, setSettings] = useState<KPISetting[]>([]);
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<KPISetting | null>(null);
  const [formData, setFormData] = useState({
    aspectId: "",
    aspectName: "",
    competencyId: "",
    competencyName: "",
    target: 90,
    weight: 10,
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsSnap, aspectsSnap] = await Promise.all([
        getDocs(collection(db, "kpiSettings")),
        getDocs(collection(db, "assessmentAspects")),
      ]);
      
      const aspectsData = aspectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aspect));
      setAspects(aspectsData);

      const settingsData = settingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as KPISetting));
      setSettings(settingsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAspectChange = (aspectId: string) => {
    const aspect = aspects.find(a => a.id === aspectId);
    setFormData({
      ...formData,
      aspectId,
      aspectName: aspect?.name || "",
      competencyId: aspect?.competencyId || "",
      competencyName: aspect?.competencyName || "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateDoc(doc(db, "kpiSettings", editing.id), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "kpiSettings"), {
          ...formData,
          createdAt: Timestamp.now(),
        });
      }
      fetchData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving KPI setting:", error);
      alert("Gagal menyimpan setting KPI");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus setting KPI ini?")) {
      await deleteDoc(doc(db, "kpiSettings", id));
      fetchData();
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      aspectId: "",
      aspectName: "",
      competencyId: "",
      competencyName: "",
      target: 90,
      weight: 10,
      isActive: true,
    });
  };

  const editSetting = (setting: KPISetting) => {
    setEditing(setting);
    setFormData({
      aspectId: setting.aspectId,
      aspectName: setting.aspectName,
      competencyId: setting.competencyId,
      competencyName: setting.competencyName,
      target: setting.target,
      weight: setting.weight,
      isActive: setting.isActive,
    });
    setShowModal(true);
  };

  const totalWeight = settings.reduce((sum, s) => sum + s.weight, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Setting KPI</h1>
          <p className="text-sm text-gray-500 mt-1">Atur target dan bobot penilaian KPI</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Setting KPI
        </button>
      </div>

      {/* Info Bobot */}
      <div className={`bg-${totalWeight === 100 ? 'green' : 'yellow'}-50 rounded-xl p-4 border border-${totalWeight === 100 ? 'green' : 'yellow'}-200`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Total Bobot Keseluruhan</p>
            <p className={`text-2xl font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-yellow-600'}`}>{totalWeight}%</p>
          </div>
          {totalWeight !== 100 && (
            <p className="text-sm text-yellow-700">⚠️ Total bobot harus 100% untuk perhitungan yang akurat</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Aspek Penilaian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Kompetensi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Bobot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : settings.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada setting KPI</td></tr>
              ) : (
                settings.map((setting) => (
                  <tr key={setting.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{setting.aspectName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{setting.competencyName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{setting.target}%</td>
                    <td className="px-6 py-4 text-sm font-semibold">{setting.weight}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${setting.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {setting.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button onClick={() => editSetting(setting)} className="text-green-600 hover:text-green-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(setting.id)} className="text-red-600 hover:text-red-800">Hapus</button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Setting KPI" : "Tambah Setting KPI"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor"viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aspek Penilaian</label>
                <select required value={formData.aspectId} onChange={(e) => handleAspectChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="">Pilih Aspek</option>
                  {aspects.map(aspect => <option key={aspect.id} value={aspect.id}>{aspect.code} - {aspect.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target (%)</label>
                <input type="number" required value={formData.target} onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" min="0" max="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bobot (%)</label>
                <input type="number" required value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" min="0" max="100" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-green-600 rounded" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Aktif</label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}