// app/(admin)/schedule-shift/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

type User = {
  uid: string;
  name: string;
  department: string;
  jabatan: string;
  role: string;
};

type Shift = {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  color: string;
  shiftType: string;
};

type Schedule = {
  userId: string;
  shiftId: string;
  date: string;
  shiftName?: string;
  shiftColor?: string;
};

type Holiday = {
  date: string;
  name: string;
};

export default function ScheduleShiftPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [userDepartment, setUserDepartment] = useState<string>("");
  const [allowHolidayAssign, setAllowHolidayAssign] = useState(true);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [rangeShiftId, setRangeShiftId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [datesList, setDatesList] = useState<Date[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role checking
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isHR = currentUser?.role === "hr";
  const isSPV = currentUser?.role === "spv";
  
  const canManage = isSuperAdmin || isAdmin || isHR || isSPV;
  const canBulkAssign = isSuperAdmin || isHR;
  const canSeeAllDepartments = isSuperAdmin || isHR;

  // Fetch holidays from API
  const fetchHolidays = async (year: number) => {
    try {
      const response = await fetch(`/api/holidays/${year}`);
      const data = await response.json();
      if (data.success) {
        setHolidays(data.holidays);
      }
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Generate dates from range
  const generateDatesFromRange = () => {
    if (!dateRange.start || !dateRange.end) return [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  // Update dates list when range changes
  useEffect(() => {
    const dates = generateDatesFromRange();
    setDatesList(dates);
    if (dates.length > 0) {
      const year = dates[0].getFullYear();
      fetchHolidays(year);
    }
  }, [dateRange]);

  // Load department user
  useEffect(() => {
    const loadUserDepartment = async () => {
      if (currentUser?.uid && (isAdmin || isSPV)) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDoc.data();
        if (userData) {
          setUserDepartment(userData.department || "");
          if (!canSeeAllDepartments) {
            setSelectedDepartment(userData.department || "ALL");
          }
        }
      }
    };
    loadUserDepartment();
  }, [currentUser, isAdmin, isSPV, canSeeAllDepartments]);

  // Load data
  useEffect(() => {
    if (canManage && datesList.length > 0) {
      loadData();
    }
  }, [selectedDepartment, userDepartment, datesList]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      let usersSnap = await getDocs(collection(db, "users"));
      let usersList: User[] = [];
      
      usersSnap.forEach(doc => {
        const data = doc.data();
        let shouldInclude = false;
        
        if (isSuperAdmin || isHR) {
          shouldInclude = true;
        } else if (isAdmin) {
          if (data.department === userDepartment) {
            shouldInclude = true;
          }
        } else if (isSPV) {
          if (data.department === userDepartment && 
              (data.role === "employee" || data.role === "staff")) {
            shouldInclude = true;
          }
        }
        
        if (shouldInclude) {
          usersList.push({
            uid: doc.id,
            name: data.name,
            department: data.department || "-",
            jabatan: data.jabatan || "-",
            role: data.role,
          });
        }
      });

      if (selectedDepartment !== "ALL" && canSeeAllDepartments) {
        usersList = usersList.filter(u => u.department === selectedDepartment);
      }

      setUsers(usersList);

      // Load shifts
      const shiftsSnap = await getDocs(collection(db, "shifts"));
      const shiftsList: Shift[] = [];
      shiftsSnap.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          shiftsList.push({
            id: doc.id,
            name: data.name,
            code: data.code,
            startTime: data.startTime,
            endTime: data.endTime,
            color: data.color,
            shiftType: data.shiftType || "morning",
          });
        }
      });
      setShifts(shiftsList);

      // Load schedules untuk range tanggal
      const schedulesSnap = await getDocs(collection(db, "shift_schedules"));
      const schedulesMap: Record<string, Schedule> = {};
      schedulesSnap.forEach(doc => {
        const data = doc.data();
        const scheduleDate = new Date(data.date);
        const isInRange = datesList.some(d => d.toISOString().split("T")[0] === data.date);
        if (isInRange) {
          const shift = shiftsList.find(s => s.id === data.shiftId);
          schedulesMap[`${data.userId}_${data.date}`] = {
            userId: data.userId,
            shiftId: data.shiftId,
            date: data.date,
            shiftName: shift?.name,
            shiftColor: shift?.color,
          };
        }
      });
      setSchedules(schedulesMap);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (userId: string, shiftId: string, date: string) => {
    if (!canManage) return;
    
    const scheduleId = `${userId}_${date}`;
    const shift = shifts.find(s => s.id === shiftId);
    
    try {
      if (shiftId === "unassign") {
        await deleteDoc(doc(db, "shift_schedules", scheduleId));
        setSchedules(prev => {
          const newSchedules = { ...prev };
          delete newSchedules[scheduleId];
          return newSchedules;
        });
      } else {
        await setDoc(doc(db, "shift_schedules", scheduleId), {
          userId,
          shiftId,
          date,
          shiftName: shift?.name,
          shiftColor: shift?.color,
          updatedBy: currentUser?.uid,
          updatedByName: currentUser?.name,
          updatedByRole: currentUser?.role,
          updatedAt: new Date(),
        });
        setSchedules(prev => ({
          ...prev,
          [scheduleId]: {
            userId,
            shiftId,
            date,
            shiftName: shift?.name,
            shiftColor: shift?.color,
          }
        }));
      }
    } catch (error) {
      console.error("Error assigning shift:", error);
      alert("Gagal menyimpan jadwal");
    }
  };

  // Import from Excel/Spreadsheet
  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        // Preview data
        const previewData = rows.slice(0, 10).map((row: any) => ({
          nama: row.Nama || row.name || row.NAME || row.Karyawan,
          tanggal: row.Tanggal || row.date || row.DATE,
          shift: row.Shift || row.shift || row.SHIFT,
        }));
        setImportPreview(previewData);
        
        // Store full data for import
        const importData = rows.map((row: any) => ({
          nama: row.Nama || row.name || row.NAME || row.Karyawan,
          tanggal: row.Tanggal || row.date || row.DATE,
          shift: row.Shift || row.shift || row.SHIFT,
        }));
        
        // Show modal with preview
        setShowImportModal(true);
        
        // Store data to import after confirmation
        window.tempImportData = importData;
        
      } catch (error) {
        console.error("Import error:", error);
        alert("❌ Gagal membaca file. Pastikan format file benar.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Confirm import
  const confirmImport = async () => {
    const importData = (window as any).tempImportData;
    if (!importData || importData.length === 0) {
      alert("Tidak ada data untuk diimport");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (const item of importData) {
        // Find user by name
        const user = users.find(u => 
          u.name.toLowerCase() === item.nama?.toLowerCase() ||
          u.name.toLowerCase().includes(item.nama?.toLowerCase())
        );
        
        // Find shift by name
        const shift = shifts.find(s => 
          s.name.toLowerCase() === item.shift?.toLowerCase() ||
          s.code.toLowerCase() === item.shift?.toLowerCase()
        );
        
        // Validate date
        const date = item.tanggal;
        const isValidDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
        
        if (!user) {
          errorCount++;
          errors.push(`Karyawan "${item.nama}" tidak ditemukan`);
          continue;
        }
        
        if (!shift) {
          errorCount++;
          errors.push(`Shift "${item.shift}" tidak ditemukan`);
          continue;
        }
        
        if (!isValidDate) {
          errorCount++;
          errors.push(`Tanggal "${date}" tidak valid (format: YYYY-MM-DD)`);
          continue;
        }
        
        await handleAssign(user.uid, shift.id, date);
        successCount++;
      }
      
      if (successCount > 0) {
        alert(`✅ Berhasil import ${successCount} data jadwal\n❌ Gagal: ${errorCount} data`);
        if (errors.length > 0) {
          console.log("Import errors:", errors.slice(0, 5));
        }
        await loadData(); // Refresh data
      } else {
        alert("❌ Tidak ada data yang berhasil diimport. Periksa format file.");
      }
      
      setShowImportModal(false);
      setImportPreview([]);
      delete (window as any).tempImportData;
      
    } catch (error) {
      console.error("Import error:", error);
      alert("❌ Gagal mengimport data");
    } finally {
      setImporting(false);
    }
  };

  // Download template Excel
  const downloadTemplate = () => {
    const template = [
      { Nama: "Budi Santoso", Tanggal: "2025-01-01", Shift: "AM1" },
      { Nama: "Siti Aminah", Tanggal: "2025-01-01", Shift: "PM1" },
      { Nama: "Joko Widodo", Tanggal: "2025-01-02", Shift: "AM2" },
      { Nama: "Example", Tanggal: "2025-01-02", Shift: "Libur" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Schedule");
    XLSX.writeFile(wb, "template_schedule_shift.xlsx");
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredUsers.flatMap(user => {
      return datesList.map(date => {
        const schedule = getScheduleForUserDate(user.uid, date);
        const shift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
        const holiday = isHoliday(date);
        
        return {
          Nama: user.name,
          Department: user.department,
          Jabatan: user.jabatan,
          Tanggal: date.toISOString().split("T")[0],
          Hari: dayNames[date.getDay()],
          Status: holiday.isHoliday ? "Libur Nasional" : (isWeekend(date) ? "Weekend" : "Hari Kerja"),
          Shift: shift?.name || "-",
          Jam_Masuk: shift?.startTime || "-",
          Jam_Keluar: shift?.endTime || "-",
        };
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule Shift");
    XLSX.writeFile(wb, `schedule_shift_${dateRange.start}_to_${dateRange.end}.xlsx`);
  };

  // Assign shift untuk range tanggal ke karyawan terpilih
  const assignDateRangeToSelectedUsers = async () => {
    if (!dateRange.start || !dateRange.end || !rangeShiftId) {
      alert("Pilih tanggal mulai, tanggal akhir, dan shift terlebih dahulu");
      return;
    }

    if (selectedUserIds.size === 0) {
      alert("Pilih minimal 1 karyawan");
      return;
    }

    const dates = generateDatesFromRange();
    setSaving(true);
    let successCount = 0;
    const selectedUsersList = users.filter(u => selectedUserIds.has(u.uid));
    
    try {
      for (const user of selectedUsersList) {
        for (const date of dates) {
          const dateStr = date.toISOString().split("T")[0];
          const scheduleId = `${user.uid}_${dateStr}`;
          const shift = shifts.find(s => s.id === rangeShiftId);
          
          await setDoc(doc(db, "shift_schedules", scheduleId), {
            userId: user.uid,
            shiftId: rangeShiftId,
            date: dateStr,
            shiftName: shift?.name,
            shiftColor: shift?.color,
            updatedBy: currentUser?.uid,
            updatedByName: currentUser?.name,
            updatedByRole: currentUser?.role,
            updatedAt: new Date(),
          });
          
          setSchedules(prev => ({
            ...prev,
            [scheduleId]: {
              userId: user.uid,
              shiftId: rangeShiftId,
              date: dateStr,
              shiftName: shift?.name,
              shiftColor: shift?.color,
            }
          }));
          successCount++;
        }
      }
      
      alert(`✅ Berhasil assign shift ke ${selectedUsersList.length} karyawan untuk ${dates.length} hari (${successCount} total assign)`);
      setShowRangeModal(false);
      setDateRange({ start: "", end: "" });
      setRangeShiftId("");
      setSelectedUserIds(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error(error);
      alert("❌ Gagal melakukan assign range");
    } finally {
      setSaving(false);
    }
  };

  const isHoliday = (date: Date): { isHoliday: boolean; name?: string } => {
    const dateStr = date.toISOString().split("T")[0];
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
      return { isHoliday: true, name: holiday.name };
    }
    return { isHoliday: false };
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getScheduleForUserDate = (userId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return schedules[`${userId}_${dateStr}`];
  };

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsersForModal = users.filter(user => 
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.jabatan.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv"]}>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">📅 Penjadwalan Shift</h1>
            <p className="text-xs text-gray-500">Atur shift karyawan dengan mudah</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              <span>📥</span> {importing ? "Memproses..." : "Import Excel"}
            </button>
            <button
              onClick={downloadTemplate}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              <span>📄</span> Template
            </button>
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              <span>📤</span> Export
            </button>
            <button
              onClick={() => setShowRangeModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              <span>📅</span> Assign Range
            </button>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={allowHolidayAssign}
                onChange={(e) => setAllowHolidayAssign(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-600">Assign libur</span>
            </label>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportExcel}
          accept=".xlsx, .xls, .csv, .xlsm"
          className="hidden"
        />

        {/* Filter Bar - Kiri */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[150px]">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={!canSeeAllDepartments}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="ALL">🏢 All Dept</option>
                {canSeeAllDepartments && [...new Set(users.map(u => u.department))].map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Cari karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                placeholder="Start"
              />
              <span className="text-gray-400 self-center">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                placeholder="End"
              />
            </div>
            <button
              onClick={loadData}
              className="bg-gray-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-600"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Info Range */}
        {datesList.length > 0 && (
          <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 flex justify-between items-center">
            <span>📆 {datesList.length} hari: {dateRange.start} s/d {dateRange.end}</span>
            <span>👥 {filteredUsers.length} karyawan</span>
          </div>
        )}

        {/* Main Table with Sticky Column & Horizontal Scroll */}
        {datesList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-500">Pilih rentang tanggal terlebih dahulu</p>
            <p className="text-xs text-gray-400 mt-1">Gunakan date range picker di atas</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200"
            style={{ scrollBehavior: 'smooth' }}
          >
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {/* Sticky Employee Column Header */}
                  <th className="sticky left-0 bg-gray-50 z-20 px-3 py-2 text-left border-r border-gray-200 min-w-[180px]">
                    <div className="font-semibold text-gray-700">👥 Karyawan</div>
                    <div className="text-xs text-gray-400 mt-0.5">{filteredUsers.length} orang</div>
                  </th>
                  {/* Date Headers */}
                  {datesList.map((date, idx) => {
                    const holiday = isHoliday(date);
                    const weekend = isWeekend(date);
                    const isToday = date.toDateString() === new Date().toISOString().split("T")[0];
                    return (
                      <th key={idx} className={`px-1 py-2 text-center min-w-[70px] border-r ${isToday ? 'bg-green-50' : ''}`}>
                        <div className="text-[10px] text-gray-400">{dayNames[date.getDay()]}</div>
                        <div className={`text-sm font-bold ${
                          holiday.isHoliday ? "text-red-600" : 
                          weekend ? "text-gray-400" : "text-gray-700"
                        }`}>
                          {date.getDate()}
                        </div>
                        <div className="text-[9px] text-gray-400">{monthNames[date.getMonth()]}</div>
                        {holiday.isHoliday && (
                          <div className="text-[8px] text-red-500 truncate max-w-[60px]" title={holiday.name}>
                            {holiday.name?.substring(0, 8)}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-t hover:bg-gray-50">
                    {/* Sticky Employee Column */}
                    <td className="sticky left-0 bg-white z-10 px-3 py-2 border-r border-gray-200 min-w-[180px]">
                      <div className="font-medium text-gray-800 text-sm">{user.name}</div>
                      <div className="text-[10px] text-gray-400">{user.department} • {user.jabatan}</div>
                    </td>
                    {/* Shift Cells */}
                    {datesList.map((date, idx) => {
                      const schedule = getScheduleForUserDate(user.uid, date);
                      const shift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
                      const holiday = isHoliday(date);
                      const weekend = isWeekend(date);
                      const isLibur = holiday.isHoliday || weekend;
                      const isToday = date.toDateString() === new Date().toISOString().split("T")[0];
                      
                      return (
                        <td 
                          key={idx} 
                          className={`px-1 py-1 text-center border-r ${
                            holiday.isHoliday ? "bg-red-50" : 
                            weekend ? "bg-gray-50" : ""
                          } ${isToday ? "ring-1 ring-green-300" : ""}`}
                        >
                          {!isLibur || allowHolidayAssign ? (
                            <select
                              value={schedule?.shiftId || ""}
                              onChange={(e) => handleAssign(user.uid, e.target.value, date.toISOString().split("T")[0])}
                              className="w-full text-[10px] border rounded px-1 py-1.5 bg-white cursor-pointer"
                              style={{
                                backgroundColor: shift?.color ? `${shift.color}20` : "#fff",
                                borderColor: shift?.color || "#e5e7eb",
                                fontWeight: shift ? "500" : "normal",
                              }}
                            >
                              <option value="">-</option>
                              {shifts.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                              {schedule && <option value="unassign">✕</option>}
                            </select>
                          ) : (
                            <div className="text-[9px] text-gray-400 py-1.5">
                              {holiday.isHoliday ? "Libur" : "Weekend"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">Tidak ada karyawan ditemukan</p>
              </div>
            )}
          </div>
        )}

        {/* Modal Import Excel */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h2 className="text-lg font-bold text-gray-800">📥 Import Data Shift</h2>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-700 mb-2">Preview Data ({importPreview.length} baris)</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-2 py-1 text-left">Nama Karyawan</th>
                          <th className="px-2 py-1 text-left">Tanggal</th>
                          <th className="px-2 py-1 text-left">Shift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-1">{item.nama || "-"}</td>
                            <td className="px-2 py-1">{item.tanggal || "-"}</td>
                            <td className="px-2 py-1">{item.shift || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importPreview.length === 0 && (
                    <div className="text-center py-4 text-gray-500">Tidak ada data preview</div>
                  )}
                </div>
                
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-yellow-700 mb-2">📌 Catatan</div>
                  <ul className="text-xs text-yellow-600 space-y-1 list-disc list-inside">
                    <li>Pastikan kolom: <strong>Nama</strong>, <strong>Tanggal</strong> (YYYY-MM-DD), <strong>Shift</strong></li>
                    <li>Nama karyawan harus sesuai dengan database</li>
                    <li>Nama shift harus sesuai dengan master shift</li>
                    <li>Tanggal harus dalam format YYYY-MM-DD (contoh: 2025-01-01)</li>
                  </ul>
                </div>
              </div>
              
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
                <button
                  onClick={confirmImport}
                  disabled={importing || importPreview.length === 0}
                  className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-sm disabled:bg-gray-400"
                >
                  {importing ? "Memproses..." : `Import ${importPreview.length} Data`}
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Assign Rentang Tanggal */}
        {showRangeModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h2 className="text-lg font-bold text-gray-800">📅 Assign Shift</h2>
                <button onClick={() => setShowRangeModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {/* Date Range */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-blue-700 mb-2">Rentang Tanggal</div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                    <span className="text-gray-400">→</span>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>

                {/* Shift */}
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-purple-700 mb-2">Pilih Shift</div>
                  <select
                    value={rangeShiftId}
                    onChange={(e) => setRangeShiftId(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">-- Pilih Shift --</option>
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.startTime}-{shift.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employees */}
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-green-700 mb-2">Pilih Karyawan</div>
                  <input
                    type="text"
                    placeholder="🔍 Cari karyawan..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm mb-2"
                  />
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b">
                    <input
                      type="checkbox"
                      id="selectAll"
                      checked={selectAll}
                      onChange={() => {
                        if (selectAll) {
                          setSelectedUserIds(new Set());
                        } else {
                          setSelectedUserIds(new Set(filteredUsersForModal.map(u => u.uid)));
                        }
                        setSelectAll(!selectAll);
                      }}
                      className="w-3.5 h-3.5"
                    />
                    <label htmlFor="selectAll" className="text-xs">Pilih Semua ({filteredUsersForModal.length})</label>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredUsersForModal.map(user => (
                      <label key={user.uid} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.uid)}
                          onChange={() => {
                            const newSelected = new Set(selectedUserIds);
                            if (newSelected.has(user.uid)) newSelected.delete(user.uid);
                            else newSelected.add(user.uid);
                            setSelectedUserIds(newSelected);
                            setSelectAll(newSelected.size === filteredUsersForModal.length);
                          }}
                          className="w-3.5 h-3.5"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-medium">{user.name}</div>
                          <div className="text-[10px] text-gray-500">{user.department}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] text-green-600 mt-2">✓ {selectedUserIds.size} terpilih</div>
                </div>
              </div>
              
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
                <button
                  onClick={assignDateRangeToSelectedUsers}
                  disabled={saving || !dateRange.start || !dateRange.end || !rangeShiftId || selectedUserIds.size === 0}
                  className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-sm disabled:bg-gray-400"
                >
                  {saving ? "Memproses..." : `Assign ke ${selectedUserIds.size} karyawan`}
                </button>
                <button
                  onClick={() => setShowRangeModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400">
          Klik pada sel shift untuk mengubah | Scroll horizontal untuk melihat semua tanggal | Import Excel untuk bulk data
        </div>
      </div>
    </ProtectedRoute>
  );
}