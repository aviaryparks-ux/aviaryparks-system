// app/admin/payroll/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import toast from "react-hot-toast";

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
  
  // 🔥 STATE UNTUK SEARCHABLE DROPDOWN KARYAWAN
  const [allEmployees, setAllEmployees] = useState<{ uid: string; name: string; department: string }[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<{ uid: string; name: string; department: string }[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollSummary | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 🔥 Update available employees berdasarkan department yang dipilih
  useEffect(() => {
    if (selectedDepartment === "ALL") {
      setAvailableEmployees(allEmployees);
    } else {
      setAvailableEmployees(
        allEmployees.filter((emp) => emp.department === selectedDepartment)
      );
    }
    // Reset selected employees ketika department berubah
    setSelectedEmployees([]);
    setEmployeeSearchTerm("");
  }, [selectedDepartment, allEmployees]);

  // 🔥 Filter karyawan berdasarkan search term
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) return availableEmployees;
    return availableEmployees.filter((emp) =>
      emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    );
  }, [availableEmployees, employeeSearchTerm]);

  // Click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadUsers();
    loadAttendanceData();
  }, [dateRange]);

  useEffect(() => {
    applyFilters();
  }, [selectedDepartment, selectedEmployees, payrollSummary]);

  const loadUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap = new Map<string, User>();
      const deptSet = new Set<string>();
      const empList: { uid: string; name: string; department: string }[] = [];
      
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
        
        // 🔥 Tambahkan ke daftar karyawan untuk filter
        if (data.isActive !== false) {
          empList.push({
            uid: doc.id,
            name: data.name || "",
            department: department,
          });
        }
      });
      
      setUsers(usersMap);
      setDepartments(Array.from(deptSet).sort());
      setAllEmployees(empList.sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableEmployees(empList);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Gagal memuat data karyawan");
    }
  };

  const applyFilters = () => {
    let filtered = [...payrollSummary];
    
    if (selectedDepartment !== "ALL") {
      filtered = filtered.filter((item) => item.department === selectedDepartment);
    }
    
    if (selectedEmployees.length > 0) {
      filtered = filtered.filter((item) => selectedEmployees.includes(item.uid));
    }
    
    setFilteredSummary(filtered);
  };

  const toggleEmployeeSelection = (uid: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllEmployees = () => {
    const allUids = availableEmployees.map((emp) => emp.uid);
    setSelectedEmployees(allUids);
  };

  const clearEmployeeSelection = () => {
    setSelectedEmployees([]);
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

      calculatePayrollSummary(data);
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast.error("Gagal memuat data absensi");
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
          name: att.name || user?.name || "-",
          email: att.email || user?.email || "-",
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
    if (filteredSummary.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const excelData = filteredSummary.map((item, index) => ({
      No: index + 1,
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

    excelData.push({
      No: excelData.length + 1,
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
    
    const fileName = selectedEmployees.length === 1 
      ? `rekap_gaji_${filteredSummary[0]?.name}_${dateRange.startDate}_${dateRange.endDate}.xlsx`
      : selectedDepartment !== "ALL" 
        ? `rekap_gaji_${selectedDepartment}_${dateRange.startDate}_${dateRange.endDate}.xlsx`
        : `rekap_gaji_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success("Export Excel berhasil");
  };

  const exportDetailToExcel = (employee: PayrollSummary) => {
    const detailData = employee.attendanceDetails.map((item, index) => ({
      No: index + 1,
      Tanggal: item.date,
      "Jam Masuk": item.checkIn,
      "Jam Pulang": item.checkOut,
      "Jam Kerja": item.workHours.toFixed(1),
    }));

    detailData.push({
      No: detailData.length + 1,
      Tanggal: "TOTAL",
      "Jam Masuk": "",
      "Jam Pulang": "",
      "Jam Kerja": employee.totalHours.toFixed(1),
    });

    const ws = XLSX.utils.json_to_sheet(detailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Detail_${employee.name}`);
    XLSX.writeFile(wb, `detail_absensi_${employee.name}.xlsx`);
    toast.success(`Export detail ${employee.name} berhasil`);
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

  const getSelectedEmployeeNames = () => {
    if (selectedEmployees.length === 0) return "Semua Karyawan";
    if (selectedEmployees.length === 1) {
      const emp = allEmployees.find(e => e.uid === selectedEmployees[0]);
      return emp ? emp.name : "1 karyawan";
    }
    return `${selectedEmployees.length} karyawan terpilih`;
  };

  const totalFilteredSalary = filteredSummary.reduce((sum, item) => sum + item.totalSalary, 0);
  const totalFilteredDays = filteredSummary.reduce((sum, item) => sum + item.totalDays, 0);
  const totalFilteredHours = filteredSummary.reduce((sum, item) => sum + item.totalHours, 0);
  const totalFilteredEmployees = filteredSummary.length;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr", "finance"]}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Rekap Gaji Karyawan</h1>
                <p className="text-blue-100 mt-1">
                  Rekap gaji berdasarkan data absensi dan rate harian masing-masing karyawan
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div><p className="text-sm text-blue-600 font-medium">Total Karyawan</p><p className="text-3xl font-bold text-gray-800 mt-1">{totalFilteredEmployees} orang</p></div>
              <div className="rounded-xl bg-blue-100 p-3"><span className="text-2xl">👥</span></div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div><p className="text-sm text-green-600 font-medium">Total Hari Kerja</p><p className="text-3xl font-bold text-gray-800 mt-1">{totalFilteredDays} hari</p></div>
              <div className="rounded-xl bg-green-100 p-3"><span className="text-2xl">📆</span></div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-yellow-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div><p className="text-sm text-yellow-600 font-medium">Total Jam Kerja</p><p className="text-3xl font-bold text-gray-800 mt-1">{formatTime(totalFilteredHours)}</p></div>
              <div className="rounded-xl bg-yellow-100 p-3"><span className="text-2xl">⏰</span></div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div><p className="text-sm text-purple-600 font-medium">Total Gaji</p><p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(totalFilteredSalary)}</p></div>
              <div className="rounded-xl bg-purple-100 p-3"><span className="text-2xl">💰</span></div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
          <h2 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Data
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">📅 Tanggal Mulai</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">📅 Tanggal Akhir</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">🏢 Filter Departemen</label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="ALL">📋 Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>🏢 {dept}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  loadUsers();
                  loadAttendanceData();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                🔍 Tampilkan
              </button>
              <button
                onClick={exportToExcel}
                disabled={filteredSummary.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                📊 Export Excel
              </button>
            </div>
          </div>

          {/* 🔥 SEARCHABLE DROPDOWN KARYAWAN */}
          <div className="mt-3" ref={dropdownRef}>
            <label className="block text-xs text-gray-500 mb-1">👥 Pilih Karyawan</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-lg bg-white flex justify-between items-center"
              >
                <span className={selectedEmployees.length === 0 ? "text-gray-400" : "text-gray-700"}>
                  {getSelectedEmployeeNames()}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showEmployeeDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showEmployeeDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="🔍 Ketik nama karyawan..."
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <div className="p-2 border-b border-gray-100 bg-gray-50 flex gap-2">
                    <button
                      onClick={selectAllEmployees}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Pilih Semua ({availableEmployees.length})
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={clearEmployeeSelection}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Reset
                    </button>
                    <span className="text-gray-300 ml-auto text-xs text-gray-400">
                      {filteredEmployees.length} karyawan
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        {employeeSearchTerm ? "Karyawan tidak ditemukan" : "Tidak ada karyawan di departemen ini"}
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <label
                          key={emp.uid}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(emp.uid)}
                            onChange={() => toggleEmployeeSelection(emp.uid)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700">{emp.name}</span>
                          {selectedDepartment === "ALL" && (
                            <span className="text-xs text-gray-400 ml-auto">{emp.department}</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected employees tags */}
            {selectedEmployees.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedEmployees.slice(0, 5).map((uid) => {
                  const emp = allEmployees.find(e => e.uid === uid);
                  return emp ? (
                    <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {emp.name}
                      <button
                        onClick={() => toggleEmployeeSelection(uid)}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
                {selectedEmployees.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{selectedEmployees.length - 5} lainnya
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Informasi filter aktif */}
          {(selectedDepartment !== "ALL" || selectedEmployees.length > 0) && (
            <div className="mt-3 text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
              🔍 Filter aktif: 
              {selectedDepartment !== "ALL" && <span> Departemen: <strong>{selectedDepartment}</strong></span>}
              {selectedEmployees.length > 0 && (
                <span> {selectedEmployees.length} karyawan terpilih</span>
              )}
            </div>
          )}
        </div>

        {/* Tabel Rekap Gaji */}
        <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <span>💰</span>
                  Detail Rekap Gaji
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
                {selectedEmployees.length === 1
                  ? `Tidak ada data absensi untuk karyawan yang dipilih dalam periode ini`
                  : selectedDepartment !== "ALL"
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
                      <td className="px-4 py-3 text-right">{formatCurrency(item.dailyRate)}</td>
                      <td className="px-4 py-3">{item.bankName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.bankAccountNumber}</td>
                      <td className="px-4 py-3 text-center font-medium">{item.totalDays} hari</td>
                      <td className="px-4 py-3 text-center">{formatTime(item.totalHours)}</td>
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
                    <td className="px-4 py-3 text-right bg-green-100">{formatCurrency(totalFilteredSalary)}</td>
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
                <p className="font-medium text-red-800">Perhatian: Ada karyawan dengan Rate Harian 0</p>
                <p className="text-sm text-red-700 mt-1">Karyawan berikut belum diisi rate hariannya:</p>
                <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                  {filteredSummary
                    .filter((item) => item.dailyRate === 0)
                    .map((item) => (
                      <li key={item.uid}>{item.name} ({item.department || "No Dept"}) - Silakan edit di menu Users</li>
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
                <li>• Gunakan filter karyawan untuk rekap spesifik (bisa ketik nama)</li>
                <li>• Filter departemen akan otomatis membatasi pilihan karyawan</li>
                <li>• Nomor rekening di atas adalah data yang diinput oleh karyawan/admin</li>
                <li>• Harap melakukan verifikasi ulang sebelum transfer gaji</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DETAIL ABSENSI (sama) */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Detail Absensi {selectedEmployee.name}</h2>
                <p className="text-blue-100 text-sm">{selectedEmployee.department} - {selectedEmployee.jabatan}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-200">✕</button>
            </div>

            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Hari Kerja</p><p className="text-xl font-bold">{selectedEmployee.totalDays} hari</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Jam Kerja</p><p className="text-xl font-bold">{formatTime(selectedEmployee.totalHours)}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Rate Harian</p><p className="text-xl font-bold">{formatCurrency(selectedEmployee.dailyRate)}</p></div>
                <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-green-600">Total Gaji</p><p className="text-xl font-bold text-green-700">{formatCurrency(selectedEmployee.totalSalary)}</p></div>
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
              <button onClick={() => exportDetailToExcel(selectedEmployee)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">📊 Export Detail Excel</button>
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </ProtectedRoute>
  );
}