// app/admin/payroll/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import * as XLSX from "xlsx";

type User = {
  uid: string;
  name: string;
  email: string;
  dailyRate: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  jabatan: string;
  department: string;
};

type AttendanceRecord = {
  id: string;
  uid: string;
  name: string;
  email: string;
  date: Timestamp;
  shift: any;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  checkIn?: {
    time: Timestamp;
    photo?: string;
  };
  checkOut?: {
    time: Timestamp;
    photo?: string;
  };
  distance?: number;
};

type PayrollSummary = {
  uid: string;
  name: string;
  email: string;
  jabatan: string;
  department: string;
  dailyRate: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  totalDays: number;
  totalHours: number;
  totalSalary: number;
  attendanceDetails: {
    date: string;
    checkIn: string;
    checkOut: string;
    workHours: number;
  }[];
};

export default function PayrollPage() {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary[]>([]);
  const [filteredSummary, setFilteredSummary] = useState<PayrollSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollSummary | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadUsers();
    loadAttendanceData();
  }, [dateRange]);

  useEffect(() => {
    applyDepartmentFilter();
  }, [selectedDepartment, payrollSummary]);

  const loadUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap = new Map<string, User>();
      const deptSet = new Set<string>();
      
      usersSnap.forEach((doc) => {
        const data = doc.data();
        const department = data.department || "";
        if (department) deptSet.add(department);
        
        usersMap.set(doc.id, {
          uid: doc.id,
          name: data.name || "",
          email: data.email || "",
          dailyRate: data.dailyRate || 0,
          bankName: data.bankName || "",
          bankAccountNumber: data.bankAccountNumber || "",
          bankAccountName: data.bankAccountName || "",
          jabatan: data.jabatan || "",
          department: department,
        });
      });
      
      setUsers(usersMap);
      setDepartments(Array.from(deptSet).sort());
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const applyDepartmentFilter = () => {
    if (selectedDepartment === "ALL") {
      setFilteredSummary(payrollSummary);
    } else {
      const filtered = payrollSummary.filter(
        (item) => item.department === selectedDepartment
      );
      setFilteredSummary(filtered);
    }
  };

  const loadAttendanceData = async () => {
    setIsLoading(true);
    try {
      const startDateTime = new Date(dateRange.startDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(dateRange.endDate);
      endDateTime.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "attendance"),
        where("date", ">=", Timestamp.fromDate(startDateTime)),
        where("date", "<=", Timestamp.fromDate(endDateTime)),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];

      setAttendances(data);
      calculatePayrollSummary(data);
    } catch (error) {
      console.error("Error loading attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePayrollSummary = (data: AttendanceRecord[]) => {
    const summaryMap = new Map<string, PayrollSummary>();

    data.forEach((att) => {
      if (!att.checkIn?.time || !att.checkOut?.time) return;

      const uid = att.uid;
      const user = users.get(uid);

      const dailyRate = user?.dailyRate || 0;
      const department = user?.department || "";

      const checkInTime = att.checkIn.time.toDate();
      const checkOutTime = att.checkOut.time.toDate();
      
      const workHours =
        (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const dateStr = att.date.toDate().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const checkInStr = checkInTime.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const checkOutStr = checkOutTime.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!summaryMap.has(uid)) {
        summaryMap.set(uid, {
          uid: uid,
          name: att.name,
          email: att.email,
          jabatan: user?.jabatan || "-",
          department: department,
          dailyRate: dailyRate,
          bankName: att.bankAccount?.bankName || user?.bankName || "-",
          bankAccountNumber:
            att.bankAccount?.accountNumber || user?.bankAccountNumber || "-",
          bankAccountName:
            att.bankAccount?.accountName || user?.bankAccountName || "-",
          totalDays: 0,
          totalHours: 0,
          totalSalary: 0,
          attendanceDetails: [],
        });
      }

      const existing = summaryMap.get(uid)!;
      existing.totalDays += 1;
      existing.totalHours += workHours;
      existing.totalSalary = existing.totalDays * dailyRate;
      existing.attendanceDetails.push({
        date: dateStr,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        workHours: workHours,
      });
    });

    const result = Array.from(summaryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPayrollSummary(result);
  };

  const exportToExcel = () => {
  const excelData = filteredSummary.map((item, index) => ({
    No: index + 1,  // ← number, bukan string
    "Nama Karyawan": item.name,
    Email: item.email,
    Departemen: item.department,
    Jabatan: item.jabatan,
    "Rate Harian": `Rp ${item.dailyRate.toLocaleString()}`,
    Bank: item.bankName,
    "Nomor Rekening": item.bankAccountNumber,
    "Nama Pemilik": item.bankAccountName,
    "Total Hari Kerja": item.totalDays,
    "Total Jam Kerja": item.totalHours.toFixed(1),
    "Total Gaji": `Rp ${item.totalSalary.toLocaleString()}`,
  }));

  const totalSalary = filteredSummary.reduce(
    (sum, item) => sum + item.totalSalary,
    0
  );
  const totalDays = filteredSummary.reduce(
    (sum, item) => sum + item.totalDays,
    0
  );
  const totalHours = filteredSummary.reduce(
    (sum, item) => sum + item.totalHours,
    0
  );

  // 🔥 PERBAIKAN: Gunakan angka untuk No, bukan string kosong
  excelData.push({
    No: excelData.length + 1,  // ← number, bukan string kosong
    "Nama Karyawan": "TOTAL",
    Email: "",
    Departemen: "",
    Jabatan: "",
    "Rate Harian": "",
    Bank: "",
    "Nomor Rekening": "",
    "Nama Pemilik": "",
    "Total Hari Kerja": totalDays,
    "Total Jam Kerja": totalHours.toFixed(1),
    "Total Gaji": `Rp ${totalSalary.toLocaleString()}`,
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
  
  const fileName = selectedDepartment === "ALL" 
    ? `rekap_gaji_${dateRange.startDate}_${dateRange.endDate}.xlsx`
    : `rekap_gaji_${selectedDepartment}_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
  
  XLSX.writeFile(wb, fileName);
};

  const exportDetailToExcel = (employee: PayrollSummary) => {
  const detailData = employee.attendanceDetails.map((item, index) => ({
    No: index + 1,  // ← number
    Tanggal: item.date,
    "Jam Masuk": item.checkIn,
    "Jam Pulang": item.checkOut,
    "Jam Kerja": item.workHours.toFixed(1),
  }));

  // 🔥 PERBAIKAN: Gunakan angka untuk No
  detailData.push({
    No: detailData.length + 1,  // ← number
    Tanggal: "TOTAL",
    "Jam Masuk": "",
    "Jam Pulang": "",
    "Jam Kerja": employee.totalHours.toFixed(1),
  });

  const ws = XLSX.utils.json_to_sheet(detailData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Detail_${employee.name}`);
  XLSX.writeFile(wb, `detail_absensi_${employee.name}.xlsx`);
};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h} jam`;
    return `${h} jam ${m} menit`;
  };

  const totalFilteredSalary = filteredSummary.reduce((sum, item) => sum + item.totalSalary, 0);
  const totalFilteredDays = filteredSummary.reduce((sum, item) => sum + item.totalDays, 0);
  const totalFilteredHours = filteredSummary.reduce((sum, item) => sum + item.totalHours, 0);
  const totalFilteredEmployees = filteredSummary.length;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr", "finance"]}>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white mb-6">
            <h1 className="text-2xl font-bold">💰 Rekap Gaji Karyawan</h1>
            <p className="text-blue-100 mt-1">
              Rekap gaji berdasarkan data absensi dan rate harian masing-masing karyawan
            </p>
          </div>

          {/* Filter */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, startDate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, endDate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📁 Filter Departemen
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">📋 Semua Departemen</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      🏢 {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    loadUsers();
                    loadAttendanceData();
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🔍 Tampilkan
                </button>
                <button
                  onClick={exportToExcel}
                  disabled={filteredSummary.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  📊 Export Excel
                </button>
              </div>
            </div>
            
            {selectedDepartment !== "ALL" && (
              <div className="mt-3 text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
                📁 Menampilkan data untuk departemen: <strong>{selectedDepartment}</strong>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-2xl font-bold">{totalFilteredEmployees} orang</div>
              <div className="text-sm text-gray-500">
                {selectedDepartment === "ALL" ? "Total Karyawan" : `Karyawan ${selectedDepartment}`}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-3xl mb-2">📆</div>
              <div className="text-2xl font-bold">{totalFilteredDays} hari</div>
              <div className="text-sm text-gray-500">Total Hari Kerja</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-3xl mb-2">⏰</div>
              <div className="text-2xl font-bold">{formatTime(totalFilteredHours)}</div>
              <div className="text-sm text-gray-500">Total Jam Kerja</div>
            </div>
            <div className="bg-green-50 rounded-xl shadow-md p-6 border border-green-200">
              <div className="text-3xl mb-2">💰</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(totalFilteredSalary)}
              </div>
              <div className="text-sm text-green-600">Total Gaji</div>
            </div>
          </div>

          {/* Tabel Rekap Gaji */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    Detail Rekap Gaji
                    {selectedDepartment !== "ALL" && (
                      <span className="ml-2 text-sm font-normal text-blue-600">
                        - Departemen {selectedDepartment}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Klik pada baris untuk melihat detail absensi harian
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  Menampilkan {filteredSummary.length} dari {payrollSummary.length} karyawan
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-2 text-gray-500">Memuat data...</p>
              </div>
            ) : filteredSummary.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-2">📭</div>
                <p>
                  {selectedDepartment !== "ALL"
                    ? `Tidak ada data absensi untuk departemen ${selectedDepartment} dalam periode ini`
                    : "Tidak ada data absensi dalam periode ini"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">No</th>
                      <th className="px-4 py-3 text-left">Nama Karyawan</th>
                      <th className="px-4 py-3 text-left">Departemen</th>
                      <th className="px-4 py-3 text-left">Jabatan</th>
                      <th className="px-4 py-3 text-right">Rate Harian</th>
                      <th className="px-4 py-3 text-left">Bank</th>
                      <th className="px-4 py-3 text-left">No. Rekening</th>
                      <th className="px-4 py-3 text-center">Hari</th>
                      <th className="px-4 py-3 text-center">Jam Kerja</th>
                      <th className="px-4 py-3 text-right bg-green-50">Total Gaji</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSummary.map((item, index) => (
                      <tr
                        key={item.uid}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedEmployee(item);
                          setShowDetailModal(true);
                        }}
                      >
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                            {item.department || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{item.jabatan}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(item.dailyRate)}
                        </td>
                        <td className="px-4 py-3">{item.bankName}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.bankAccountNumber}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {item.totalDays} hari
                        </td>
                        <td className="px-4 py-3 text-center">
                          {formatTime(item.totalHours)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                          {formatCurrency(item.totalSalary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-right">TOTAL</td>
                      <td className="px-4 py-3 text-center">{totalFilteredDays} hari</td>
                      <td className="px-4 py-3 text-center">{formatTime(totalFilteredHours)}</td>
                      <td className="px-4 py-3 text-right bg-green-100">
                        {formatCurrency(totalFilteredSalary)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Karyawan Tanpa Rate */}
          {filteredSummary.filter((item) => item.dailyRate === 0).length > 0 && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-medium text-red-800">
                    Perhatian: Ada karyawan dengan Rate Harian 0
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Karyawan berikut belum diisi rate hariannya:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                    {filteredSummary
                      .filter((item) => item.dailyRate === 0)
                      .map((item) => (
                        <li key={item.uid}>
                          {item.name} ({item.department || "No Dept"}) - Silakan edit di menu Users
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Catatan untuk Finance */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-medium text-yellow-800">Catatan untuk Bagian Keuangan</p>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  <li>• Rate harian diambil dari data masing-masing karyawan (menu Users)</li>
                  <li>• Perhitungan gaji = Rate Harian × Total Hari Kerja</li>
                  <li>• Jam kerja dihitung berdasarkan data check-in dan check-out yang valid</li>
                  <li>• Gunakan filter departemen untuk melihat rekap per divisi</li>
                  <li>• Nomor rekening di atas adalah data yang diinput oleh karyawan/admin</li>
                  <li>• Harap melakukan verifikasi ulang sebelum transfer gaji</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DETAIL ABSENSI */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Detail Absensi {selectedEmployee.name}</h2>
                <p className="text-blue-100 text-sm">{selectedEmployee.department} - {selectedEmployee.jabatan}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-200">✕</button>
            </div>

            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Hari Kerja</p>
                  <p className="text-xl font-bold">{selectedEmployee.totalDays} hari</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Jam Kerja</p>
                  <p className="text-xl font-bold">{formatTime(selectedEmployee.totalHours)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Rate Harian</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedEmployee.dailyRate)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">Total Gaji</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(selectedEmployee.totalSalary)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-center">Jam Masuk</th>
                      <th className="px-3 py-2 text-center">Jam Pulang</th>
                      <th className="px-3 py-2 text-right">Jam Kerja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedEmployee.attendanceDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{item.date}</td>
                        <td className="px-3 py-2 text-center font-mono">{item.checkIn}</td>
                        <td className="px-3 py-2 text-center font-mono">{item.checkOut}</td>
                        <td className="px-3 py-2 text-right">{formatTime(item.workHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-center">-</td>
                      <td className="px-3 py-2 text-center">-</td>
                      <td className="px-3 py-2 text-right">{formatTime(selectedEmployee.totalHours)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => exportDetailToExcel(selectedEmployee)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                📊 Export Detail Excel
              </button>
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}