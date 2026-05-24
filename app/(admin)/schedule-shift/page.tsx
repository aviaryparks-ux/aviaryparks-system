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
  addDoc,
  query,
  where
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { CalendarDays, Users, Search, Save, Filter, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, FileText, CheckCircle, CalendarClock, Clock, Check, XCircle } from "lucide-react";

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
  lateTolerance?: number;
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

// ==================== HELPER FUNCTIONS ====================
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateFromYYYYMMDD = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  
  for (let i = 0; i < firstDayWeekday; i++) {
    days.push(null);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
};

// ==================== AUDIT LOG FUNCTION ====================
const addAuditLog = async (
  userId: string,
  userName: string,
  date: string,
  oldShiftId: string | null,
  oldShiftName: string | null,
  newShiftId: string | null,
  newShiftName: string | null,
  action: "create" | "update" | "delete",
  changedBy: string,
  changedByName: string,
  changedByRole: string
) => {
  try {
    await addDoc(collection(db, "shift_audit_logs"), {
      userId,
      userName,
      date,
      oldShiftId: oldShiftId || "",
      oldShiftName: oldShiftName || "",
      newShiftId: newShiftId || "",
      newShiftName: newShiftName || "",
      action,
      changedBy,
      changedByName,
      changedByRole,
      changedAt: new Date(),
      notes: action === "update" 
        ? `Perubahan shift dari ${oldShiftName || "kosong"} ke ${newShiftName || "kosong"}`
        : action === "create"
        ? `Menambahkan shift ${newShiftName} untuk tanggal ${date}`
        : `Menghapus shift ${oldShiftName} untuk tanggal ${date}`,
    });
  } catch (error) {
    console.error("Error adding audit log:", error);
  }
};

// ==================== COMPONENT ====================
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
  const [searchText, setSearchText] = useState(currentShiftName || "");

  const handleChange = (value: string) => {
    setSearchText(value);
    const shift = shifts.find(s => s.name === value);
    if (shift) {
      onShiftChange(userId, date, shift.id, shift.name);
    } else if (value === "") {
      onShiftChange(userId, date, "", "");
    }
  };

  const selectedShift = shifts.find(s => s.name === searchText);

  if (isLibur && !allowHolidayAssign) {
    return (
      <div className="text-[10px] text-gray-400 py-2 text-center bg-slate-50/50 rounded-md border border-dashed border-slate-200">
        Libur
      </div>
    );
  }

  return (
    <div className="relative group">
      <input
        type="text"
        value={searchText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Pilih shift..."
        style={selectedShift ? { 
          backgroundColor: `${selectedShift.color}15`, 
          color: selectedShift.color,
          borderColor: `${selectedShift.color}40`,
          fontWeight: 600
        } : {}}
        className={`w-full text-[11px] text-center rounded-md px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-300 shadow-sm ${
          selectedShift 
            ? "border" 
            : "border border-dashed border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`}
        list={`shift-list-${userId}-${date}`}
      />
      <datalist id={`shift-list-${userId}-${date}`}>
        {shifts.map(shift => (
          <option key={shift.id} value={shift.name}>
            {shift.name} ({shift.startTime} - {shift.endTime})
          </option>
        ))}
      </datalist>
    </div>
  );
};

// ==================== MAIN PAGE ====================
export default function ScheduleShiftPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(formatDateToYYYYMMDD(new Date()));
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
  const [pendingChanges, setPendingChanges] = useState<Map<string, { shiftId: string; shiftName: string }>>(new Map());
  
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeShiftId, setRangeShiftId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [selectAll, setSelectAll] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  
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

  // 🔥 LOAD DATA DENGAN FILTER USER NON-AKTIF
  const loadData = async () => {
    setLoading(true);
    try {
      let usersSnap = await getDocs(collection(db, "users"));
      let usersList: User[] = [];
      
      usersSnap.forEach(doc => {
        const data = doc.data();
        
        // 🔥 SKIP USER YANG TIDAK AKTIF (NON-AKTIF)
        if (data.isActive === false) {
          return; // Lewati user yang tidak aktif
        }
        
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
            lateTolerance: data.lateTolerance || 15,
          });
        }
      });
      setShifts(shiftsList);

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startStr = formatDateToYYYYMMDD(startOfMonth);
      const endStr = formatDateToYYYYMMDD(endOfMonth);
      
      const schedulesQuery = query(
        collection(db, "shift_schedules"),
        where("date", ">=", startStr),
        where("date", "<=", endStr)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      const schedulesMap: Record<string, Schedule> = {};
      schedulesSnap.forEach(doc => {
        const data = doc.data();
        const shift = shiftsList.find(s => s.id === data.shiftId);
        schedulesMap[`${data.userId}_${data.date}`] = {
          userId: data.userId,
          shiftId: data.shiftId,
          date: data.date,
          shiftName: shift?.name,
          shiftColor: shift?.color,
        };
      });
      setSchedules(schedulesMap);
      
      setPendingChanges(new Map());
    } catch (error) {
      console.error("Error loading data:", error);
      showToast("❌ Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleShiftChange = (userId: string, dateStr: string, shiftId: string, shiftName: string) => {
    if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error("Invalid date format:", dateStr);
      return;
    }
    
    const cellKey = `${userId}_${dateStr}`;
    const currentSchedule = schedules[cellKey];
    
    if (currentSchedule?.shiftId === shiftId) {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });
    } else if (shiftId === "") {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, { shiftId: "unassign", shiftName: "" });
        return newMap;
      });
    } else if (shiftId) {
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, { shiftId, shiftName });
        return newMap;
      });
    }
  };

  const handleSaveAllChanges = async () => {
    if (pendingChanges.size === 0) {
      showToast("Tidak ada perubahan yang perlu disimpan", "error");
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;
    const auditLogs: any[] = [];

    try {
      const batch = writeBatch(db);
      
      for (const [cellKey, { shiftId, shiftName }] of pendingChanges.entries()) {
        const [userId, dateStr] = cellKey.split("_");
        
        if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          errorCount++;
          continue;
        }
        
        const scheduleId = `${userId}_${dateStr}`;
        const shift = shifts.find(s => s.id === shiftId);
        const currentSchedule = schedules[scheduleId];
        const userName = users.find(u => u.uid === userId)?.name || "-";
        
        const isDelete = shiftId === "unassign";
        const isCreate = !currentSchedule && !isDelete;
        const isUpdate = currentSchedule && !isDelete;
        
        auditLogs.push({
          userId,
          userName,
          date: dateStr,
          oldShiftId: currentSchedule?.shiftId || null,
          oldShiftName: currentSchedule?.shiftName || null,
          newShiftId: isDelete ? null : shiftId,
          newShiftName: isDelete ? null : (shift?.name || shiftName),
          action: isDelete ? "delete" : (isCreate ? "create" : "update"),
        });
        
        if (shiftId === "unassign") {
          batch.delete(doc(db, "shift_schedules", scheduleId));
        } else {
          batch.set(doc(db, "shift_schedules", scheduleId), {
            userId,
            shiftId,
            date: dateStr,
            shiftName: shift?.name || shiftName,
            shiftColor: shift?.color,
            updatedBy: currentUser?.uid,
            updatedByName: currentUser?.name,
            updatedByRole: currentUser?.role,
            updatedAt: new Date(),
          });
        }
        
        const attendanceId = `${userId}_${dateStr}`;
        const attendanceRef = doc(db, "attendance", attendanceId);
        const attendanceDoc = await getDoc(attendanceRef);
        
        if (attendanceDoc.exists()) {
          if (shiftId === "unassign") {
            batch.update(attendanceRef, {
              shift: null,
              updatedAt: new Date(),
            });
          } else if (shift) {
            batch.update(attendanceRef, {
              shift: {
                id: shift.id,
                name: shift.name,
                code: shift.code,
                startTime: shift.startTime,
                endTime: shift.endTime,
                color: shift.color,
                lateTolerance: shift.lateTolerance || 15,
              },
              updatedAt: new Date(),
            });
          }
        }
        
        successCount++;
      }
      
      await batch.commit();
      
      for (const log of auditLogs) {
        await addAuditLog(
          log.userId,
          log.userName,
          log.date,
          log.oldShiftId,
          log.oldShiftName,
          log.newShiftId,
          log.newShiftName,
          log.action,
          currentUser?.uid || "",
          currentUser?.name || "",
          currentUser?.role || ""
        );
      }
      
      for (const [cellKey, { shiftId, shiftName }] of pendingChanges.entries()) {
        const [userId, dateStr] = cellKey.split("_");
        const scheduleId = `${userId}_${dateStr}`;
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
              date: dateStr,
              shiftName: shift?.name || shiftName,
              shiftColor: shift?.color,
            }
          }));
        }
      }
      
      showToast(`✅ Berhasil menyimpan ${successCount} perubahan${errorCount > 0 ? `, ${errorCount} gagal` : ""}`);
      setPendingChanges(new Map());
      await loadData();
      
    } catch (error) {
      console.error("Save all changes error:", error);
      showToast("❌ Gagal menyimpan perubahan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    if (pendingChanges.size > 0 && confirm("Batalkan semua perubahan yang belum disimpan?")) {
      setPendingChanges(new Map());
      loadData();
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

    const startDate = parseDateFromYYYYMMDD(dateRange.start);
    const endDate = parseDateFromYYYYMMDD(dateRange.end);
    const dates: string[] = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(formatDateToYYYYMMDD(d));
    }

    setRangeLoading(true);
    let addedCount = 0;
    const selectedUsersList = users.filter(u => selectedUserIds.has(u.uid));
    const shift = shifts.find(s => s.id === rangeShiftId);
    
    try {
      for (const user of selectedUsersList) {
        for (const dateStr of dates) {
          const cellKey = `${user.uid}_${dateStr}`;
          setPendingChanges(prev => {
            const newMap = new Map(prev);
            newMap.set(cellKey, { shiftId: rangeShiftId, shiftName: shift?.name || "" });
            return newMap;
          });
          addedCount++;
        }
      }
      
      showToast(`✅ ${addedCount} perubahan ditambahkan. Klik "Simpan Perubahan" untuk menyimpan.`);
      setShowRangeModal(false);
      setDateRange({ start: "", end: "" });
      setRangeShiftId("");
      setSelectedUserIds(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error(error);
      showToast("❌ Gagal menambahkan perubahan", "error");
    } finally {
      setRangeLoading(false);
    }
  };

  const isHoliday = (date: Date): { isHoliday: boolean; name?: string } => {
    const dateStr = formatDateToYYYYMMDD(date);
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
    const dateStr = formatDateToYYYYMMDD(date);
    return schedules[`${userId}_${dateStr}`];
  };

  const hasPendingChange = (userId: string, date: string) => {
    return pendingChanges.has(`${userId}_${date}`);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartment, selectedEmployee]);

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
      <div className="space-y-6 pb-20">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Jadwal</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.totalAssignments}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Karyawan</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.totalUsers}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Periode Hari</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.totalDays}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Persentase Terisi</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.filledPercentage}%</p>
            </div>
          </div>
        </div>

        {/* Info Pending Changes */}
        {pendingChanges.size > 0 && (
          <div className="rounded-xl bg-yellow-50 p-4 border border-yellow-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">📝</span>
              <span className="text-sm text-yellow-800 font-medium">
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Filter Jadwal
                </h2>
                <p className="text-xs text-slate-500">Sesuaikan data karyawan dan departemen</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex gap-2 items-center">
                <button
                  onClick={loadData}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Search className="w-4 h-4" /> <span className="hidden sm:inline">Refresh Data</span>
                </button>
                <button
                  onClick={() => setCurrentView(currentView === "calendar" ? "table" : "calendar")}
                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {currentView === "calendar" ? <FileText className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                  <span className="hidden sm:inline">{currentView === "calendar" ? "Tampilan Tabel" : "Tampilan Kalender"}</span>
                </button>
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors ml-auto lg:ml-2 border border-transparent hover:border-emerald-200"
                title={isFilterOpen ? "Sembunyikan Filter" : "Tampilkan Filter"}
              >
                {isFilterOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {isFilterOpen && (
          <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t border-slate-100 mt-2 animate-fade-in">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={!canSeeAllDepartments}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors disabled:bg-slate-100 disabled:opacity-50"
                >
                  <option value="ALL">Semua Departemen</option>
                  {canSeeAllDepartments && [...new Set(users.map(u => u.department))].map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
              <div className="relative">
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                >
                  <option value="ALL">Semua Karyawan</option>
                  {users.map(user => (
                    <option key={user.uid} value={user.uid}>{user.name} - {user.department}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama atau jabatan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
          <h2 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
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
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <span>📅</span>
                  Assign Rentang
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <span>📥</span>
                  Import Excel
                </button>
                <button
                  onClick={() => {
                    const template = [
                      { Nama: "Budi Santoso", Tanggal: formatDateToYYYYMMDD(new Date()), Shift: "Pagi" },
                      { Nama: "Siti Aminah", Tanggal: formatDateToYYYYMMDD(new Date()), Shift: "Malam" },
                    ];
                    const ws = XLSX.utils.json_to_sheet(template);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Template Schedule");
                    XLSX.writeFile(wb, "template_schedule_shift.xlsx");
                    showToast("✅ Template berhasil diunduh");
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
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
                      Tanggal: date ? formatDateToYYYYMMDD(date) : "",
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
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
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
                  let date = row.Tanggal || row.date || row.DATE;
                  const shiftName = row.Shift || row.shift || row.SHIFT;
                  
                  if (!userName || !date || !shiftName) {
                    errorCount++;
                    continue;
                  }
                  
                  if (date instanceof Date) {
                    date = formatDateToYYYYMMDD(date);
                  } else if (typeof date === 'string') {
                    const parsed = new Date(date);
                    if (!isNaN(parsed.getTime())) {
                      date = formatDateToYYYYMMDD(parsed);
                    }
                  }
                  
                  const user = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
                  const shift = shifts.find(s => s.name.toLowerCase() === shiftName.toLowerCase());
                  
                  if (user && shift && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
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
        <div className="rounded-xl bg-white p-4 shadow-md border border-gray-100">
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
        <div className="rounded-xl bg-white p-4 shadow-md border border-gray-100">
          <div className="flex flex-wrap gap-4 text-xs">
            {shifts.slice(0, 6).map(shift => (
              <div key={shift.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }} />
                <span className="text-gray-600">{shift.name}</span>
              </div>
            ))}
            {shifts.length > 6 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span className="text-gray-600">+{shifts.length - 6} lainnya</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600">Libur Nasional</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span className="text-gray-600">Weekend</span>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        {currentView === "calendar" && (
          <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-16 flex justify-center">
                <LoadingScreen fullScreen={false} message="Memuat kalender jadwal..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 bg-gray-50 z-20 px-4 py-3 text-left border-r border-gray-200 min-w-[180px]">
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
                        const isToday = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(new Date());
                        return (
                          <th key={idx} className="px-2 py-3 text-center min-w-[100px] border-r border-slate-100 bg-white">
                            <div className="flex flex-col items-center gap-1">
                              <div className={`text-[10px] font-semibold tracking-wider uppercase ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {dayNames[date.getDay()]}
                              </div>
                              <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                                isToday ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200" : 
                                holiday.isHoliday ? "text-rose-500 bg-rose-50" : 
                                weekend ? "text-slate-400 bg-slate-50" : "text-slate-700 hover:bg-slate-50 transition-colors"
                              }`}>
                                {date.getDate()}
                              </div>
                              <div className={`text-[10px] font-medium ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {monthNames[date.getMonth()]}
                              </div>
                            </div>
                            {holiday.isHoliday && (
                              <div className="mt-1.5 px-2 py-0.5 bg-rose-50 rounded-md text-[9px] text-rose-600 font-semibold truncate w-full max-w-[90px] mx-auto border border-rose-100" title={holiday.name}>
                                {holiday.name?.substring(0, 12)}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, idx) => (
                      <tr key={user.uid} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors`}>
                        <td className="sticky left-0 bg-white z-10 px-4 py-3 border-r border-gray-100 min-w-[180px]">
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
                          const isToday = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(new Date());
                          const isLibur = holiday.isHoliday || weekend;
                          const dateStr = formatDateToYYYYMMDD(date);
                          const hasChange = hasPendingChange(user.uid, dateStr);
                          
                          return (
                            <td 
                              key={idx} 
                              className={`px-2 py-2 text-center border-r border-gray-50 align-top ${
                                holiday.isHoliday ? "bg-red-50/30" : 
                                weekend ? "bg-gray-50" : ""
                              } ${isToday ? "ring-1 ring-green-300 ring-inset" : ""} ${
                                hasChange ? "bg-yellow-50/50" : ""
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
                  <div className="p-12 text-center text-gray-500">
                    <div className="text-5xl mb-4">👥</div>
                    <p className="text-lg font-medium">Tidak ada karyawan ditemukan</p>
                    <p className="text-sm mt-1">Coba ubah kata kunci pencarian atau filter departemen</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Table View */}
        {currentView === "table" && (
          <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <span>📋</span>
                Daftar Karyawan
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tanggal:</span>
                <div className="relative border border-slate-200 rounded-lg bg-white hover:border-emerald-300 transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                  <DatePicker
                    selected={selectedDate ? new Date(selectedDate) : undefined}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setSelectedDate(`${y}-${m}-${d}`);
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="w-32 bg-transparent px-3 py-1.5 text-sm text-slate-700 outline-none border-none focus:ring-0 cursor-pointer"
                    wrapperClassName="w-auto"
                  />
                </div>
                <span className="text-sm text-gray-500">({filteredUsers.length} karyawan)</span>
              </div>
            </div>
            
            {loading ? (
              <div className="p-16 flex justify-center">
                <LoadingScreen fullScreen={false} message="Memuat tabel jadwal..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Nama</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Departemen</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Jabatan</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Shift Saat Ini</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[250px]">Ganti Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, idx) => {
                      const schedule = schedules[`${user.uid}_${selectedDate}`];
                      const currentShift = schedule ? shifts.find(s => s.id === schedule.shiftId) : null;
                      const selectedDateObj = parseDateFromYYYYMMDD(selectedDate);
                      const holiday = isHoliday(selectedDateObj);
                      const weekend = isWeekend(selectedDateObj);
                      const isLibur = holiday.isHoliday || weekend;
                      const hasChange = hasPendingChange(user.uid, selectedDate);
                      
                      return (
                        <tr key={user.uid} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors ${hasChange ? 'bg-yellow-50/50' : ''}`}>
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
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-medium">Tidak ada karyawan ditemukan</p>
                <p className="text-sm mt-1">Coba ubah kata kunci pencarian atau filter departemen</p>
              </div>
            )}
          </div>
        )}

        {/* Modal Assign Rentang Tanggal */}
        {showRangeModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-emerald-600" />
                    Assign Shift Massal
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Assign shift untuk banyak karyawan sekaligus</p>
                </div>
                <button 
                  onClick={() => setShowRangeModal(false)} 
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-600" /> Rentang Tanggal
                  </label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium mb-1 block">Dari Tanggal</label>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-colors">
                        <span className="text-emerald-500">📅</span>
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="w-full bg-transparent text-sm text-slate-700 outline-none border-none placeholder-slate-400 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium mb-1 block">Sampai Tanggal</label>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-colors">
                        <span className="text-emerald-500">📅</span>
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="w-full bg-transparent text-sm text-slate-700 outline-none border-none placeholder-slate-400 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  {dateRange.start && dateRange.end && (
                    <div className="text-xs font-medium text-emerald-600 mt-3 bg-emerald-50 px-2.5 py-1.5 rounded-md inline-flex border border-emerald-100">
                      Total: {Math.ceil((parseDateFromYYYYMMDD(dateRange.end).getTime() - parseDateFromYYYYMMDD(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1} hari
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" /> Pilih Shift
                  </label>
                  <div className="relative mt-2">
                    <select
                      value={rangeShiftId}
                      onChange={(e) => setRangeShiftId(e.target.value)}
                      className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    >
                      <option value="">-- Pilih Shift --</option>
                      {shifts.map(shift => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} ({shift.startTime} - {shift.endTime})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" /> Pilih Karyawan
                  </label>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Cari karyawan..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 mb-2 pb-3 border-b border-slate-100">
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
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="selectAll" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                      Pilih Semua ({filteredUsersForModal.length})
                    </label>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                    {filteredUsersForModal.map(user => (
                      <label key={user.uid} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 group">
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
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1 flex flex-col">
                          <span className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 transition-colors">{user.name}</span>
                          <span className="text-[11px] text-slate-500">{user.department} • {user.jabatan}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 w-fit px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> {selectedUserIds.size} karyawan terpilih
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setShowRangeModal(false)}
                  className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  Batal
                </button>
                <button
                  onClick={assignDateRangeToSelectedUsers}
                  disabled={rangeLoading || !dateRange.start || !dateRange.end || !rangeShiftId || selectedUserIds.size === 0}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  {rangeLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Assign ke {selectedUserIds.size} Karyawan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{((currentPage - 1) * itemsPerPage) + 1}</span> hingga <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> dari <span className="font-semibold text-slate-800">{filteredUsers.length}</span> karyawan
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1 hidden sm:flex">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-500">
          <div className="flex flex-wrap justify-center gap-4">
            <span>✅ Ketik nama shift, perubahan akan ditampung sementara</span>
            <span>📝 Cell yang berubah akan memiliki background kuning</span>
            <span>💾 Klik tombol "Simpan Perubahan" untuk menyimpan semua perubahan sekaligus</span>
            <span>🔄 Perubahan shift akan otomatis mengupdate data attendance</span>
            <span>🔍 Fitur search otomatis - ketik "AM" maka akan muncul shift yang mengandung "AM"</span>
            <span>📅 Gunakan fitur "Assign Rentang" untuk periode dan karyawan tertentu</span>
            <span>✅ User non-aktif tidak akan muncul di daftar karyawan</span>
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