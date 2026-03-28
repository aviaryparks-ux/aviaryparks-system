// app/(admin)/attendance/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ProtectedRoute from "@/components/ProtectedRoute";

// ================= TYPE DEFINITIONS =================
type User = {
  name: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  email?: string;
  role?: string;
};

type Attendance = {
  id: string;
  uid: string;
  name: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  date: any;
  checkIn?: {
    time: any;
    location?: string;
    note?: string;
  };
  checkOut?: {
    time: any;
    location?: string;
    note?: string;
  };
  workHours?: string;
  status?: string;
};

type RecapItem = {
  uid: string;
  name: string;
  department: string;
  jabatan: string;
  rate: number;
  totalHari: number;
  totalJam: number;
  totalGaji: number;
  attendanceDetails: Attendance[];
};

// ================= HELPER FUNCTIONS =================
const formatDate = (timestamp: any, locale: string = "id-ID"): string => {
  if (!timestamp?.toDate) return "-";
  const date = timestamp.toDate();
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (timestamp: any): string => {
  if (!timestamp?.toDate) return "--:--";
  return timestamp.toDate().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const onlyDate = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/**
 * Menghitung total jam kerja dari checkIn dan checkOut
 * @returns jumlah jam dalam format desimal (contoh: 8.5 untuk 8 jam 30 menit)
 */
const calculateWorkHoursFromTime = (checkIn: any, checkOut: any): number => {
  if (!checkIn?.time || !checkOut?.time) return 0;
  
  try {
    const masuk = checkIn.time.toDate();
    const pulang = checkOut.time.toDate();
    
    // Validasi waktu
    if (pulang <= masuk) return 0;
    
    // Hitung selisih dalam milidetik
    const diffMs = pulang.getTime() - masuk.getTime();
    // Konversi ke jam
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Bulatkan ke 2 desimal untuk akurasi
    return Math.round(diffHours * 100) / 100;
  } catch (error) {
    console.error("Error calculating work hours:", error);
    return 0;
  }
};

/**
 * Mendapatkan total jam kerja dengan prioritas:
 * 1. Menggunakan workHours jika tersedia dan valid
 * 2. Menghitung dari checkIn/checkOut jika workHours tidak tersedia
 */
const getWorkHours = (attendance: Attendance): number => {
  // Prioritas 1: Gunakan workHours yang sudah tersimpan
  if (attendance.workHours && attendance.workHours !== "-") {
    // Coba parse sebagai angka desimal
    const hours = parseFloat(attendance.workHours);
    if (!isNaN(hours) && hours > 0) {
      return hours;
    }
    
    // Jika formatnya "8 jam" atau "8 jam 30 menit"
    const hourMatch = attendance.workHours.match(/(\d+(?:[.,]\d+)?)/);
    if (hourMatch) {
      const parsed = parseFloat(hourMatch[1].replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  
  // Prioritas 2: Hitung dari checkIn dan checkOut
  return calculateWorkHoursFromTime(attendance.checkIn, attendance.checkOut);
};

/**
 * Format jam kerja untuk ditampilkan
 */
const formatWorkHours = (hours: number): string => {
  if (hours === 0) return "-";
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} jam`;
  }
  return `${wholeHours} jam ${minutes} menit`;
};

export default function AttendancePage() {
  // ================= STATE =================
  const [data, setData] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // ================= LOAD USERS =================
  useEffect(() => {
    setUsersLoading(true);
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const obj: Record<string, User> = {};
        snap.forEach((doc) => {
          obj[doc.id] = doc.data() as User;
        });
        setUsers(obj);
        setUsersLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error loading users:", err);
        setError("Gagal memuat data pengguna");
        setUsersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ================= LOAD ATTENDANCE =================
  useEffect(() => {
    if (usersLoading) return;
    
    setLoading(true);
    const q = query(collection(db, "attendance"), orderBy("date", "desc"));
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Attendance[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          const user = users[d.uid] || {};
          arr.push({
            id: doc.id,
            ...d,
            name: user.name || d.name || "-",
            department: user.department || d.department || "-",
            jabatan: user.jabatan || d.jabatan || "-",
            dailyRate: user.dailyRate || d.dailyRate || 0,
          } as Attendance);
        });
        setData(arr);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error loading attendance:", err);
        setError("Gagal memuat data absensi");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [users, usersLoading]);

  // ================= FILTERED DATA (MEMOIZED) =================
  const filtered = useMemo(() => {
    return data.filter((a) => {
      let ok = true;
      
      if (dept !== "ALL") {
        ok = ok && a.department === dept;
      }
      if (jabatan !== "ALL") {
        ok = ok && a.jabatan === jabatan;
      }
      if (employee !== "ALL") {
        ok = ok && a.uid === employee;
      }
      if (startDate) {
        ok = ok && onlyDate(a.date.toDate()) >= onlyDate(new Date(startDate));
      }
      if (endDate) {
        ok = ok && onlyDate(a.date.toDate()) <= onlyDate(new Date(endDate));
      }
      
      return ok;
    });
  }, [data, dept, jabatan, employee, startDate, endDate]);

  // ================= REKAP DATA (MEMOIZED) =================
  const recapList = useMemo(() => {
    const recap: Record<string, RecapItem> = {};
    
    filtered.forEach((a) => {
      if (!recap[a.uid]) {
        recap[a.uid] = {
          uid: a.uid,
          name: a.name,
          department: a.department || "-",
          jabatan: a.jabatan || "-",
          rate: a.dailyRate || 0,
          totalHari: 0,
          totalJam: 0,
          totalGaji: 0,
          attendanceDetails: [],
        };
      }
      
      // Hitung hanya jika checkIn ada (hadir)
      if (a.checkIn) {
        recap[a.uid].totalHari++;
        
        // Hitung jam kerja dengan fungsi yang sudah diperbaiki
        const jamKerja = getWorkHours(a);
        recap[a.uid].totalJam += jamKerja;
        
        // Simpan detail untuk keperluan debugging jika perlu
        recap[a.uid].attendanceDetails.push(a);
      }
      
      // Hitung total gaji
      recap[a.uid].totalGaji = recap[a.uid].totalHari * (recap[a.uid].rate || 0);
    });
    
    // Sort by total gaji tertinggi
    return Object.values(recap).sort((a, b) => b.totalGaji - a.totalGaji);
  }, [filtered]);

  // ================= STATISTIK =================
  const stats = useMemo(() => {
    const total = filtered.length;
    const hadir = filtered.filter((a) => a.checkIn).length;
    const terlambat = filtered.filter((a) => {
      if (!a.checkIn) return false;
      const hour = a.checkIn.time?.toDate().getHours();
      return hour && hour > 8;
    }).length;
    
    return { total, hadir, terlambat };
  }, [filtered]);

  // ================= FILTER OPTIONS =================
  const deptList = useMemo(() => {
    return [
      "ALL",
      ...new Set(Object.values(users).map((u) => u.department).filter(Boolean)),
    ];
  }, [users]);

  const jabatanList = useMemo(() => {
    return [
      "ALL",
      ...new Set(Object.values(users).map((u) => u.jabatan).filter(Boolean)),
    ];
  }, [users]);

  const employeeList = useMemo(() => {
    return ["ALL", ...new Set(data.map((a) => a.uid))];
  }, [data]);

  // ================= FILTER HANDLERS =================
  const setPayrollPeriod = useCallback(() => {
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
  }, []);

  const applyFilter = useCallback(() => {
    // Validasi tanggal
    if (tempStartDate && tempEndDate && new Date(tempStartDate) > new Date(tempEndDate)) {
      alert("Tanggal mulai harus lebih kecil dari tanggal akhir");
      return;
    }
    
    setDept(tempDept);
    setJabatan(tempJabatan);
    setEmployee(tempEmployee);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  }, [tempDept, tempJabatan, tempEmployee, tempStartDate, tempEndDate]);

  const resetFilter = useCallback(() => {
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
  }, []);

  // ================= EXPORT FUNCTIONS =================
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
        Jam_Kerja: a.workHours || formatWorkHours(getWorkHours(a)),
        Status: a.checkIn ? "Hadir" : "Tidak Hadir",
      }));
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detail Attendance");
      XLSX.writeFile(wb, `attendance_detail_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengexport data");
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
          a.workHours || formatWorkHours(getWorkHours(a)),
        ]),
        headStyles: { fillColor: [5, 150, 105] },
      });
      doc.save(`attendance_detail_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  const exportRecapExcel = async () => {
    setExporting("recap-excel");
    try {
      const rows = recapList.map((r) => ({
        Nama: r.name,
        Department: r.department,
        Jabatan: r.jabatan,
        Hari_Kerja: r.totalHari,
        Total_Jam: `${r.totalJam} jam`,
        Rata_Rata_Jam: r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-",
        Rate: r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
        Total_Gaji: r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
      }));
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
      XLSX.writeFile(wb, `attendance_rekap_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  const exportRecapPDF = async () => {
    setExporting("recap-pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      autoTable(doc, {
        head: [["Nama", "Dept", "Jabatan", "Hari", "Total Jam", "Rata-rata", "Rate", "Total Gaji"]],
        body: recapList.map((r) => [
          r.name,
          r.department,
          r.jabatan,
          r.totalHari,
          `${r.totalJam} jam`,
          r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-",
          r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
          r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
        ]),
        headStyles: { fillColor: [5, 150, 105] },
      });
      doc.save(`attendance_rekap_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  // ================= RENDER LOADING =================
  if (loading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      </div>
    );
  }

  // ================= RENDER ERROR =================
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-200">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // ================= MAIN RENDER =================
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Manajemen Absensi
            </h1>
            <p className="text-gray-500 mt-1">Kelola dan monitor data kehadiran karyawan</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Data real-time</span>
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
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              {deptList.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={tempJabatan}
              onChange={(e) => setTempJabatan(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              {jabatanList.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
            <select
              value={tempEmployee}
              onChange={(e) => setTempEmployee(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="ALL">Semua Karyawan</option>
              {employeeList.map((uid) =>
                uid !== "ALL" && (
                  <option key={uid} value={uid}>
                    {users[uid]?.name || uid}
                  </option>
                )
              )}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                placeholder="Tanggal Mulai"
              />
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                placeholder="Tanggal Akhir"
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
              ✓ Terapkan Filter
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
              Detail Absensi
            </h2>
            <span className="text-sm text-gray-500">{filtered.length} record ditemukan</span>
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
                {filtered.slice(0, 100).map((a, idx) => {
                  const workHours = getWorkHours(a);
                  return (
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
                      <td className="px-4 py-3 font-mono">
                        {workHours > 0 ? formatWorkHours(workHours) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-lg font-medium">Tidak ada data ditemukan</p>
                <p className="text-sm mt-1">Coba ubah filter atau periode yang dipilih</p>
              </div>
            )}
            {filtered.length > 100 && (
              <div className="p-4 text-center text-gray-500 text-sm border-t">
                Menampilkan 100 dari {filtered.length} record. Export untuk melihat semua data.
              </div>
            )}
          </div>
        </div>

        {/* Recap Table with Total Jam */}
        {recapList.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>💰</span>
                Rekap Gaji (Harian / Borongan)
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
                    <th className="px-4 py-3 text-left">Total Jam</th>
                    <th className="px-4 py-3 text-left">Rata-rata Jam</th>
                    <th className="px-4 py-3 text-left">Rate</th>
                    <th className="px-4 py-3 text-left">Total Gaji</th>
                  </tr>
                </thead>
                <tbody>
                  {recapList.map((r, idx) => (
                    <tr key={r.uid} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{r.department}</td>
                      <td className="px-4 py-3">{r.jabatan}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-blue-600">{r.totalHari}</span> hari
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-green-600">{r.totalJam.toFixed(2)}</span> jam
                      </td>
                      <td className="px-4 py-3">
                        {r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-"}
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