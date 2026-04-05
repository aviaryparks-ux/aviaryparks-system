// app/(admin)/schedule-shift/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
  nameEn?: string;
  types?: string[];
  isNational?: boolean;
};

// Component untuk shift select (tanpa tombol submit sendiri)
const ShiftSelectCell = ({ 
  userId, 
  date, 
  currentShiftId, 
  currentShiftName, 
  shifts, 
  onShiftChange,
  isLibur,
  allowHolidayAssign 
}: { 
  userId: string; 
  date: string; 
  currentShiftId: string | null;
  currentShiftName: string | null;
  shifts: Shift[]; 
  onShiftChange: (userId: string, date: string, shiftId: string, shiftName: string) => void;
  isLibur: boolean;
  allowHolidayAssign: boolean;
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState(currentShiftId || "");
  const [searchText, setSearchText] = useState(currentShiftName || "");

  const handleChange = (value: string) => {
    setSearchText(value);
    const shift = shifts.find(s => s.name === value);
    if (shift) {
      setSelectedShiftId(shift.id);
      onShiftChange(userId, date, shift.id, shift.name);
    } else if (value === "") {
      setSelectedShiftId("");
      onShiftChange(userId, date, "", "");
    }
  };

  const filteredShifts = shifts.filter(shift => 
    shift.name.toLowerCase().includes(searchText.toLowerCase())
  );

  if (isLibur && !allowHolidayAssign) {
    return (
      <div className="text-[10px] text-gray-400 py-2 text-center">
        {isLibur ? "Libur" : "Weekend"}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={searchText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ketik nama shift..."
        className="w-full text-[11px] border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
        list={`shift-list-${userId}-${date}`}
      />
      <datalist id={`shift-list-${userId}-${date}`}>
        {shifts.map(shift => (
          <option key={shift.id} value={shift.name}>
            {shift.name} ({shift.startTime} - {shift.endTime})
          </option>
        ))}
      </datalist>
      {selectedShiftId && (
        <div className="text-[9px] text-green-600 truncate">
          {shifts.find(s => s.id === selectedShiftId)?.name}
        </div>
      )}
    </div>
  );
};

export default function ScheduleShiftPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userDepartment, setUserDepartment] = useState<string>("");
  const [currentView, setCurrentView] = useState<"calendar" | "table">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [allowHolidayAssign, setAllowHolidayAssign] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // 🔥 State untuk menyimpan perubahan yang belum disimpan
  const [pendingChanges, setPendingChanges] = useState<Map<string, { shiftId: string; shiftName: string }>>(new Map());
  
  // Modal states
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeShiftId, setRangeShiftId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  
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
    setHolidaysLoading(true);
    try {
      const response = await fetch(`/api/holidays/${year}`);
      const data = await response.json();
      if (data.success) {
        setHolidays(data.holidays);
      }
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setHolidaysLoading(false);
    }
  };

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

  // Fetch holidays when month changes
  useEffect(() => {
    const year = currentMonth.getFullYear();
    fetchHolidays(year);
  }, [currentMonth]);

  // Load data
  useEffect(() => {
    if (canManage) {
      loadData();
    }
  }, [selectedDate, selectedDepartment, userDepartment, currentMonth, selectedEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
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

      if (selectedEmployee !== "ALL") {
        usersList = usersList.filter(u => u.uid === selectedEmployee);
      }

      setUsers(usersList);

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

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const schedulesSnap = await getDocs(collection(db, "shift_schedules"));
      const schedulesMap: Record<string, Schedule> = {};
      schedulesSnap.forEach(doc => {
        const data = doc.data();
        const scheduleDate = new Date(data.date);
        if (scheduleDate >= startOfMonth && scheduleDate <= endOfMonth) {
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
      
      // Reset pending changes setelah load data
      setPendingChanges(new Map());
    } catch (error) {
      console.error("Error loading data:", error);
      showToast("❌ Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Fungsi untuk mencatat perubahan shift
  const handleShiftChange = (userId: string, date: string, shiftId: string, shiftName: string) => {
    const cellKey = `${userId}_${date}`;
    const currentSchedule = schedules[cellKey];
    
    // Jika shiftId sama dengan yang sudah ada dan tidak berubah, hapus dari pending changes
    if (currentSchedule?.shiftId === shiftId) {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });
    } 
    // Jika shiftId kosong (hapus)
    else if (shiftId === "") {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, { shiftId: "unassign", shiftName: "" });
        return newMap;
      });
    }
    // Jika ada perubahan shift
    else if (shiftId) {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, { shiftId, shiftName });
        return newMap;
      });
    }
  };

  // 🔥 Fungsi untuk menyimpan semua perubahan sekaligus
  const handleSaveAllChanges = async () => {
    if (pendingChanges.size === 0) {
      showToast("Tidak ada perubahan yang perlu disimpan", "error");
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const batch = writeBatch(db);
      
      for (const [cellKey, { shiftId, shiftName }] of pendingChanges.entries()) {
        const [userId, date] = cellKey.split("_");
        const scheduleId = `${userId}_${date}`;
        const shift = shifts.find(s => s.id === shiftId);
        
        if (shiftId === "unassign") {
          batch.delete(doc(db, "shift_schedules", scheduleId));
        } else {
          batch.set(doc(db, "shift_schedules", scheduleId), {
            userId,
            shiftId,
            date,
            shiftName: shift?.name || shiftName,
            shiftColor: shift?.color,
            updatedBy: currentUser?.uid,
            updatedByName: currentUser?.name,
            updatedByRole: currentUser?.role,
            updatedAt: new Date(),
          });
        }
        successCount++;
      }
      
      await batch.commit();
      
      // Update local state schedules
      for (const [cellKey, { shiftId, shiftName }] of pendingChanges.entries()) {
        const [userId, date] = cellKey.split("_");
        const scheduleId = `${userId}_${date}`;
        const shift = shifts.find(s => s.id === shiftId);
        
        if (shiftId === "unassign") {
          setSchedules(prev => {
            const newSchedules = { ...prev };
            delete newSchedules[scheduleId];
            return newSchedules;
          });
        } else {
          setSchedules(prev => ({
            ...prev,
            [scheduleId]: {
              userId,
              shiftId,
              date,
              shiftName: shift?.name || shiftName,
              shiftColor: shift?.color,
            }
          }));
        }
      }
      
      showToast(`✅ Berhasil menyimpan ${successCount} perubahan${errorCount > 0 ? `, ${errorCount} gagal` : ""}`);
      setPendingChanges(new Map());
      
    } catch (error) {
      console.error("Save all changes error:", error);
      showToast("❌ Gagal menyimpan perubahan", "error");
    } finally {
      setSaving(false);
    }
  };

  // 🔥 Batalkan semua perubahan
  const handleCancelChanges = () => {
    if (pendingChanges.size > 0 && confirm("Batalkan semua perubahan yang belum disimpan?")) {
      setPendingChanges(new Map());
      loadData(); // Reload data untuk mengembalikan ke state semula
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const assignDateRangeToSelectedUsers = async () => {
    if (!dateRange.start || !dateRange.end || !rangeShiftId) {
      showToast("Pilih tanggal mulai, tanggal akhir, dan shift terlebih dahulu", "error");
      return;
    }

    if (selectedUserIds.size === 0) {
      showToast("Pilih minimal 1 karyawan", "error");
      return;
    }

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }

    setRangeLoading(true);
    let successCount = 0;
    const selectedUsersList = users.filter(u => selectedUserIds.has(u.uid));
    
    try {
      for (const user of selectedUsersList) {
        for (const date of dates) {
          const scheduleId = `${user.uid}_${date}`;
          const shift = shifts.find(s => s.id === rangeShiftId);
          
          await setDoc(doc(db, "shift_schedules", scheduleId), {
            userId: user.uid,
            shiftId: rangeShiftId,
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
              userId: user.uid,
              shiftId: rangeShiftId,
              date,
              shiftName: shift?.name,
              shiftColor: shift?.color,
            }
          }));
          successCount++;
        }
      }
      
      showToast(`✅ Berhasil assign shift ke ${selectedUsersList.length} karyawan untuk ${dates.length} hari`);
      setShowRangeModal(false);
      setDateRange({ start: "", end: "" });
      setRangeShiftId("");
      setSelectedUserIds(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error(error);
      showToast("❌ Gagal melakukan assign range", "error");
    } finally {
      setRangeLoading(false);
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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getScheduleForUserDate = (userId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return schedules[`${userId}_${dateStr}`];
  };

  // Cek apakah suatu cell memiliki perubahan pending
  const hasPendingChange = (userId: string, date: string) => {
    return pendingChanges.has(`${userId}_${date}`);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

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

  const stats = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth).filter(d => d !== null);
    const totalAssignments = Object.keys(schedules).length;
    const totalUsers = filteredUsers.length;
    const totalDays = daysInMonth.length;
    const filledPercentage = totalUsers > 0 && totalDays > 0 
      ? Math.round((totalAssignments / (totalUsers * totalDays)) * 100) 
      : 0;
    
    return { totalAssignments, totalUsers, totalDays, filledPercentage };
  }, [schedules, filteredUsers, currentMonth]);

  if (!canManage) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv"]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-7xl mb-4">🔒</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Akses Terbatas</h2>
            <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv"]}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
          {/* Toast Notification */}
          {showSuccessToast && (
            <div className="fixed top-20 right-6 z-50 animate-slide-in">
              <div className="bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
                <span>✅</span>
                <span className="text-sm font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                📅 Penjadwalan Shift
              </h1>
              <p className="text-gray-500 mt-1">Atur dan kelola jadwal shift karyawan dengan mudah</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Data real-time</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-600">Total Jadwal</p>
                  <p className="text-2xl font-bold text-blue-800">{stats.totalAssignments}</p>
                </div>
                <span className="text-3xl">📅</span>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-600">Karyawan</p>
                  <p className="text-2xl font-bold text-green-800">{stats.totalUsers}</p>
                </div>
                <span className="text-3xl">👥</span>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-purple-600">Periode</p>
                  <p className="text-2xl font-bold text-purple-800">{stats.totalDays}</p>
                </div>
                <span className="text-3xl">📆</span>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-orange-600">Terisi</p>
                  <p className="text-2xl font-bold text-orange-800">{stats.filledPercentage}%</p>
                </div>
                <span className="text-3xl">📊</span>
              </div>
            </div>
          </div>

          {/* Info Pending Changes */}
          {pendingChanges.size > 0 && (
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <span className="text-sm text-yellow-800">
                  {pendingChanges.size} perubahan belum disimpan
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleSaveAllChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      Simpan {pendingChanges.size} Perubahan
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Filter Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter Data
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Departemen</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={!canSeeAllDepartments}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="ALL">Semua Departemen</option>
                  {canSeeAllDepartments && [...new Set(users.map(u => u.department))].map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Karyawan</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">Semua Karyawan</option>
                  {users.map(user => (
                    <option key={user.uid} value={user.uid}>{user.name} - {user.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Cari</label>
                <input
                  type="text"
                  placeholder="Nama atau jabatan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-2 items-end">
                <button
                  onClick={loadData}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  Refresh
                </button>
                <button
                  onClick={() => setCurrentView(currentView === "calendar" ? "table" : "calendar")}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>{currentView === "calendar" ? "📋" : "📅"}</span>
                  {currentView === "calendar" ? "Tabel" : "Kalender"}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Aksi Cepat
            </h2>
            <div className="flex flex-wrap gap-3">
              {canBulkAssign && (
                <>
                  <button
                    onClick={() => setShowRangeModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <span>📅</span>
                    Assign Rentang
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <span>📥</span>
                    Import Excel
                  </button>
                  <button
                    onClick={() => {
                      const template = [
                        { Nama: "Budi Santoso", Tanggal: new Date().toISOString().split("T")[0], Shift: "Pagi" },
                        { Nama: "Siti Aminah", Tanggal: new Date().toISOString().split("T")[0], Shift: "Malam" },
                      ];
                      const ws = XLSX.utils.json_to_sheet(template);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Template Schedule");
                      XLSX.writeFile(wb, "template_schedule_shift.xlsx");
                      showToast("✅ Template berhasil diunduh");
                    }}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <span>📄</span>
                    Download Template
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const exportData = filteredUsers.flatMap(user => {
                    const daysInMonth = getDaysInMonth(currentMonth).filter(d => d !== null);
                    return daysInMonth.map(date => {
                      const schedule = getScheduleForUserDate(user.uid, date!);
                      const shift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
                      const holiday = isHoliday(date!);
                      return {
                        Nama: user.name,
                        Departemen: user.department,
                        Jabatan: user.jabatan,
                        Tanggal: date?.toISOString().split("T")[0],
                        Hari: dayNames[date?.getDay() || 0],
                        Status: holiday.isHoliday ? "Libur Nasional" : "",
                        Shift: shift?.name || "-",
                        Jam_Masuk: shift?.startTime || "-",
                        Jam_Keluar: shift?.endTime || "-",
                      };
                    });
                  });
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Schedule Shift");
                  XLSX.writeFile(wb, `schedule_shift_${currentMonth.getFullYear()}_${currentMonth.getMonth() + 1}.xlsx`);
                  showToast("✅ Data berhasil diexport");
                }}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <span>📤</span>
                Export Excel
              </button>
              <label className="flex items-center gap-2 ml-auto px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                <input
                  type="checkbox"
                  checked={allowHolidayAssign}
                  onChange={(e) => setAllowHolidayAssign(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Izinkan assign di hari libur</span>
              </label>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async (e) => {
                try {
                  const data = new Uint8Array(e.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  const sheet = workbook.Sheets[workbook.SheetNames[0]];
                  const rows = XLSX.utils.sheet_to_json(sheet);
                  let importedCount = 0;
                  let errorCount = 0;
                  
                  for (const row of rows as any) {
                    const userName = row.Nama || row.name || row.NAME;
                    const date = row.Tanggal || row.date || row.DATE;
                    const shiftName = row.Shift || row.shift || row.SHIFT;
                    
                    if (!userName || !date || !shiftName) {
                      errorCount++;
                      continue;
                    }
                    
                    const user = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
                    const shift = shifts.find(s => s.name.toLowerCase() === shiftName.toLowerCase());
                    
                    if (user && shift) {
                      // Tambahkan ke pending changes
                      handleShiftChange(user.uid, date, shift.id, shift.name);
                      importedCount++;
                    } else {
                      errorCount++;
                    }
                  }
                  
                  showToast(`✅ Import selesai: ${importedCount} perubahan ditambahkan, ${errorCount} gagal`);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                } catch (error) {
                  showToast("❌ Gagal import file", "error");
                }
              };
              reader.readAsArrayBuffer(file);
            }}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          {/* Calendar Navigation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ◀
                </button>
                <h2 className="text-xl font-semibold text-gray-800">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h2>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ▶
                </button>
              </div>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
              >
                📍 Hari Ini
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap gap-4 text-xs">
              {shifts.map(shift => (
                <div key={shift.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }} />
                  <span>{shift.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Libur Nasional</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span>Weekend</span>
              </div>
              {allowHolidayAssign && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Bisa assign di hari libur</span>
                </div>
              )}
            </div>
          </div>

          {/* Calendar View */}
          {currentView === "calendar" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-16 text-center">
                  <div className="inline-block">
                    <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-500 mt-4">Memuat data jadwal...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-20 px-4 py-3 text-left border-r border-gray-200 min-w-[180px]">
                          <div className="font-semibold text-gray-700 flex items-center gap-2">
                            <span>👥</span>
                            Karyawan
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{filteredUsers.length} orang</div>
                        </th>
                        {getDaysInMonth(currentMonth).map((date, idx) => {
                          if (!date) return <th key={idx} className="bg-gray-50 px-2 py-3"></th>;
                          const holiday = isHoliday(date);
                          const weekend = isWeekend(date);
                          const isToday = date.toDateString() === new Date().toISOString().split("T")[0];
                          return (
                            <th key={idx} className={`px-2 py-3 text-center min-w-[180px] border-r border-gray-100 ${
                              isToday ? 'bg-green-50' : ''
                            }`}>
                              <div className="text-[11px] text-gray-400 font-medium">{dayNames[date.getDay()]}</div>
                              <div className={`text-base font-bold ${
                                holiday.isHoliday ? "text-red-500" : 
                                weekend ? "text-gray-400" : "text-gray-700"
                              }`}>
                                {date.getDate()}
                              </div>
                              <div className="text-[10px] text-gray-400">{monthNames[date.getMonth()]}</div>
                              {holiday.isHoliday && (
                                <div className="mt-1 px-1.5 py-0.5 bg-red-50 rounded text-[8px] text-red-600 font-medium truncate max-w-[120px]" title={holiday.name}>
                                  {holiday.name?.substring(0, 12)}
                                </div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, idx) => (
                        <tr key={user.uid} className={`border-t border-gray-100 hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent transition-all duration-150 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}>
                          <td className="sticky left-0 bg-inherit z-10 px-4 py-3 border-r border-gray-100 min-w-[180px]">
                            <div className="font-medium text-gray-800 text-sm">{user.name}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                {user.department}
                              </span>
                              <span className="text-[10px] text-gray-400">•</span>
                              <span className="text-[10px] text-gray-500">{user.jabatan}</span>
                            </div>
                          </td>
                          {getDaysInMonth(currentMonth).map((date, idx) => {
                            if (!date) return <td key={idx} className="bg-gray-50" />;
                            
                            const schedule = getScheduleForUserDate(user.uid, date);
                            const shift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
                            const holiday = isHoliday(date);
                            const weekend = isWeekend(date);
                            const isToday = date.toDateString() === new Date().toISOString().split("T")[0];
                            const isLibur = holiday.isHoliday || weekend;
                            const dateStr = date.toISOString().split("T")[0];
                            const hasChange = hasPendingChange(user.uid, dateStr);
                            
                            return (
                              <td 
                                key={idx} 
                                className={`px-2 py-2 border-r border-gray-50 align-top transition-all ${
                                  holiday.isHoliday ? "bg-red-50/30" : 
                                  weekend ? "bg-gray-50" : ""
                                } ${isToday ? "ring-1 ring-green-300 ring-inset" : ""} ${
                                  hasChange ? "bg-yellow-50/50 shadow-inner" : ""
                                }`}
                              >
                                {hasChange && (
                                  <div className="text-[8px] text-yellow-600 mb-1">📝</div>
                                )}
                                <ShiftSelectCell
                                  userId={user.uid}
                                  date={dateStr}
                                  currentShiftId={schedule?.shiftId || null}
                                  currentShiftName={shift?.name || null}
                                  shifts={shifts}
                                  onShiftChange={handleShiftChange}
                                  isLibur={isLibur}
                                  allowHolidayAssign={allowHolidayAssign}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {filteredUsers.length === 0 && !loading && (
                    <div className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3 text-3xl">
                        👥
                      </div>
                      <p className="text-gray-500 font-medium">Tidak ada karyawan ditemukan</p>
                      <p className="text-xs text-gray-400 mt-1">Coba ubah kata kunci pencarian atau filter departemen</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table View */}
          {currentView === "table" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <span>📋</span>
                  Daftar Karyawan
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Tanggal:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-500">({filteredUsers.length} karyawan)</span>
                </div>
              </div>
              
              {loading ? (
                <div className="p-16 text-center">
                  <div className="inline-block">
                    <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-500 mt-4">Memuat data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">No</th>
                        <th className="px-4 py-3 text-left">Nama</th>
                        <th className="px-4 py-3 text-left">Departemen</th>
                        <th className="px-4 py-3 text-left">Jabatan</th>
                        <th className="px-4 py-3 text-left">Shift Saat Ini</th>
                        <th className="px-4 py-3 text-left min-w-[250px]">Ganti Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, idx) => {
                        const schedule = schedules[`${user.uid}_${selectedDate}`];
                        const currentShift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
                        const selectedDateObj = new Date(selectedDate);
                        const holiday = isHoliday(selectedDateObj);
                        const weekend = isWeekend(selectedDateObj);
                        const isLibur = holiday.isHoliday || weekend;
                        const hasChange = hasPendingChange(user.uid, selectedDate);
                        
                        return (
                          <tr key={user.uid} className={`border-t border-gray-100 hover:bg-green-50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          } ${hasChange ? 'bg-yellow-50/50' : ''}`}>
                            <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                            <td className="px-4 py-3 text-gray-600">{user.department}</td>
                            <td className="px-4 py-3 text-gray-600">{user.jabatan}</td>
                            <td className="px-4 py-3">
                              {currentShift ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentShift.color }} />
                                  <span className="font-medium text-gray-800">{currentShift.name}</span>
                                  <span className="text-xs text-gray-400">
                                    ({currentShift.startTime} - {currentShift.endTime})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">- Belum diatur -</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <ShiftSelectCell
                                userId={user.uid}
                                date={selectedDate}
                                currentShiftId={schedule?.shiftId || null}
                                currentShiftName={currentShift?.name || null}
                                shifts={shifts}
                                onShiftChange={handleShiftChange}
                                isLibur={isLibur}
                                allowHolidayAssign={allowHolidayAssign}
                              />
                              {hasChange && (
                                <div className="text-[8px] text-yellow-600 mt-1 text-center">📝 Belum disimpan</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              {filteredUsers.length === 0 && !loading && (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3 text-3xl">
                    👥
                  </div>
                  <p className="text-gray-500 font-medium">Tidak ada karyawan ditemukan</p>
                  <p className="text-xs text-gray-400 mt-1">Coba ubah kata kunci pencarian atau filter departemen</p>
                </div>
              )}
            </div>
          )}

          {/* Modal Assign Rentang Tanggal */}
          {showRangeModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <span>✨</span>
                      Assign Shift Massal
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Assign shift untuk banyak karyawan sekaligus</p>
                  </div>
                  <button 
                    onClick={() => setShowRangeModal(false)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 p-4 rounded-xl">
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>📅</span>
                      Rentang Tanggal
                    </label>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                      <span className="text-gray-400 self-center">→</span>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    {dateRange.start && dateRange.end && (
                      <div className="text-xs text-blue-600 mt-2">
                        📆 Total {Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1} hari
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 p-4 rounded-xl">
                    <label className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>⏰</span>
                      Pilih Shift
                    </label>
                    <select
                      value={rangeShiftId}
                      onChange={(e) => setRangeShiftId(e.target.value)}
                      className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white mt-2"
                    >
                      <option value="">-- Pilih Shift --</option>
                      {shifts.map(shift => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} ({shift.startTime} - {shift.endTime})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 rounded-xl">
                    <label className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>👥</span>
                      Pilih Karyawan
                    </label>
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                      <input
                        type="text"
                        placeholder="Cari karyawan..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full border border-green-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 mb-2 pb-2 border-b border-green-200">
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
                        className="w-4 h-4 rounded border-green-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="selectAll" className="text-sm font-medium text-gray-700">
                        Pilih Semua ({filteredUsersForModal.length})
                      </label>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredUsersForModal.map(user => (
                        <label key={user.uid} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-all">
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
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.department} • {user.jabatan}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-green-200">
                      <div className="text-xs font-medium text-green-700">
                        ✓ {selectedUserIds.size} karyawan terpilih
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
                  <button
                    onClick={assignDateRangeToSelectedUsers}
                    disabled={rangeLoading || !dateRange.start || !dateRange.end || !rangeShiftId || selectedUserIds.size === 0}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                  >
                    {rangeLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Memproses...
                      </span>
                    ) : (
                      `Assign ke ${selectedUserIds.size} Karyawan`
                    )}
                  </button>
                  <button
                    onClick={() => setShowRangeModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 text-center text-xs text-gray-500 border border-gray-200">
            <div className="flex flex-wrap justify-center gap-4">
              <span>✅ Ketik nama shift, perubahan akan ditampung sementara</span>
              <span>📝 Cell yang berubah akan memiliki background kuning dan ikon 📝</span>
              <span>💾 Klik tombol "Simpan X Perubahan" untuk menyimpan semua perubahan sekaligus</span>
              <span>🔍 Fitur search otomatis - ketik "AM" maka akan muncul shift yang mengandung "AM"</span>
              <span>📅 Gunakan fitur "Assign Rentang" untuk periode dan karyawan tertentu</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}