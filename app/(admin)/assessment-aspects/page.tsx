// app/(admin)/assessment-aspects/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Aspect {
  id: string;
  code: string;
  name: string;
  competencyId: string;
  competencyName: string;
  indicators: string[];
  weight: number;
  isActive: boolean;
}

interface Competency {
  id: string;
  name: string;
  code: string;
}

export default function AssessmentAspectsPage() {
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Aspect | null>(null);
  const [indicatorInput, setIndicatorInput] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    competencyId: "",
    competencyName: "",
    indicators: [] as string[],
    weight: 10,
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [aspectsSnap, competenciesSnap] = await Promise.all([
        getDocs(collection(db, "assessmentAspects")),
        getDocs(collection(db, "competencies")),
      ]);
      
      const comps = competenciesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competency));
      setCompetencies(comps);

      const aspectsData = aspectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aspect));
      setAspects(aspectsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addIndicator = () => {
    if (indicatorInput.trim()) {
      setFormData({
        ...formData,
        indicators: [...formData.indicators, indicatorInput.trim()],
      });
      setIndicatorInput("");
    }
  };

  const removeIndicator = (index: number) => {
    setFormData({
      ...formData,
      indicators: formData.indicators.filter((_, i) => i !== index),
    });
  };

  const handleCompetencyChange = (competencyId: string) => {
    const comp = competencies.find(c => c.id === competencyId);
    setFormData({
      ...formData,
      competencyId,
      competencyName: comp?.name || "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateDoc(doc(db, "assessmentAspects", editing.id), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "assessmentAspects"), {
          ...formData,
          createdAt: Timestamp.now(),
        });
      }
      fetchData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving aspect:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus aspek penilaian ini?")) {
      await deleteDoc(doc(db, "assessmentAspects", id));
      fetchData();
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      code: "",
      name: "",
      competencyId: "",
      competencyName: "",
      indicators: [],
      weight: 10,
      isActive: true,
    });
  };

  const editAspect = (aspect: Aspect) => {
    setEditing(aspect);
    setFormData({
      code: aspect.code,
      name: aspect.name,
      competencyId: aspect.competencyId,
      competencyName: aspect.competencyName,
      indicators: aspect.indicators || [],
      weight: aspect.weight,
      isActive: aspect.isActive,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Aspek Penilaian</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola aspek yang dinilai dalam penilaian kinerja</p>
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
          Tambah Aspek
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aspek Penilaian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kompetensi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indikator</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bobot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : aspects.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">Belum ada data aspek penilaian</td></tr>
              ) : (
                aspects.map((aspect) => (
                  <tr key={aspect.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{aspect.code}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{aspect.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{aspect.competencyName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <ul className="list-disc list-inside">
                        {aspect.indicators?.slice(0, 2).map((ind, i) => <li key={i} className="truncate">{ind}</li>)}
                        {aspect.indicators?.length > 2 && <li>+{aspect.indicators.length - 2} lagi</li>}
                      </ul>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{aspect.weight}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${aspect.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {aspect.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button onClick={() => editAspect(aspect)} className="text-green-600 hover:text-green-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(aspect.id)} className="text-red-600 hover:text-red-800">Hapus</button>
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
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Aspek Penilaian" : "Tambah Aspek Penilaian"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                  <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="contoh: ASP001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bobot (%)</label>
                  <input type="number" required value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" min="0" max="100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aspek</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kompetensi Terkait</label>
                <select required value={formData.competencyId} onChange={(e) => handleCompetencyChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="">Pilih Kompetensi</option>
                  {competencies.map(comp => <option key={comp.id} value={comp.id}>{comp.code} - {comp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indikator Penilaian</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={indicatorInput} onChange={(e) => setIndicatorInput(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg" placeholder="Tambah indikator..." />
                  <button type="button" onClick={addIndicator} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Tambah</button>
                </div>
                <div className="space-y-1">
                  {formData.indicators.map((ind, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="flex-1 text-sm">{ind}</span>
                      <button type="button" onClick={() => removeIndicator(idx)} className="text-red-500 hover:text-red-700">Hapus</button>
                    </div>
                  ))}
                </div>
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