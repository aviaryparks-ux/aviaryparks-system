// app/(admin)/kpi/periods/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Period {
  id: string;
  name: string;
  period: string;
  year: number;
  startDate: string;
  endDate: string;
  status: "active" | "closed" | "upcoming";
  isSelfAssessment: boolean;
  isManagerAssessment: boolean;
}

type FormData = {
  name: string;
  period: string;
  year: number;
  startDate: string;
  endDate: string;
  status: "active" | "closed" | "upcoming";
  isSelfAssessment: boolean;
  isManagerAssessment: boolean;
};

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    period: "Q1",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
    status: "upcoming",
    isSelfAssessment: true,
    isManagerAssessment: true,
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      const snapshot = await getDocs(collection(db, "assessmentPeriods"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Period));
      setPeriods(data.sort((a, b) => b.year - a.year));
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateDoc(doc(db, "assessmentPeriods", editing.id), {
          ...formData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "assessmentPeriods"), {
          ...formData,
          createdAt: Timestamp.now(),
        });
      }
      fetchPeriods();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving period:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus periode ini?")) {
      await deleteDoc(doc(db, "assessmentPeriods", id));
      fetchPeriods();
    }
  };

  // 🔥 PERBAIKAN: Fungsi handleSetActive yang benar
  const handleSetActive = async (id: string) => {
    try {
      // Set all periods to closed first
      for (const period of periods) {
        await updateDoc(doc(db, "assessmentPeriods", period.id), { status: "closed" });
      }
      // Set selected period to active
      await updateDoc(doc(db, "assessmentPeriods", id), { status: "active" });
      fetchPeriods();
      alert("Periode berhasil diaktifkan");
    } catch (error) {
      console.error("Error setting active period:", error);
      alert("Gagal mengaktifkan periode");
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      name: "",
      period: "Q1",
      year: new Date().getFullYear(),
      startDate: "",
      endDate: "",
      status: "upcoming",
      isSelfAssessment: true,
      isManagerAssessment: true,
    });
  };

  const editPeriod = (period: Period) => {
    setEditing(period);
    setFormData({
      name: period.name,
      period: period.period,
      year: period.year,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      isSelfAssessment: period.isSelfAssessment,
      isManagerAssessment: period.isManagerAssessment,
    });
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Aktif</span>;
      case "closed": return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Tutup</span>;
      default: return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Akan Datang</span>;
    }
  };

  const periodLabels: Record<string, string> = { Q1: "Jan - Mar", Q2: "Apr - Jun", Q3: "Jul - Sep", Q4: "Okt - Des" };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Periode Penilaian</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola periode penilaian kinerja karyawan</p>
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
          Tambah Periode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {periods.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-gray-500">Belum ada periode penilaian</div>
        ) : (
          periods.map((period) => (
            <div key={period.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className={`p-4 ${period.status === "active" ? "bg-green-50 border-b border-green-200" : "border-b border-gray-200"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{period.name}</h3>
                    <p className="text-sm text-gray-500">{period.period} {period.year} • {periodLabels[period.period]}</p>
                  </div>
                  {getStatusBadge(period.status)}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600">{period.startDate} - {period.endDate}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${period.isSelfAssessment ? "bg-green-500" : "bg-gray-300"}`} />
                    Self Assessment: {period.isSelfAssessment ? "Aktif" : "Nonaktif"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${period.isManagerAssessment ? "bg-green-500" : "bg-gray-300"}`} />
                    Manager Assessment: {period.isManagerAssessment ? "Aktif" : "Nonaktif"}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  {period.status !== "active" && (
                    <button
                      onClick={() => handleSetActive(period.id)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Aktifkan
                    </button>
                  )}
                  <button
                    onClick={() => editPeriod(period)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(period.id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Periode" : "Tambah Periode"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Periode</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="contoh: Penilaian Kinerja Q1 2024"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Q1">Q1 (Jan - Mar)</option>
                    <option value="Q2">Q2 (Apr - Jun)</option>
                    <option value="Q3">Q3 (Jul - Sep)</option>
                    <option value="Q4">Q4 (Okt - Des)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="upcoming">Akan Datang</option>
                  <option value="active">Aktif</option>
                  <option value="closed">Tutup</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isSelfAssessment}
                    onChange={(e) => setFormData({ ...formData, isSelfAssessment: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  Self Assessment
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isManagerAssessment}
                    onChange={(e) => setFormData({ ...formData, isManagerAssessment: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  Manager Assessment
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}