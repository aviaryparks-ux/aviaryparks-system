// app/(admin)/attendance/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ProtectedRoute from "@/components/ProtectedRoute";

type Attendance = {
  id: string;
  uid: string;
  name: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  date: any;
  checkIn?: any;
  checkOut?: any;
  workHours?: string;
};

export default function AttendancePage() {
  const [data, setData] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filter states
  const [tempDept, setTempDept] = useState("ALL");
  const [tempJabatan, setTempJabatan] = useState("ALL");
  const [tempEmployee, setTempEmployee] = useState("ALL");
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");

  const [dept, setDept] = useState("ALL");
  const [jabatan, setJabatan] = useState("ALL");
  const [employee, setEmployee] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const obj: any = {};
      snap.forEach((doc) => {
        obj[doc.id] = doc.data();
      });
      setUsers(obj);
    });
    return () => unsub();
  }, []);

  // Load attendance
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "attendance"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const user = users[d.uid] || {};
        arr.push({
          id: doc.id,
          ...d,
          department: user.department || "-",
          jabatan: user.jabatan || "-",
          dailyRate: user.dailyRate || 0,
        });
      });
      setData(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [users]);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    return ts.toDate().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (ts: any) => {
    if (!ts) return "--:--";
    return ts.toDate().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const onlyDate = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const setPayrollPeriod = () => {
    const now = new Date();
    let start, end;
    if (now.getDate() >= 26) {
      start = new Date(now.getFullYear(), now.getMonth(), 26);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 26);
      end = new Date(now.getFullYear(), now.getMonth(), 25);
    }
    setTempStartDate(start.toISOString().split("T")[0]);
    setTempEndDate(end.toISOString().split("T")[0]);
  };

  const applyFilter = () => {
    setDept(tempDept);
    setJabatan(tempJabatan);
    setEmployee(tempEmployee);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  const resetFilter = () => {
    setTempDept("ALL");
    setTempJabatan("ALL");
    setTempEmployee("ALL");
    setTempStartDate("");
    setTempEndDate("");
    setDept("ALL");
    setJabatan("ALL");
    setEmployee("ALL");
    setStartDate("");
    setEndDate("");
  };

  const filtered = data.filter((a) => {
    let ok = true;
    if (dept !== "ALL") ok = ok && a.department === dept;
    if (jabatan !== "ALL") ok = ok && a.jabatan === jabatan;
    if (employee !== "ALL") ok = ok && a.uid === employee;
    if (startDate)
      ok = ok && onlyDate(a.date.toDate()) >= onlyDate(new Date(startDate));
    if (endDate)
      ok = ok && onlyDate(a.date.toDate()) <= onlyDate(new Date(endDate));
    return ok;
  });

  const deptList = [
    "ALL",
    ...new Set(Object.values(users).map((u: any) => u.department).filter(Boolean)),
  ];
  const jabatanList = [
    "ALL",
    ...new Set(Object.values(users).map((u: any) => u.jabatan).filter(Boolean)),
  ];
  const employeeList = ["ALL", ...new Set(data.map((a) => a.uid))];

  const stats = {
    total: filtered.length,
    hadir: filtered.filter((a) => a.checkIn).length,
    terlambat: filtered.filter((a) => {
      if (!a.checkIn) return false;
      const hour = a.checkIn.time?.toDate().getHours();
      return hour && hour > 8;
    }).length,
  };

  const recap: any = {};
  filtered.forEach((a) => {
    if (!recap[a.uid]) {
      recap[a.uid] = {
        name: a.name,
        department: a.department,
        jabatan: a.jabatan,
        rate: a.dailyRate,
        totalHari: 0,
        totalGaji: 0,
      };
    }
    if (a.checkIn) {
      recap[a.uid].totalHari++;
    }
    recap[a.uid].totalGaji = recap[a.uid].totalHari * (a.dailyRate || 0);
  });
  const recapList = Object.values(recap).sort((a: any, b: any) => b.totalGaji - a.totalGaji);

  const exportDetailExcel = async () => {
    setExporting("detail-excel");
    try {
      const rows = filtered.map((a) => ({
        Nama: a.name,
        Department: a.department,
        Jabatan: a.jabatan,
        Tanggal: formatDate(a.date),
        Jam_Masuk: formatTime(a.checkIn?.time),
        Jam_Pulang: formatTime(a.checkOut?.time),
        Jam_Kerja: a.workHours || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detail Attendance");
      XLSX.writeFile(wb, `attendance_detail_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  const exportDetailPDF = async () => {
    setExporting("detail-pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      autoTable(doc, {
        head: [["Nama", "Dept", "Jabatan", "Tanggal", "Masuk", "Pulang", "Jam Kerja"]],
        body: filtered.map((a) => [
          a.name,
          a.department,
          a.jabatan,
          formatDate(a.date),
          formatTime(a.checkIn?.time),
          formatTime(a.checkOut?.time),
          a.workHours || "-",
        ]),
        headStyles: { fillColor: [5, 150, 105] },
      });
      doc.save(`attendance_detail_${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const exportRecapExcel = async () => {
    setExporting("recap-excel");
    try {
      const rows = recapList.map((r: any) => ({
        Nama: r.name,
        Department: r.department,
        Jabatan: r.jabatan,
        Hari_Kerja: r.totalHari,
        Rate: r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
        Total_Gaji: r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
      XLSX.writeFile(wb, `attendance_rekap_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setExporting(null);
    }
  };

  const exportRecapPDF = async () => {
    setExporting("recap-pdf");
    try {
      const doc = new jsPDF();
      autoTable(doc, {
        head: [["Nama", "Dept", "Jabatan", "Hari", "Rate", "Total"]],
        body: recapList.map((r: any) => [
          r.name,
          r.department,
          r.jabatan,
          r.totalHari,
          r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
          r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
        ]),
        headStyles: { fillColor: [5, 150, 105] },
      });
      doc.save(`attendance_rekap_${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Attendance Management
            </h1>
            <p className="text-gray-500 mt-1">Manage and monitor employee attendance records</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Real-time updates</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Total Records</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Hadir</p>
                <p className="text-2xl font-bold text-green-800">{stats.hadir}</p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-yellow-600">Terlambat</p>
                <p className="text-2xl font-bold text-yellow-800">{stats.terlambat}</p>
              </div>
              <span className="text-3xl">⏰</span>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Data
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <select
              value={tempDept}
              onChange={(e) => setTempDept(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
            >
              {deptList.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={tempJabatan}
              onChange={(e) => setTempJabatan(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
            >
              {jabatanList.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
            <select
              value={tempEmployee}
              onChange={(e) => setTempEmployee(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Employees</option>
              {employeeList.map((uid) =>
                uid !== "ALL" && (
                  <option key={uid} value={uid}>
                    {users[uid]?.name}
                  </option>
                )
              )}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                placeholder="End Date"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={setPayrollPeriod}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              📅 Periode 26-25
            </button>
            <button
              onClick={applyFilter}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ✓ Apply Filter
            </button>
            <button
              onClick={resetFilter}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Data
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportDetailExcel}
              disabled={exporting !== null}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "detail-excel" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📊</span>
              )}
              Detail Excel
            </button>
            <button
              onClick={exportDetailPDF}
              disabled={exporting !== null}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "detail-pdf" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📄</span>
              )}
              Detail PDF
            </button>
            <button
              onClick={exportRecapExcel}
              disabled={exporting !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "recap-excel" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📊</span>
              )}
              Rekap Excel
            </button>
            <button
              onClick={exportRecapPDF}
              disabled={exporting !== null}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "recap-pdf" ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📄</span>
              )}
              Rekap PDF
            </button>
          </div>
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>📋</span>
              Detail Attendance
            </h2>
            <span className="text-sm text-gray-500">{filtered.length} records found</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Dept</th>
                  <th className="px-4 py-3 text-left">Jabatan</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Masuk</th>
                  <th className="px-4 py-3 text-left">Pulang</th>
                  <th className="px-4 py-3 text-left">Jam Kerja</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((a, idx) => (
                  <tr key={a.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3">{a.department}</td>
                    <td className="px-4 py-3">{a.jabatan}</td>
                    <td className="px-4 py-3">{formatDate(a.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${a.checkIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {formatTime(a.checkIn?.time)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${a.checkOut ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {formatTime(a.checkOut?.time)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{a.workHours || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-lg font-medium">No data found</p>
              </div>
            )}
            {filtered.length > 100 && (
              <div className="p-4 text-center text-gray-500 text-sm border-t">
                Showing 100 of {filtered.length} records. Export to see all data.
              </div>
            )}
          </div>
        </div>

        {/* Recap Table */}
        {recapList.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>💰</span>
                Salary Recap (Casual / DW)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Dept</th>
                    <th className="px-4 py-3 text-left">Jabatan</th>
                    <th className="px-4 py-3 text-left">Hari Kerja</th>
                    <th className="px-4 py-3 text-left">Rate</th>
                    <th className="px-4 py-3 text-left">Total Gaji</th>
                  </tr>
                </thead>
                <tbody>
                  {recapList.map((r: any, idx: number) => (
                    <tr key={r.name} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{r.department}</td>
                      <td className="px-4 py-3">{r.jabatan}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-blue-600">{r.totalHari}</span> hari
                      </td>
                      <td className="px-4 py-3">Rp {r.rate?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-green-600">Rp {r.totalGaji?.toLocaleString() || 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}