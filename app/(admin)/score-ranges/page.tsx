// app/(admin)/score-ranges/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScoreRange {
  id: string;
  name: string;
  ranges: Range[];
  isActive: boolean;
}

interface Range {
  min: number;
  max: number;
  label: string;
  color: string;
  point: number;
}

export default function ScoreRangesPage() {
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScoreRange | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    isActive: true,
    ranges: [
      { min: 90, max: 100, label: "Sangat Baik", color: "#4CAF50", point: 5 },
      { min: 75, max: 89, label: "Baik", color: "#2196F3", point: 4 },
      { min: 60, max: 74, label: "Cukup", color: "#FFC107", point: 3 },
      { min: 50, max: 59, label: "Kurang", color: "#FF9800", point: 2 },
      { min: 0, max: 49, label: "Sangat Kurang", color: "#F44336", point: 1 },
    ] as Range[],
  });

  useEffect(() => {
    fetchScoreRanges();
  }, []);

  const fetchScoreRanges = async () => {
    try {
      const snapshot = await getDocs(collection(db, "scoreRanges"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScoreRange));
      setScoreRanges(data);
    } catch (error) {
      console.error("Error fetching score ranges:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateDoc(doc(db, "scoreRanges", editing.id), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "scoreRanges"), {
          ...formData,
          createdAt: Timestamp.now(),
        });
      }
      fetchScoreRanges();
      setShowModal(false);
    } catch (error) {
      console.error("Error saving score range:", error);
    }
  };

  const updateRange = (index: number, field: keyof Range, value: any) => {
    const newRanges = [...formData.ranges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    setFormData({ ...formData, ranges: newRanges });
  };

  const addRange = () => {
    setFormData({
      ...formData,
      ranges: [...formData.ranges, { min: 0, max: 0, label: "", color: "#9CA3AF", point: 0 }],
    });
  };

  const removeRange = (index: number) => {
    setFormData({
      ...formData,
      ranges: formData.ranges.filter((_, i) => i !== index),
    });
  };

  const getActiveRange = (score: number, ranges: Range[]) => {
    return ranges.find(r => score >= r.min && score <= r.max);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rentang Nilai</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola grade dan rentang nilai penilaian</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Skala
        </button>
      </div>

      {/* Preview Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Preview Skala Penilaian</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {formData.ranges.map((range, idx) => (
            <div key={idx} className="text-center p-3 rounded-xl" style={{ backgroundColor: `${range.color}20`, borderLeft: `4px solid ${range.color}` }}>
              <div className="text-2xl font-bold" style={{ color: range.color }}>{range.point}</div>
              <div className="text-sm font-medium text-gray-800">{range.label}</div>
              <div className="text-xs text-gray-500">{range.min} - {range.max}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Nama Skala</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Rentang Nilai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Preview</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : scoreRanges.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada skala penilaian</td></tr>
              ) : (
                scoreRanges.map((sr) => (
                  <tr key={sr.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{sr.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {sr.ranges[0]?.min} - {sr.ranges[sr.ranges.length - 1]?.max}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {sr.ranges.map((r, i) => <div key={i} className="w-6 h-6 rounded-full" style={{ backgroundColor: r.color, border: `2px solid ${r.color}` }} title={`${r.label}: ${r.min}-${r.max}`} />)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${sr.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {sr.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button className="text-green-600 hover:text-green-800 mr-3">Edit</button>
                      <button className="text-red-600 hover:text-red-800">Hapus</button>
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
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Skala Penilaian" : "Tambah Skala Penilaian"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Skala</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="contoh: Skala Penilaian Kinerja 2024" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Rentang Nilai</label>
                  <button type="button" onClick={addRange} className="text-sm text-green-600 hover:text-green-700">+ Tambah Range</button>
                </div>
                <div className="space-y-2">
                  {formData.ranges.map((range, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg">
                      <input type="number" placeholder="Min" value={range.min} onChange={(e) => updateRange(idx, "min", parseInt(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 rounded" />
                      <span>-</span>
                      <input type="number" placeholder="Max" value={range.max} onChange={(e) => updateRange(idx, "max", parseInt(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 rounded" />
                      <input type="text" placeholder="Label" value={range.label} onChange={(e) => updateRange(idx, "label", e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded" />
                      <input type="color" value={range.color} onChange={(e) => updateRange(idx, "color", e.target.value)} className="w-10 h-10 border border-gray-300 rounded cursor-pointer" />
                      <input type="number" placeholder="Point" value={range.point} onChange={(e) => updateRange(idx, "point", parseInt(e.target.value))} className="w-16 px-2 py-1 border border-gray-300 rounded" />
                      <button type="button" onClick={() => removeRange(idx)} className="text-red-500 hover:text-red-700">✕</button>
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