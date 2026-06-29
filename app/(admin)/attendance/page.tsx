// app/(admin)/attendance/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { id } from "date-fns/locale";
import LoadingScreen from "@/components/ui/LoadingScreen";
import PageHeader from "@/components/ui/PageHeader";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc, deleteDoc, setDoc, Timestamp, getDocs, where, limit } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ProtectedRoute from "@/components/ProtectedRoute";
import EmployeeFilterModal from "@/components/EmployeeFilterModal";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  CalendarDays,
  FileEdit,
  Download,
  Filter,
  RefreshCw,
  Search,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Image as ImageIcon,
  Camera,
  Info,
  Calendar,
  List,
  Trash2,
  X
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ================= TYPE DEFINITIONS =================
type User = {
  name: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  email?: string;
  role?: string;
  photoUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  isActive?: boolean;
};

type Attendance = {
  id: string;
  uid: string;
  name: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  date: any;
  checkIn?: { time: any; location?: string; note?: string; photo?: string; lat?: number; lng?: number };
  checkOut?: { time: any; location?: string; note?: string; photo?: string; lat?: number; lng?: number };
  workHours?: string;
  status?: string;
  isCorrected?: boolean;
  correctedCheckIn?: string;
  correctedCheckOut?: string;
  shift?: { id: string; name: string; code: string; startTime: string; endTime: string; color: string; lateTolerance?: number };
  officeLocation?: { name: string; lat: number; lng: number; radius: number };
  distance?: number;
  isWithinRadius?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

type CorrectionRequest = {
  id: string;
  uid: string;
  name: string;
  date: any;
  checkIn: string;
  checkOut: string;
  status: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
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

type StatusInfo = { status: string; label: string; color: string };

// ================= HELPER FUNCTIONS =================
const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'string') { const date = new Date(timestamp); if (!isNaN(date.getTime())) return date; }
  if (typeof timestamp === 'number') { const date = new Date(timestamp); if (!isNaN(date.getTime())) return date; }
  return null;
};

const formatDate = (timestamp: any, locale: string = "id-ID"): string => {
  const date = toDate(timestamp);
  if (!date) return "-";
  return date.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
};

const formatDateTime = (timestamp: any, locale: string = "id-ID"): string => {
  const date = toDate(timestamp);
  if (!date) return "-";
  return date.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatTime = (timestamp: any): string => {
  const date = toDate(timestamp);
  if (!date) return "--:--";
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
};

const formatTimeFromString = (timeStr: string, date: Date): Date => {
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
};

const onlyDate = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const calculateWorkHoursFromTimes = (checkInTime: Date, checkOutTime: Date): number => {
  if (!checkInTime || !checkOutTime) return 0;
  if (checkOutTime <= checkInTime) return 0;
  const diffMs = checkOutTime.getTime() - checkInTime.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

const getWorkHours = (attendance: Attendance): number => {
  if (attendance.isCorrected && attendance.correctedCheckIn && attendance.correctedCheckOut) {
    const dateObj = toDate(attendance.date);
    if (dateObj) {
      const checkInTime = formatTimeFromString(attendance.correctedCheckIn, dateObj);
      const checkOutTime = formatTimeFromString(attendance.correctedCheckOut, dateObj);
      return calculateWorkHoursFromTimes(checkInTime, checkOutTime);
    }
  }
  const checkInDate = toDate(attendance.checkIn?.time);
  const checkOutDate = toDate(attendance.checkOut?.time);
  if (checkInDate && checkOutDate) return calculateWorkHoursFromTimes(checkInDate, checkOutDate);
  if (attendance.workHours && attendance.workHours !== "-") {
    const hours = parseFloat(attendance.workHours);
    if (!isNaN(hours) && hours > 0) return hours;
    const hourMatch = attendance.workHours.match(/(\d+(?:[.,]\d+)?)/);
    if (hourMatch) { const parsed = parseFloat(hourMatch[1].replace(",", ".")); if (!isNaN(parsed) && parsed > 0) return parsed; }
  }
  return 0;
};

const formatWorkHours = (hours: number): string => {
  if (hours === 0) return "-";
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours} jam`;
  return `${wholeHours} jam ${minutes} menit`;
};

const getAttendanceStatus = (attendance: Attendance): StatusInfo => {
  const shift = attendance.shift;
  const checkIn = attendance.checkIn;
  const checkOut = attendance.checkOut;
  const isHoliday = shift?.name === "Day Off" || shift?.name === "PHC";
  if (isHoliday) return { status: "libur", label: "📅 Libur", color: "bg-purple-100 text-purple-700" };
  if (shift && !checkIn) return { status: "alpha", label: "❌ Tidak Hadir", color: "bg-red-100 text-red-700" };
  if (checkIn && !checkOut) return { status: "nsp", label: "⚠️ NSP (Belum Pulang)", color: "bg-orange-100 text-orange-700" };
  if (checkIn) {
    const checkInDate = toDate(checkIn.time);
    if (checkInDate) {
      let shiftStartHour = 8, shiftStartMinute = 0, toleransi = 15;
      if (shift && shift.startTime) {
        const startParts = shift.startTime.split(":");
        shiftStartHour = parseInt(startParts[0]);
        shiftStartMinute = parseInt(startParts[1]);
        toleransi = shift.lateTolerance ?? 15;
      }
      const checkInTotalMenit = checkInDate.getHours() * 60 + checkInDate.getMinutes();
      const shiftStartTotalMenit = shiftStartHour * 60 + shiftStartMinute;
      const selisih = checkInTotalMenit - shiftStartTotalMenit;
      if (selisih > toleransi) return { status: "terlambat", label: `⏰ Terlambat ${Math.floor(selisih)} menit`, color: "bg-yellow-100 text-yellow-700" };
    }
  }
  if (checkIn && checkOut) return { status: "hadir", label: "✅ Hadir", color: "bg-green-100 text-green-700" };
  return { status: "unknown", label: "📋 Belum Absen", color: "bg-gray-100 text-gray-500" };
};

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

// ================= KOMPONEN UTAMA =================
export default function AttendancePage() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [corrections, setCorrections] = useState<Record<string, CorrectionRequest>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [correctionsLoading, setCorrectionsLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string>("");
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; type: "in" | "out" } | null>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editCheckInHour, setEditCheckInHour] = useState("");
  const [editCheckInMinute, setEditCheckInMinute] = useState("");
  const [editCheckOutHour, setEditCheckOutHour] = useState("");
  const [editCheckOutMinute, setEditCheckOutMinute] = useState("");
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [isEditingShift, setIsEditingShift] = useState(false);
  const [editShiftId, setEditShiftId] = useState("");
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingDateEdit, setIsSavingDateEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOption, setDeleteOption] = useState<"checkin" | "checkout" | "all">("all");

  // 🔥 STATE MANUAL ATTENDANCE
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualCheckInHour, setManualCheckInHour] = useState("08");
  const [manualCheckInMinute, setManualCheckInMinute] = useState("00");
  const [manualCheckOutHour, setManualCheckOutHour] = useState("");
  const [manualCheckOutMinute, setManualCheckOutMinute] = useState("");
  const [manualShiftId, setManualShiftId] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState("");
  const [showManualDropdown, setShowManualDropdown] = useState(false);

  // 🔥 STATE FILTER - DEFAULT TANGGAL HARI INI
  const getTodayLocalStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [tempDept, setTempDept] = useState("ALL");
  const [tempJabatan, setTempJabatan] = useState("ALL");
  const [tempEmployees, setTempEmployees] = useState<string[]>([]);
  const [tempStartDate, setTempStartDate] = useState(getTodayLocalStr);
  const [tempEndDate, setTempEndDate] = useState(getTodayLocalStr);
  const [tempStatus, setTempStatus] = useState("ALL");

  const [dept, setDept] = useState("ALL");
  const [jabatan, setJabatan] = useState("ALL");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(getTodayLocalStr);
  const [endDate, setEndDate] = useState(getTodayLocalStr);
  const [status, setStatus] = useState("ALL");
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isHR = currentUser?.role === "hr";
  const isSPV = currentUser?.role === "spv";

  const isGlobalAdmin = currentUser?.role === "super_admin" || currentUser?.role === "hr" || 
                        ((currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.role === "gm" || currentUser?.role === "owner") && !currentUser?.department);
  const scopeDepartment = isGlobalAdmin ? null : currentUser?.department;

  // Load department untuk SPV / Manager
  useEffect(() => {
    const loadUserDepartment = async () => {
      if (currentUser?.uid && scopeDepartment) {
        setUserDepartment(scopeDepartment);
      }
    };
    loadUserDepartment();
  }, [currentUser, scopeDepartment]);

  // Load users
  useEffect(() => {
    setUsersLoading(true);
    const qUsers = query(collection(db, "users"), limit(500));
    const unsub = onSnapshot(qUsers, (snap) => {
      const obj: Record<string, User> = {};
      snap.forEach((doc) => { obj[doc.id] = doc.data() as User; });
      setUsers(obj);
      setUsersLoading(false);
      setError(null);
    }, (err) => { console.error("Error loading users:", err); setError("Gagal memuat data pengguna"); setUsersLoading(false); });
    return () => unsub();
  }, []);

  // Load corrections
  useEffect(() => {
    if (usersLoading) return;
    setCorrectionsLoading(true);
    const q = query(collection(db, "attendance_requests"), orderBy("createdAt", "desc"), limit(1000));
    const unsub = onSnapshot(q, (snap) => {
      const obj: Record<string, CorrectionRequest> = {};
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.status === "approved") {
          let dateStr = "";
          if (data.date?.toDate) {
            const d = data.date.toDate();
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          const dateKey = `${data.uid}_${dateStr}`;
          obj[dateKey] = {
            id: doc.id, uid: data.uid, name: data.name, date: data.date,
            checkIn: data.checkIn, checkOut: data.checkOut, status: data.status,
            approvedBy: data.approvedBy, approvedByName: data.approvedByName, approvedAt: data.approvedAt,
          };
        }
      });
      setCorrections(obj);
      setCorrectionsLoading(false);
    }, (err) => { console.error("Error loading corrections:", err); setCorrectionsLoading(false); });
    return () => unsub();
  }, [usersLoading]);

  // Load attendance
  useEffect(() => {
    if (usersLoading || correctionsLoading) return;
    setLoading(true);
    
    let q;
    if (startDate && endDate && !showTodayOnly) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      q = query(
        collection(db, "attendance"),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      );
    } else if (showTodayOnly && startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(startDate);
      end.setHours(23, 59, 59, 999);
      
      q = query(
        collection(db, "attendance"),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      );
    } else {
      q = query(collection(db, "attendance"), orderBy("date", "desc"), limit(2000));
    }
    
    const unsub = onSnapshot(q, (snap) => {
      const arr: Attendance[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const user = users[d.uid] || {};
        if (user.isActive === false) return;
        let dateStr = "";
        if (d.date?.toDate) {
          const dateObj = d.date.toDate();
          dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        }
        const dateKey = `${d.uid}_${dateStr}`;
        const correction = corrections[dateKey];
        let isCorrected = false, correctedCheckIn: string | undefined, correctedCheckOut: string | undefined;
        let checkInData = d.checkIn, checkOutData = d.checkOut;
        if (correction && correction.status === "approved") {
          isCorrected = true;
          correctedCheckIn = correction.checkIn;
          correctedCheckOut = correction.checkOut;
          const dateObj = d.date?.toDate ? d.date.toDate() : new Date();
          if (correction.checkIn) {
            const correctedTime = formatTimeFromString(correction.checkIn, dateObj);
            checkInData = { ...d.checkIn, time: correctedTime, isCorrected: true, photo: d.checkIn?.photo };
          }
          if (correction.checkOut) {
            const correctedTime = formatTimeFromString(correction.checkOut, dateObj);
            checkOutData = { ...d.checkOut, time: correctedTime, isCorrected: true, photo: d.checkOut?.photo };
          }
        }
        arr.push({
          id: doc.id, ...d, name: user.name || d.name || "-",
          department: user.department || d.department || "-", jabatan: user.jabatan || d.jabatan || "-",
          dailyRate: user.dailyRate || d.dailyRate || 0, checkIn: checkInData, checkOut: checkOutData,
          isCorrected, correctedCheckIn, correctedCheckOut,
        } as Attendance);
      });
      setData(arr);
      setLoading(false);
      setError(null);
    }, (err) => { console.error("Error loading attendance:", err); setError("Gagal memuat data absensi"); setLoading(false); });
    return () => unsub();
  }, [users, usersLoading, corrections, correctionsLoading, startDate, endDate, showTodayOnly]);

  // Filter data
  const filtered = useMemo(() => {
    let filteredData = data;
    if (scopeDepartment) filteredData = filteredData.filter(a => a.department === scopeDepartment);
    return filteredData.filter((a) => {
      let ok = true;
      if (dept !== "ALL" && !scopeDepartment) ok = ok && a.department === dept;
      if (jabatan !== "ALL") ok = ok && a.jabatan === jabatan;
      if (selectedEmployees.length > 0) ok = ok && selectedEmployees.includes(a.uid);
      if (status !== "ALL") ok = ok && getAttendanceStatus(a).status === status;
      if (startDate) {
        const date = toDate(a.date);
        if (date) ok = ok && onlyDate(date) >= onlyDate(new Date(startDate));
      }
      if (endDate) {
        const date = toDate(a.date);
        if (date) ok = ok && onlyDate(date) <= onlyDate(new Date(endDate));
      }
      return ok;
    });
  }, [data, dept, jabatan, selectedEmployees, status, startDate, endDate, scopeDepartment]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const hadir = filtered.filter((a) => getAttendanceStatus(a).status === "hadir").length;
    const terlambat = filtered.filter((a) => getAttendanceStatus(a).status === "terlambat").length;
    const alpha = filtered.filter((a) => getAttendanceStatus(a).status === "alpha").length;
    const nsp = filtered.filter((a) => getAttendanceStatus(a).status === "nsp").length;
    const libur = filtered.filter((a) => getAttendanceStatus(a).status === "libur").length;
    const corrected = filtered.filter((a) => a.isCorrected).length;
    return { total, hadir, terlambat, alpha, nsp, libur, corrected };
  }, [filtered]);

  // Recap list
  const recapList = useMemo(() => {
    const recap: Record<string, RecapItem> = {};
    filtered.forEach((a) => {
      if (!recap[a.uid]) recap[a.uid] = {
        uid: a.uid, name: a.name, department: a.department || "-", jabatan: a.jabatan || "-",
        rate: a.dailyRate || 0, totalHari: 0, totalJam: 0, totalGaji: 0, attendanceDetails: [],
      };
      const statusInfo = getAttendanceStatus(a);
      if (statusInfo.status === "hadir" || statusInfo.status === "terlambat") {
        recap[a.uid].totalHari++;
        const jamKerja = getWorkHours(a);
        recap[a.uid].totalJam += jamKerja;
        recap[a.uid].attendanceDetails.push(a);
      }
      recap[a.uid].totalGaji = recap[a.uid].totalHari * (recap[a.uid].rate || 0);
    });
    return Object.values(recap).sort((a, b) => b.totalGaji - a.totalGaji);
  }, [filtered]);

  // 🔥 FUNGSI UNTUK MENAMPILKAN HARI INI
  const setTodayFilter = () => {
    const todayStr = getTodayLocalStr();
    setTempStartDate(todayStr);
    setTempEndDate(todayStr);
    setDept("ALL");
    setJabatan("ALL");
    setSelectedEmployees([]);
    setStatus("ALL");
    setStartDate(todayStr);
    setEndDate(todayStr);
    setShowTodayOnly(true);
    toast.success("Menampilkan data absensi hari ini");
  };

  // 🔥 FUNGSI UNTUK MENAMPILKAN SEMUA DATA (tanpa filter tanggal)
  const setAllDataFilter = () => {
    setTempStartDate("");
    setTempEndDate("");
    setDept("ALL");
    setJabatan("ALL");
    setSelectedEmployees([]);
    setStatus("ALL");
    setStartDate("");
    setEndDate("");
    setShowTodayOnly(false);
    toast.success("Menampilkan semua data absensi");
  };

  const deptList = useMemo(() => {
    const depts = new Set(Object.values(users).map((u) => u.department).filter(Boolean));
    if (scopeDepartment) return ["ALL", scopeDepartment];
    return ["ALL", ...Array.from(depts)];
  }, [users, scopeDepartment]);

  const jabatanList = useMemo(() => ["ALL", ...new Set(Object.values(users).map((u) => u.jabatan).filter(Boolean))], [users]);
  const employeeList = useMemo(() => {
    let employees = [...new Set(data.map((a) => a.uid))];
    if (scopeDepartment) employees = [...new Set(data.filter(a => a.department === scopeDepartment).map(a => a.uid))];
    return ["ALL", ...employees];
  }, [data, scopeDepartment]);

  const applyFilter = useCallback(() => {
    if (tempStartDate && tempEndDate && new Date(tempStartDate) > new Date(tempEndDate)) {
      toast.error("Tanggal mulai harus lebih kecil dari tanggal akhir");
      return;
    }
    setDept(tempDept);
    setJabatan(tempJabatan);
    setSelectedEmployees(tempEmployees);
    setStatus(tempStatus);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowTodayOnly(false);
    toast.success("Filter diterapkan");
  }, [tempDept, tempJabatan, tempEmployees, tempStatus, tempStartDate, tempEndDate]);

  const resetFilter = useCallback(() => {
    setTempDept("ALL");
    setTempJabatan("ALL");
    setTempEmployees([]);
    setTempStatus("ALL");
    setDept("ALL");
    setJabatan("ALL");
    setSelectedEmployees([]);
    setStatus("ALL");
    // Reset ke hari ini
    const todayStr = getTodayLocalStr();
    setTempStartDate(todayStr);
    setTempEndDate(todayStr);
    setStartDate(todayStr);
    setEndDate(todayStr);
    setShowTodayOnly(true);
    toast.success("Reset filter - Menampilkan data hari ini");
  }, []);

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
    setShowTodayOnly(false);
  }, []);

  // CRUD FUNCTIONS
  const loadShiftsList = async () => {
    setIsLoadingShifts(true);
    try {
      const shiftsQuery = query(collection(db, "shifts"), where("isActive", "==", true));
      const snapshot = await getDocs(shiftsQuery);
      const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShiftsList(shifts);
    } catch (error) { console.error("Error loading shifts:", error); } finally { setIsLoadingShifts(false); }
  };

  const openDetailModal = async (attendance: Attendance) => {
    setSelectedAttendance(attendance);
    setIsEditingTime(false);
    setIsEditingShift(false);
    setIsEditingDate(false);
    await loadShiftsList();
    const checkInDate = toDate(attendance.checkIn?.time);
    const checkOutDate = toDate(attendance.checkOut?.time);
    const attendanceDate = toDate(attendance.date);
    if (attendanceDate) {
      setEditDate(attendanceDate.toISOString().split("T")[0]);
    }
    if (checkInDate) {
      setEditCheckInHour(checkInDate.getHours().toString().padStart(2, '0'));
      setEditCheckInMinute(checkInDate.getMinutes().toString().padStart(2, '0'));
    }
    if (checkOutDate) {
      setEditCheckOutHour(checkOutDate.getHours().toString().padStart(2, '0'));
      setEditCheckOutMinute(checkOutDate.getMinutes().toString().padStart(2, '0'));
    }
    setEditShiftId(attendance.shift?.id || "");
    try {
      const userDoc = await getDoc(doc(db, "users", attendance.uid));
      setSelectedUserDetail(userDoc.exists() ? (userDoc.data() as User) : null);
    } catch (error) { console.error("Error loading user detail:", error); setSelectedUserDetail(null); }
    setShowDetailModal(true);
  };

  const saveEditedTime = async () => {
    if (!selectedAttendance || !isSuperAdmin) return;
    setIsSavingEdit(true);
    try {
      const attendanceRef = doc(db, "attendance", selectedAttendance.id);
      const updates: any = {};
      if (editCheckInHour && editCheckInMinute) {
        const checkInDate = toDate(selectedAttendance.checkIn?.time);
        if (checkInDate) {
          const newCheckInTime = new Date(checkInDate);
          newCheckInTime.setHours(parseInt(editCheckInHour), parseInt(editCheckInMinute), 0);
          updates['checkIn.time'] = Timestamp.fromDate(newCheckInTime);
        }
      }
      if (editCheckOutHour && editCheckOutMinute) {
        let checkOutDate = toDate(selectedAttendance.checkOut?.time);
        if (!checkOutDate) {
          checkOutDate = toDate(selectedAttendance.checkIn?.time) || toDate(selectedAttendance.date);
        }
        if (checkOutDate) {
          const newCheckOutTime = new Date(checkOutDate);
          newCheckOutTime.setHours(parseInt(editCheckOutHour), parseInt(editCheckOutMinute), 0);
          updates['checkOut.time'] = Timestamp.fromDate(newCheckOutTime);
          if (!selectedAttendance.checkOut) {
            updates['checkOut.status'] = "Manual Entry";
            updates['checkOut.location'] = { lat: 0, lng: 0, address: "Added via Admin" };
          }
        }
      }
      updates['updatedAt'] = Timestamp.now();
      updates['editedBy'] = currentUser?.uid;
      updates['editedByName'] = currentUser?.name;
      updates['editedAt'] = Timestamp.now();
      await updateDoc(attendanceRef, updates);
      toast.success("✅ Jam absensi berhasil diupdate!");
      setIsEditingTime(false);
      setSelectedAttendance({ ...selectedAttendance, checkIn: updates['checkIn.time'] ? { ...selectedAttendance.checkIn, time: updates['checkIn.time'] } : selectedAttendance.checkIn, checkOut: updates['checkOut.time'] ? { ...selectedAttendance.checkOut, time: updates['checkOut.time'] } : selectedAttendance.checkOut });
    } catch (error) { console.error("Error saving edit:", error); toast.error("❌ Gagal menyimpan perubahan"); } finally { setIsSavingEdit(false); }
  };

  const saveEditedDate = async () => {
    if (!selectedAttendance || !isSuperAdmin) return;
    setIsSavingDateEdit(true);
    try {
      if (!editDate) {
        toast.error("Tanggal tidak boleh kosong");
        return;
      }
      const oldAttendanceRef = doc(db, "attendance", selectedAttendance.id);
      const oldDate = toDate(selectedAttendance.date);
      if (!oldDate) {
        toast.error("Tanggal lama tidak valid");
        return;
      }
      const oldDocId = selectedAttendance.id;
      const newDateParts = editDate.split("-").map(Number);
      const newDate = new Date(newDateParts[0], newDateParts[1] - 1, newDateParts[2], 12, 0, 0);
      const newDocId = `${selectedAttendance.uid}_${editDate}`;
      const existingDoc = await getDoc(doc(db, "attendance", newDocId));
      if (existingDoc.exists() && oldDocId !== newDocId) {
        toast.error(`⚠️ Data absensi untuk ${editDate} sudah ada. Hapus terlebih dahulu atau pilih tanggal lain.`);
        setIsSavingDateEdit(false);
        return;
      }
      const oldData = (await getDoc(oldAttendanceRef)).data();
      if (!oldData) {
        toast.error("Data asli tidak ditemukan");
        setIsSavingDateEdit(false);
        return;
      }
      const updates: any = {
        'date': Timestamp.fromDate(newDate),
        'updatedAt': Timestamp.now(),
        'editedBy': currentUser?.uid,
        'editedByName': currentUser?.name,
        'editedAt': Timestamp.now(),
        'dateEditedFrom': oldDate.toISOString().split("T")[0],
        'dateEditedTo': editDate,
      };
      const newData = { ...oldData, ...updates };
      await setDoc(doc(db, "attendance", newDocId), newData);
      if (oldDocId !== newDocId) {
        await deleteDoc(oldAttendanceRef);
      }
      toast.success("✅ Tanggal absensi berhasil diupdate! Document dipindahkan.");
      setIsEditingDate(false);
      const updatedAttendance = { ...selectedAttendance, id: newDocId, date: Timestamp.fromDate(newDate) };
      setSelectedAttendance(updatedAttendance);
    } catch (error) { console.error("Error saving date edit:", error); toast.error("❌ Gagal menyimpan perubahan tanggal"); } finally { setIsSavingDateEdit(false); }
  };

  const saveEditedShift = async () => {
    if (!selectedAttendance || !isSuperAdmin) return;
    setIsSavingEdit(true);
    try {
      const attendanceRef = doc(db, "attendance", selectedAttendance.id);
      const selectedShift = shiftsList.find(s => s.id === editShiftId);
      if (!selectedShift) { toast.error("Shift tidak ditemukan"); return; }
      const updates: any = {
        'shift': {
          id: selectedShift.id, name: selectedShift.name, code: selectedShift.code,
          startTime: selectedShift.startTime, endTime: selectedShift.endTime,
          color: selectedShift.color, lateTolerance: selectedShift.lateTolerance || 15,
        },
        'updatedAt': Timestamp.now(), 'editedBy': currentUser?.uid, 'editedByName': currentUser?.name, 'editedAt': Timestamp.now(),
      };
      await updateDoc(attendanceRef, updates);
      toast.success("✅ Shift absensi berhasil diupdate!");
      setIsEditingShift(false);
      setSelectedAttendance({ ...selectedAttendance, shift: updates['shift'] });
    } catch (error) { console.error("Error saving shift edit:", error); toast.error("❌ Gagal menyimpan perubahan shift"); } finally { setIsSavingEdit(false); }
  };

  const deleteAttendance = async () => {
    if (!selectedAttendance || !isSuperAdmin) return;
    setIsDeleting(true);
    try {
      const attendanceRef = doc(db, "attendance", selectedAttendance.id);
      const updates: any = { 'updatedAt': Timestamp.now() };

      if (deleteOption === "checkin") {
        updates['checkIn'] = null;
        toast.success("✅ Data check-in berhasil dihapus!");
      } else if (deleteOption === "checkout") {
        updates['checkOut'] = null;
        toast.success("✅ Data check-out berhasil dihapus!");
      } else {
        await deleteDoc(attendanceRef);
        toast.success("✅ Data absensi berhasil dihapus!");
        setShowDetailModal(false);
      }

      if (deleteOption !== "all") {
        await updateDoc(attendanceRef, updates);
      }

      setShowDeleteModal(false);
    } catch (error) { console.error("Error deleting attendance:", error); toast.error("❌ Gagal menghapus data absensi"); } finally { setIsDeleting(false); }
  };

  const openDeleteModal = (option: "checkin" | "checkout" | "all") => {
    setDeleteOption(option);
    setShowDeleteModal(true);
  };

  const openManualModal = async () => {
    setManualDate(getTodayLocalStr());
    setManualUid("");
    setManualNote("");
    setManualCheckInHour("08");
    setManualCheckInMinute("00");
    setManualCheckOutHour("");
    setManualCheckOutMinute("");
    if (shiftsList.length === 0) {
      await loadShiftsList();
    }
    setShowManualModal(true);
  };

  const handleAddManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUid || !manualDate || !manualShiftId || !manualCheckInHour || !manualCheckInMinute) {
      toast.error("Harap isi Karyawan, Tanggal, Shift, dan Jam Masuk");
      return;
    }
    setIsSavingManual(true);
    try {
      const selectedShift = shiftsList.find((s) => s.id === manualShiftId);
      const user = users[manualUid];
      
      const newDateParts = manualDate.split("-").map(Number);
      const attendanceDate = new Date(newDateParts[0], newDateParts[1] - 1, newDateParts[2], 12, 0, 0);
      
      const checkInTime = new Date(attendanceDate);
      checkInTime.setHours(parseInt(manualCheckInHour), parseInt(manualCheckInMinute), 0);
      
      let checkOutObj = null;
      if (manualCheckOutHour && manualCheckOutMinute) {
        const checkOutTime = new Date(attendanceDate);
        checkOutTime.setHours(parseInt(manualCheckOutHour), parseInt(manualCheckOutMinute), 0);
        checkOutObj = {
          time: Timestamp.fromDate(checkOutTime),
          location: "Manual Entry",
          note: manualNote,
          isCorrected: true,
          photo: ""
        };
      }

      const checkInObj = {
        time: Timestamp.fromDate(checkInTime),
        location: "Manual Entry",
        note: manualNote,
        isCorrected: true,
        photo: ""
      };

      const newDocId = `${manualUid}_${manualDate}`;
      const existingDoc = await getDoc(doc(db, "attendance", newDocId));
      if (existingDoc.exists()) {
        toast.error(`⚠️ Data absensi untuk ${user?.name} pada ${manualDate} sudah ada. Silakan edit atau hapus data tersebut terlebih dahulu.`);
        setIsSavingManual(false);
        return;
      }

      const attendanceData = {
        uid: manualUid,
        name: user?.name || "",
        department: user?.department || "",
        jabatan: user?.jabatan || "",
        dailyRate: user?.dailyRate || 0,
        date: Timestamp.fromDate(attendanceDate),
        checkIn: checkInObj,
        checkOut: checkOutObj,
        shift: selectedShift ? {
          id: selectedShift.id,
          name: selectedShift.name,
          code: selectedShift.code,
          startTime: selectedShift.startTime,
          endTime: selectedShift.endTime,
          color: selectedShift.color,
          lateTolerance: selectedShift.lateTolerance || 15
        } : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        editedBy: currentUser?.uid,
        editedByName: currentUser?.name,
        isManualEntry: true
      };

      await setDoc(doc(db, "attendance", newDocId), attendanceData);
      toast.success("✅ Absensi manual berhasil ditambahkan!");
      setShowManualModal(false);
    } catch (error) {
      console.error("Error saving manual attendance:", error);
      toast.error("❌ Gagal menyimpan absensi manual");
    } finally {
      setIsSavingManual(false);
    }
  };

  // EXPORT FUNCTIONS
  const exportDetailExcel = async () => {
    setExporting("detail-excel");
    try {
      const rows = filtered.map((a) => {
        const statusInfo = getAttendanceStatus(a);
        return {
          Nama: a.name || "-",
          Department: a.department || "-",
          Jabatan: a.jabatan || "-",
          Shift: a.shift?.name || "-",
          Tanggal: formatDate(a.date) || "-",
          Jam_Masuk: a.isCorrected && a.correctedCheckIn ? a.correctedCheckIn : (formatTime(a.checkIn?.time) || "--:--"),
          Jam_Pulang: a.isCorrected && a.correctedCheckOut ? a.correctedCheckOut : (formatTime(a.checkOut?.time) || "--:--"),
          Jam_Kerja: formatWorkHours(getWorkHours(a)) || "-",
          Status: statusInfo.label,
          Bank: users[a.uid]?.bankName || "-",
          No_Rekening: users[a.uid]?.bankAccountNumber || "-",
          Nama_Rekening: users[a.uid]?.bankAccountName || "-",
          Status_Koreksi: a.isCorrected ? "Sudah Dikoreksi" : "Normal",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detail Attendance");
      ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }
      ];
      XLSX.writeFile(wb, `attendance_detail_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Export Excel berhasil");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  const exportDetailPDF = async () => {
    setExporting("detail-pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      autoTable(doc, {
        head: [["Nama", "Dept", "Jabatan", "Shift", "Tanggal", "Masuk", "Pulang", "Jam Kerja", "Status", "Bank", "No Rekening", "Nama Rekening"]],
        body: filtered.map((a) => {
          const statusInfo = getAttendanceStatus(a);
          return [
            a.name || "-",
            a.department || "-",
            a.jabatan || "-",
            a.shift?.name || "-",
            formatDate(a.date) || "-",
            a.isCorrected && a.correctedCheckIn ? a.correctedCheckIn : (formatTime(a.checkIn?.time) || "--:--"),
            a.isCorrected && a.correctedCheckOut ? a.correctedCheckOut : (formatTime(a.checkOut?.time) || "--:--"),
            formatWorkHours(getWorkHours(a)) || "-",
            statusInfo.label,
            users[a.uid]?.bankName || "-",
            users[a.uid]?.bankAccountNumber || "-",
            users[a.uid]?.bankAccountName || "-",
          ];
        }) as any,
        headStyles: { fillColor: [5, 150, 105] },
        startY: 20,
      });
      doc.save(`attendance_detail_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Export PDF berhasil");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  const exportRecapExcel = async () => {
    setExporting("recap-excel");
    try {
      const rows = recapList.map((r) => ({
        Nama: r.name || "-",
        Department: r.department || "-",
        Jabatan: r.jabatan || "-",
        Hari_Kerja: r.totalHari,
        Total_Jam: `${r.totalJam.toFixed(2)} jam`,
        Rata_Rata_Jam: r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-",
        Rate: r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
        Total_Gaji: r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Gaji");
      XLSX.writeFile(wb, `attendance_rekap_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Export Excel berhasil");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengexport data");
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
          r.name || "-",
          r.department || "-",
          r.jabatan || "-",
          r.totalHari,
          `${r.totalJam.toFixed(2)} jam`,
          r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-",
          r.rate ? `Rp ${r.rate.toLocaleString()}` : "-",
          r.totalGaji ? `Rp ${r.totalGaji.toLocaleString()}` : "-",
        ]) as any,
        headStyles: { fillColor: [5, 150, 105] },
        startY: 20,
      });
      doc.save(`attendance_rekap_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Export PDF berhasil");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  if (loading || usersLoading || correctionsLoading) {
    return <LoadingScreen fullScreen={false} message="Memuat data absensi..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-200">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Coba Lagi</button>
        </div>
      </div>
    );
  }

    return (
      <ProtectedRoute requiredFeature="view_attendance">
        <div className="space-y-6 pb-20">
          {/* Unified Toolbar (Stats, Filters, Actions) */}
        {/* Stats Cards - Sleek SaaS Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hadir</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.hadir}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terlambat</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.terlambat}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tidak Hadir</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.alpha}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">NSP</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.nsp}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Libur</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.libur}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dikoreksi</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.corrected}</p>
            </div>
          </div>
        </div>

        {/* Unified Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Filter & Export
                  {showTodayOnly && <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] border border-emerald-100">📅 Hari Ini</span>}
                </h2>
                <p className="text-xs text-slate-500">Sesuaikan data yang ingin ditampilkan</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex flex-wrap gap-2">
                <button onClick={setTodayFilter} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${showTodayOnly ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <CalendarDays className="w-3.5 h-3.5" /> Hari Ini
                </button>
                <button onClick={setAllDataFilter} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${!showTodayOnly && !startDate ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <Users className="w-3.5 h-3.5" /> Semua Data
                </button>
                <button onClick={setPayrollPeriod} className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200">
                  <CalendarDays className="w-3.5 h-3.5" /> Periode 26-25
                </button>
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors ml-auto lg:ml-2"
                title={isFilterOpen ? "Sembunyikan Filter" : "Tampilkan Filter"}
              >
                {isFilterOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isFilterOpen && (
            <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t border-slate-100 mt-2 animate-fade-in">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="relative">
                  <select value={tempDept} onChange={(e) => setTempDept(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors">
                    {deptList.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="relative">
                  <select value={tempJabatan} onChange={(e) => setTempJabatan(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors">
                    {jabatanList.map((j) => <option key={j}>{j}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsEmployeeModalOpen(true)}
                    className="w-full text-left appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors truncate"
                  >
                    {tempEmployees.length > 0 ? `${tempEmployees.length} Karyawan Dipilih` : "Semua Karyawan"}
                  </button>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="relative">
                  <select value={tempStatus} onChange={(e) => setTempStatus(e.target.value)} className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors">
                    <option value="ALL">Semua Status</option>
                    <option value="hadir">Hadir</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="alpha">Tidak Hadir</option>
                    <option value="nsp">NSP</option>
                    <option value="libur">Libur</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="flex gap-2 col-span-1 md:col-span-2 lg:col-span-1 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                  <DatePicker
                    selectsRange={true}
                    startDate={tempStartDate ? new Date(tempStartDate) : undefined}
                    endDate={tempEndDate ? new Date(tempEndDate) : undefined}
                    onChange={(update: [Date | null, Date | null]) => {
                      const [start, end] = update;
                      // Keep timezone offset out by extracting year, month, date locally
                      const formatDate = (d: Date | null) => {
                        if (!d) return "";
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${day}`;
                      };
                      setTempStartDate(formatDate(start));
                      setTempEndDate(formatDate(end));
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Pilih Rentang Tanggal"
                    className="w-full bg-transparent px-3 py-2 text-sm text-slate-700 outline-none border-none placeholder-slate-400 focus:ring-0 cursor-pointer"
                    wrapperClassName="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                {(isSuperAdmin || isHR) && (
                  <button onClick={openManualModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 mr-2 shadow-sm">
                    <FileEdit className="w-4 h-4" /> <span className="hidden sm:inline">Tambah Manual</span>
                  </button>
                )}
                <button onClick={applyFilter} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
                  <Search className="w-4 h-4" /> <span className="hidden sm:inline">Terapkan</span>
                </button>
                <button onClick={resetFilter} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center" title="Reset Filter">
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="w-px h-8 bg-slate-200 mx-1 hidden lg:block"></div>

                {/* Export Button Group */}
                <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-2 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-medium flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> Export
                  </div>
                  <button onClick={exportDetailExcel} disabled={exporting !== null} className="hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium transition-colors border-r border-slate-200 flex items-center gap-1.5 group" title="Export Excel">
                    {exporting === "detail-excel" ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />}
                    <span className="hidden xl:inline">Excel</span>
                  </button>
                  <button onClick={exportDetailPDF} disabled={exporting !== null} className="hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium transition-colors border-r border-slate-200 flex items-center gap-1.5 group" title="Export PDF">
                    {exporting === "detail-pdf" ? <RefreshCw className="w-4 h-4 animate-spin text-red-600" /> : <FileText className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />}
                    <span className="hidden xl:inline">PDF</span>
                  </button>
                  <button onClick={exportRecapExcel} disabled={exporting !== null} className="hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium transition-colors border-r border-slate-200 flex items-center gap-1.5 group" title="Export Rekap Excel">
                    {exporting === "recap-excel" ? <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> : <FileSpreadsheet className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />}
                    <span className="hidden xl:inline">Rekap XLS</span>
                  </button>
                  <button onClick={exportRecapPDF} disabled={exporting !== null} className="hover:bg-slate-50 text-slate-700 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 group" title="Export Rekap PDF">
                    {exporting === "recap-pdf" ? <RefreshCw className="w-4 h-4 animate-spin text-purple-600" /> : <FileText className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />}
                    <span className="hidden xl:inline">Rekap PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2"><span>📋</span> Detail Absensi</h2>
              <span className="text-sm text-gray-500">{filtered.length} record ditemukan</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-4 py-4 text-left">Nama</th>
                  <th className="px-4 py-4 text-left">Dept</th>
                  <th className="px-4 py-4 text-left">Jabatan</th>
                  <th className="px-4 py-4 text-left">Shift</th>
                  <th className="px-4 py-4 text-left">Tanggal</th>
                  <th className="px-4 py-4 text-left">Masuk</th>
                  <th className="px-4 py-4 text-left">Pulang</th>
                  <th className="px-4 py-4 text-left">Jam Kerja</th>
                  <th className="px-4 py-4 text-left">Foto</th>
                  <th className="px-4 py-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((a, idx) => {
                  const workHours = getWorkHours(a);
                  const masukDisplay = a.isCorrected && a.correctedCheckIn ? a.correctedCheckIn : formatTime(a.checkIn?.time);
                  const pulangDisplay = a.isCorrected && a.correctedCheckOut ? a.correctedCheckOut : formatTime(a.checkOut?.time);
                  const statusInfo = getAttendanceStatus(a);
                  return (
                    <tr key={a.id} onClick={() => openDetailModal(a)} className={`border-b cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-50`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.department}</td>
                      <td className="px-4 py-3 text-gray-600">{a.jabatan}</td>
                      <td className="px-4 py-3">{a.shift ? <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.shift.color }} /><span className="text-xs text-gray-700">{a.shift.name}</span></div> : "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(a.date)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${a.checkIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{masukDisplay || "--:--"}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${a.checkOut ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{pulangDisplay || "--:--"}</span></td>
                      <td className="px-4 py-3 font-mono text-gray-600">{workHours > 0 ? formatWorkHours(workHours) : "-"}</td>
                      <td className="px-4 py-3"><div className="flex gap-2">{a.checkIn?.photo && <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><span className="text-xs text-green-600 font-medium">IN</span></div>}{a.checkOut?.photo && <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-xs text-blue-600 font-medium">OUT</span></div>}</div></td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-12 text-center text-gray-500"><div className="text-5xl mb-4">📭</div><p className="text-lg font-medium">Tidak ada data absensi hari ini</p></div>}
            {filtered.length > 100 && <div className="p-4 text-center text-gray-500 text-sm border-t">Menampilkan 100 dari {filtered.length} record. Export untuk melihat semua data.</div>}
          </div>
        </div>

        {/* Recap Table */}
        {recapList.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2"><span>💰</span> Rekap Gaji (Harian / Borongan)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <th className="px-4 py-4 text-left">Nama</th>
                    <th className="px-4 py-4 text-left">Dept</th>
                    <th className="px-4 py-4 text-left">Jabatan</th>
                    <th className="px-4 py-4 text-left">Hari Kerja</th>
                    <th className="px-4 py-4 text-left">Total Jam</th>
                    <th className="px-4 py-4 text-left">Rata-rata Jam</th>
                    <th className="px-4 py-4 text-left">Rate</th>
                    <th className="px-4 py-4 text-left">Total Gaji</th>
                  </tr>
                </thead>
                <tbody>
                  {recapList.map((r, idx) => (
                    <tr key={r.uid} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-50`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.department}</td>
                      <td className="px-4 py-3 text-gray-600">{r.jabatan}</td>
                      <td className="px-4 py-3"><span className="font-bold text-blue-600">{r.totalHari}</span> hari</td>
                      <td className="px-4 py-3"><span className="font-bold text-green-600">{r.totalJam.toFixed(2)}</span> jam</td>
                      <td className="px-4 py-3">{r.totalHari > 0 ? `${(r.totalJam / r.totalHari).toFixed(2)} jam` : "-"}</td>
                      <td className="px-4 py-3">Rp {r.rate?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3"><span className="font-bold text-green-600">Rp {r.totalGaji?.toLocaleString() || 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL ABSENSI DENGAN FOTO LENGKAP */}
      {showDetailModal && selectedAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scale-in border border-slate-200">
            {/* Header Modal */}
            <div className="bg-emerald-600 px-6 py-5 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
                  <span className="text-white text-xl font-bold">{getInitials(selectedAttendance.name)}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{selectedAttendance.name}</h2>
                  <p className="text-emerald-100 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                    <Users className="w-3.5 h-3.5" />
                    {selectedAttendance.department} <span className="opacity-50">•</span> {selectedAttendance.jabatan}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setShowDeleteModal(false); }} className="text-emerald-100 hover:text-white hover:bg-emerald-500/50 p-2 rounded-xl transition-all relative z-10">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 overflow-y-auto max-h-[75vh] bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informasi Absensi */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-400" /> Informasi Absensi
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Tanggal</span>
                      <span className="font-semibold text-slate-800">{formatDate(selectedAttendance.date)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Shift</span>
                      <div className="flex items-center gap-2">
                        {selectedAttendance.shift && (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedAttendance.shift.color }} />
                            <span className="font-semibold text-slate-800">{selectedAttendance.shift.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                              {selectedAttendance.shift.startTime} - {selectedAttendance.shift.endTime}
                            </span>
                          </>
                        )}
                        {!selectedAttendance.shift && <span className="text-slate-400 font-medium">-</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Status</span>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getAttendanceStatus(selectedAttendance).color.replace('bg-', 'bg-opacity-10 border-')}`}>
                        {getAttendanceStatus(selectedAttendance).label}
                      </span>
                    </div>
                    {selectedAttendance.isCorrected && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-500 text-sm font-medium">Status Koreksi</span>
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-orange-50 text-orange-600 border border-orange-200 flex items-center gap-1.5">
                          <FileEdit className="w-3.5 h-3.5" /> Dikoreksi
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Waktu Absensi */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Waktu Kehadiran
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Check-in</span>
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        {selectedAttendance.isCorrected && selectedAttendance.correctedCheckIn ? (
                          <>{selectedAttendance.correctedCheckIn} <FileEdit className="w-3.5 h-3.5 text-orange-500" /></>
                        ) : (
                          formatDateTime(selectedAttendance.checkIn?.time) || "--:--"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Check-out</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        {selectedAttendance.isCorrected && selectedAttendance.correctedCheckOut ? (
                          <>{selectedAttendance.correctedCheckOut} <FileEdit className="w-3.5 h-3.5 text-orange-500" /></>
                        ) : (
                          formatDateTime(selectedAttendance.checkOut?.time) || "--:--"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500 text-sm font-medium">Jam Kerja</span>
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {formatWorkHours(getWorkHours(selectedAttendance))}
                      </span>
                    </div>
                    {selectedAttendance.distance && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-500 text-sm font-medium">Jarak Lokasi</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {selectedAttendance.distance.toFixed(0)} meter
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 🔥 FOTO ABSENSI - FULL SIZE */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-slate-400" /> Bukti Kehadiran
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Foto Check-in */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group/card">
                        <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                              Check-in
                            </span>
                            <span className="text-xs font-medium text-emerald-600/70 bg-emerald-100/50 px-2 py-1 rounded-md">
                              {formatTime(selectedAttendance.checkIn?.time)}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50/50">
                          {selectedAttendance.checkIn?.photo ? (
                            <div 
                              className="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                              onClick={() => window.open(selectedAttendance.checkIn?.photo, '_blank')}
                            >
                              <img 
                                src={selectedAttendance.checkIn.photo} 
                                alt="Check-in"
                                className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/f8fafc/94a3b8?text=Foto+Tidak+Tersedia';
                                }}
                              />
                              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-slate-900/80 px-4 py-2 rounded-lg backdrop-blur-sm transition-all transform translate-y-4 group-hover:translate-y-0 flex items-center gap-2 shadow-xl">
                                  <ImageIcon className="w-4 h-4" /> Perbesar Foto
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-64 bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300">
                              <ImageIcon className="w-12 h-12 text-slate-300 mb-3" />
                              <p className="text-slate-400 text-sm font-medium">Tidak ada foto</p>
                            </div>
                          )}
                        </div>
                        {/* Info Lokasi Check-in */}
                        {selectedAttendance.checkIn?.location && (
                          <div className="px-3 pb-3 bg-slate-50/50">
                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                              <span className="flex-1 truncate font-medium">{selectedAttendance.checkIn.location}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Foto Check-out */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group/card">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                              Check-out
                            </span>
                            <span className="text-xs font-medium text-blue-600/70 bg-blue-100/50 px-2 py-1 rounded-md">
                              {formatTime(selectedAttendance.checkOut?.time)}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50/50">
                          {selectedAttendance.checkOut?.photo ? (
                            <div 
                              className="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                              onClick={() => window.open(selectedAttendance.checkOut?.photo, '_blank')}
                            >
                              <img 
                                src={selectedAttendance.checkOut.photo} 
                                alt="Check-out"
                                className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/f8fafc/94a3b8?text=Foto+Tidak+Tersedia';
                                }}
                              />
                              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-slate-900/80 px-4 py-2 rounded-lg backdrop-blur-sm transition-all transform translate-y-4 group-hover:translate-y-0 flex items-center gap-2 shadow-xl">
                                  <ImageIcon className="w-4 h-4" /> Perbesar Foto
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-64 bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300">
                              <ImageIcon className="w-12 h-12 text-slate-300 mb-3" />
                              <p className="text-slate-400 text-sm font-medium">Tidak ada foto</p>
                            </div>
                          )}
                        </div>
                        {/* Info Lokasi Check-out */}
                        {selectedAttendance.checkOut?.location && (
                          <div className="px-3 pb-3 bg-slate-50/50">
                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                              <span className="flex-1 truncate font-medium">{selectedAttendance.checkOut.location}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catatan (jika ada) */}
                {(selectedAttendance.checkIn?.note || selectedAttendance.checkOut?.note) && (
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" /> Catatan Kehadiran
                      </h3>
                      <div className="space-y-3">
                        {selectedAttendance.checkIn?.note && (
                          <div className="p-4 bg-slate-50 rounded-xl border-l-4 border-emerald-500 shadow-sm">
                            <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-wider mb-1.5">Catatan Check-in</p>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedAttendance.checkIn.note}</p>
                          </div>
                        )}
                        {selectedAttendance.checkOut?.note && (
                          <div className="p-4 bg-slate-50 rounded-xl border-l-4 border-blue-500 shadow-sm">
                            <p className="text-xs font-bold text-blue-600/80 uppercase tracking-wider mb-1.5">Catatan Check-out</p>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedAttendance.checkOut.note}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Edit dan Hapus untuk Super Admin */}
              {isSuperAdmin && !isEditingShift && !isEditingTime && !isEditingDate && (
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap justify-end gap-3">
                  <button
                    onClick={() => setIsEditingDate(true)}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <Calendar className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                    Edit Tanggal
                  </button>
                  <button
                    onClick={() => setIsEditingShift(true)}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                    Edit Shift
                  </button>
                  <button
                    onClick={() => setIsEditingTime(true)}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <Clock className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                    Edit Jam Kerja
                  </button>
                  <div className="w-px h-10 bg-slate-200 mx-1 hidden sm:block"></div>
                  <button 
                    onClick={openDeleteModal.bind(null, "all")} 
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Hapus Absensi
                  </button>
                </div>
              )}

              {/* Tombol Hapus Check-in / Check-out terpisah */}
              {isSuperAdmin && !isEditingShift && !isEditingTime && !isEditingDate && (selectedAttendance.checkIn || selectedAttendance.checkOut) && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {selectedAttendance.checkIn && (
                    <button
                      onClick={openDeleteModal.bind(null, "checkin")}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium border border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Check-in ({formatTime(selectedAttendance.checkIn?.time)})
                    </button>
                  )}
                  {selectedAttendance.checkOut && (
                    <button
                      onClick={openDeleteModal.bind(null, "checkout")}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium border border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Check-out ({formatTime(selectedAttendance.checkOut?.time)})
                    </button>
                  )}
                </div>
              )}

              {/* Form Edit Tanggal */}
              {isEditingDate && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mt-4 animate-fade-in">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" /> Edit Tanggal Absensi
                  </h4>
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Baru</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none bg-slate-50 hover:bg-white"
                    />
                    <p className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Tanggal saat ini: {formatDate(selectedAttendance.date)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveEditedDate}
                      disabled={isSavingDateEdit}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSavingDateEdit ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileEdit className="w-4 h-4" />
                      )}
                      {isSavingDateEdit ? "Menyimpan..." : "Simpan Tanggal"}
                    </button>
                    <button
                      onClick={() => setIsEditingDate(false)}
                      className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm"
                    >
                      Batal
                    </button>
                  </div>
                  <p className="text-xs font-medium text-orange-600 mt-3 flex items-center gap-1.5 bg-orange-50 p-2 rounded-lg border border-orange-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Perubahan tanggal akan mempengaruhi laporan dan rekap absensi
                  </p>
                </div>
              )}

              {/* Form Edit Shift */}
              {isEditingShift && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mt-4 animate-fade-in">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-600" /> Edit Shift
                  </h4>
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Shift Baru</label>
                    {isLoadingShifts ? (
                      <div className="flex justify-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={editShiftId}
                          onChange={(e) => setEditShiftId(e.target.value)}
                          className="w-full appearance-none px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-slate-50 hover:bg-white text-slate-700 font-medium"
                        >
                          <option value="">-- Pilih Shift --</option>
                          {shiftsList.map((shift) => (
                            <option key={shift.id} value={shift.id}>
                              {shift.name} ({shift.startTime} - {shift.endTime})
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveEditedShift}
                      disabled={isSavingEdit || !editShiftId}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSavingEdit ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileEdit className="w-4 h-4" />
                      )}
                      {isSavingEdit ? "Menyimpan..." : "Simpan Shift"}
                    </button>
                    <button
                      onClick={() => setIsEditingShift(false)}
                      className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm"
                    >
                      Batal
                    </button>
                  </div>
                  <p className="text-xs font-medium text-blue-600 mt-3 flex items-center gap-1.5 bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <Info className="w-4 h-4 shrink-0" />
                    Perubahan shift akan memperbarui perhitungan jam kerja secara otomatis
                  </p>
                </div>
              )}

              {/* Form Edit Jam */}
              {isEditingTime && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mt-4 animate-fade-in">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" /> Edit Jam Kerja
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Check-in Baru</label>
                      <div className="flex gap-2 items-center">
                        <select
                          value={editCheckInHour}
                          onChange={(e) => setEditCheckInHour(e.target.value)}
                          className="flex-1 appearance-none px-3 py-2 border border-slate-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Jam</option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-slate-400 font-bold">:</span>
                        <select
                          value={editCheckInMinute}
                          onChange={(e) => setEditCheckInMinute(e.target.value)}
                          className="flex-1 appearance-none px-3 py-2 border border-slate-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Menit</option>
                          {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Check-out Baru</label>
                      <div className="flex gap-2 items-center">
                        <select
                          value={editCheckOutHour}
                          onChange={(e) => setEditCheckOutHour(e.target.value)}
                          className="flex-1 appearance-none px-3 py-2 border border-slate-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Jam</option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-slate-400 font-bold">:</span>
                        <select
                          value={editCheckOutMinute}
                          onChange={(e) => setEditCheckOutMinute(e.target.value)}
                          className="flex-1 appearance-none px-3 py-2 border border-slate-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Menit</option>
                          {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveEditedTime}
                      disabled={isSavingEdit}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSavingEdit ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileEdit className="w-4 h-4" />
                      )}
                      {isSavingEdit ? "Menyimpan..." : "Simpan Jam Kerja"}
                    </button>
                    <button
                      onClick={() => setIsEditingTime(false)}
                      className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm"
                    >
                      Batal
                    </button>
                  </div>
                  <p className="text-xs font-medium text-amber-600 mt-3 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Perubahan ini akan tercatat dengan status "Dikoreksi"
                  </p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-all shadow-sm shadow-slate-900/10 active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {showDeleteModal && selectedAttendance && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="bg-red-600 px-6 py-4 rounded-t-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⚠️</span> Konfirmasi Hapus
              </h2>
            </div>
            <div className="p-6">
              {deleteOption === "all" ? (
                <>
              <p className="text-gray-700 mb-4">
                Apakah Anda yakin ingin menghapus seluruh data absensi berikut?
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-gray-800">{selectedAttendance.name}</p>
                <p className="text-sm text-gray-500">{formatDate(selectedAttendance.date)}</p>
                {selectedAttendance.checkIn && (
                  <p className="text-sm text-gray-500">Check-in: {formatTime(selectedAttendance.checkIn?.time)}</p>
                )}
                {selectedAttendance.checkOut && (
                  <p className="text-sm text-gray-500">Check-out: {formatTime(selectedAttendance.checkOut?.time)}</p>
                )}
              </div>
                </>
              ) : deleteOption === "checkin" ? (
                <>
              <p className="text-gray-700 mb-4">
                Apakah Anda yakin ingin menghapus data check-in berikut?
              </p>
              <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
                <p className="font-medium text-gray-800">{selectedAttendance.name}</p>
                <p className="text-sm text-gray-500">{formatDate(selectedAttendance.date)}</p>
                <p className="text-sm text-green-600 font-medium">Check-in: {formatTime(selectedAttendance.checkIn?.time)}</p>
              </div>
                </>
              ) : (
                <>
              <p className="text-gray-700 mb-4">
                Apakah Anda yakin ingin menghapus data check-out berikut?
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <p className="font-medium text-gray-800">{selectedAttendance.name}</p>
                <p className="text-sm text-gray-500">{formatDate(selectedAttendance.date)}</p>
                <p className="text-sm text-blue-600 font-medium">Check-out: {formatTime(selectedAttendance.checkOut?.time)}</p>
              </div>
                </>
              )}
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Tindakan ini tidak dapat dibatalkan. Data absensi akan dihapus permanen.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={deleteAttendance}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>🗑️</span>
                  )}
                  {isDeleting ? "Menghapus..." : deleteOption === "checkin" ? "Hapus Check-in" : deleteOption === "checkout" ? "Hapus Check-out" : "Ya, Hapus Semua"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Absensi Manual */}
      {showManualModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowManualModal(false)} />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col relative z-10 animate-scale-in max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-indigo-600" />
                Tambah Absensi Manual
              </h3>
              <button onClick={() => setShowManualModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddManualAttendance} className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Karyawan <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all text-slate-800 flex items-center justify-between cursor-text"
                      onClick={() => setShowManualDropdown(true)}
                    >
                      <input 
                        type="text" 
                        placeholder="Cari Karyawan..." 
                        value={manualSearchTerm} 
                        onChange={(e) => {
                          setManualSearchTerm(e.target.value);
                          setShowManualDropdown(true);
                        }}
                        onFocus={() => setShowManualDropdown(true)}
                        className="bg-transparent border-none outline-none w-full text-sm placeholder-slate-400"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowManualDropdown(!showManualDropdown); }} />
                    </div>
                    
                    {showManualDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {Object.entries(users)
                          .filter(([uid, u]) => 
                            u.name.toLowerCase().includes(manualSearchTerm.toLowerCase()) || 
                            (u.department || "").toLowerCase().includes(manualSearchTerm.toLowerCase())
                          )
                          .map(([uid, u]) => (
                            <div 
                              key={uid} 
                              className={`px-4 py-2 cursor-pointer text-sm hover:bg-indigo-50 hover:text-indigo-700 ${manualUid === uid ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                              onClick={() => {
                                setManualUid(uid);
                                setManualSearchTerm(`${u.name} - ${u.department || '-'}`);
                                setShowManualDropdown(false);
                              }}
                            >
                              <div className="font-medium">{u.name}</div>
                              <div className="text-xs opacity-70">{u.department || '-'}</div>
                            </div>
                        ))}
                        {Object.entries(users).filter(([uid, u]) => 
                            u.name.toLowerCase().includes(manualSearchTerm.toLowerCase()) || 
                            (u.department || "").toLowerCase().includes(manualSearchTerm.toLowerCase())
                          ).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500 text-center">Karyawan tidak ditemukan</div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Hidden required input to block form submission if manualUid is empty */}
                  <input type="text" required value={manualUid} className="opacity-0 absolute h-0 w-0 pointer-events-none" onChange={() => {}} tabIndex={-1} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shift <span className="text-red-500">*</span></label>
                  <select
                    value={manualShiftId}
                    onChange={(e) => setManualShiftId(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                  >
                    <option value="">Pilih Shift</option>
                    {shiftsList.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.startTime} - {shift.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jam Masuk <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0" max="23"
                        required
                        value={manualCheckInHour}
                        onChange={(e) => setManualCheckInHour(e.target.value.padStart(2, '0'))}
                        className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center"
                        placeholder="HH"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min="0" max="59"
                        required
                        value={manualCheckInMinute}
                        onChange={(e) => setManualCheckInMinute(e.target.value.padStart(2, '0'))}
                        className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center"
                        placeholder="MM"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jam Pulang <span className="text-slate-400 text-xs font-normal">(Opsional)</span></label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0" max="23"
                        value={manualCheckOutHour}
                        onChange={(e) => setManualCheckOutHour(e.target.value.padStart(2, '0'))}
                        className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center"
                        placeholder="HH"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min="0" max="59"
                        value={manualCheckOutMinute}
                        onChange={(e) => setManualCheckOutMinute(e.target.value.padStart(2, '0'))}
                        className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center"
                        placeholder="MM"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catatan <span className="text-slate-400 text-xs font-normal">(Opsional)</span></label>
                  <textarea
                    rows={2}
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Contoh: Karyawan lupa absen masuk, dsb."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 resize-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingManual}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isSavingManual ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {isSavingManual ? "Menyimpan..." : "Simpan Absensi"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Employee Filter Modal */}
      <EmployeeFilterModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSave={(uids) => {
          setTempEmployees(uids);
        }}
        users={users}
        employeeList={employeeList}
        initialSelected={tempEmployees}
      />

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </ProtectedRoute>
  );
}