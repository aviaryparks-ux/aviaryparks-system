// app/(admin)/kpi/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface KPI {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  period: string;
  totalScore: number;
  rating: string;
  status: string;
}

export default function KPIPage() {
  const [kpiData, setKpiData] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");

  useEffect(() => {
    fetchKPI();
  }, []);

  const fetchKPI = async () => {
    try {
      const snapshot = await getDocs(collection(db, "kpiData"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KPI));
      setKpiData(data);
    } catch (error) {
      console.error("Error fetching KPI:", error);
    } finally {
      setLoading(false);
    }
  };

  const periods = ["all", ...new Set(kpiData.map(k => k.period).filter(Boolean))];
  const departments = ["all", ...new Set(kpiData.map(k => k.department).filter(Boolean))];

  const filteredKPI = kpiData.filter(kpi => {
    const matchesSearch = kpi.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPeriod = filterPeriod === "all" || kpi.period === filterPeriod;
    const matchesDept = filterDepartment === "all" || kpi.department === filterDepartment;
    return matchesSearch && matchesPeriod && matchesDept;
  });

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "Sangat Baik": return "text-green-600 bg-green-100";
      case "Baik": return "text-blue-600 bg-blue-100";
      case "Cukup": return "text-yellow-600 bg-yellow-100";
      case "Kurang": return "text-orange-600 bg-orange-100";
      default: return "text-red-600 bg-red-100";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data KPI</h1>
          <p className="text-sm text-gray-500 mt-1">Rekap data KPI seluruh karyawan</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input type="text" placeholder="Cari karyawan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg" />
        <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          {periods.map(p => <option key={p} value={p}>{p === "all" ? "Semua Periode" : p}</option>)}
        </select>
        <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          {departments.map(d => <option key={d} value={d}>{d === "all" ? "Semua Departemen" : d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Karyawan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Departemen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Periode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Total Skor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filteredKPI.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">Belum ada data KPI</td></tr>
              ) : (
                filteredKPI.map((kpi) => (
                  <tr key={kpi.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{kpi.employeeName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{kpi.department}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{kpi.period}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{kpi.totalScore}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${getRatingColor(kpi.rating)}`}>{kpi.rating}</span></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${kpi.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{kpi.status}</span></td>
                    <td className="px-6 py-4 text-right"><button className="text-green-600 hover:text-green-800">Detail</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Total Karyawan</p><p className="text-2xl font-bold">{kpiData.length}</p></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Rata-rata Skor</p><p className="text-2xl font-bold">{kpiData.length ? (kpiData.reduce((a,b) => a + b.totalScore, 0) / kpiData.length).toFixed(1) : 0}</p></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Tertinggi</p><p className="text-2xl font-bold text-green-600">{Math.max(...kpiData.map(k => k.totalScore), 0)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Terendah</p><p className="text-2xl font-bold text-red-600">{Math.min(...kpiData.map(k => k.totalScore), 0)}</p></div>
      </div>
    </div>
  );
}