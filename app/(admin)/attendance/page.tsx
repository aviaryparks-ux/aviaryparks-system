// app/(admin)/attendance/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, getDoc } from "firebase/firestore";
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
  photoUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
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
    photo?: string;
    lat?: number;
    lng?: number;
  };
  checkOut?: {
    time: any;
    location?: string;
    note?: string;
    photo?: string;
    lat?: number;
    lng?: number;
  };
  workHours?: string;
  status?: string;
  isCorrected?: boolean;
  correctedCheckIn?: string;
  correctedCheckOut?: string;
  shift?: {
    id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    color: string;
    lateTolerance?: number;
  };
  officeLocation?: {
    name: string;
    lat: number;
    lng: number;
    radius: number;
  };
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

type StatusInfo = {
  status: string;
  label: string;
  color: string;
};

// ================= HELPER FUNCTIONS =================
const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date;
  }
  if (typeof timestamp === 'number') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
};

const formatDate = (timestamp: any, locale: string = "id-ID"): string => {
  const date = toDate(timestamp);
  if (!date) return "-";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (timestamp: any, locale: string = "id-ID"): string => {
  const date = toDate(timestamp);
  if (!date) return "-";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTime = (timestamp: any): string => {
  const date = toDate(timestamp);
  if (!date) return "--:--";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeFromString = (timeStr: string, date: Date): Date => {
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
};

const onlyDate = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const calculateWorkHoursFromTimes = (checkInTime: Date, checkOutTime: Date): number => {
  if (!checkInTime || !checkOutTime) return 0;
  if (checkOutTime <= checkInTime) return 0;
  
  const diffMs = checkOutTime.getTime() - checkInTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100;
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
  
  if (checkInDate && checkOutDate) {
    return calculateWorkHoursFromTimes(checkInDate, checkOutDate);
  }
  
  if (attendance.workHours && attendance.workHours !== "-") {
    const hours = parseFloat(attendance.workHours);
    if (!isNaN(hours) && hours > 0) return hours;
    
    const hourMatch = attendance.workHours.match(/(\d+(?:[.,]\d+)?)/);
    if (hourMatch) {
      const parsed = parseFloat(hourMatch[1].replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
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
  if (isHoliday) {
    return { status: "libur", label: "📅 Libur", color: "bg-purple-100 text-purple-700" };
  }
  
  if (shift && !checkIn) {
    return { status: "alpha", label: "❌ Tidak Hadir", color: "bg-red-100 text-red-700" };
  }
  
  if (checkIn && !checkOut) {
    return { status: "nsp", label: "⚠️ NSP (Belum Pulang)", color: "bg-orange-100 text-orange-700" };
  }
  
  if (checkIn) {
    const checkInDate = toDate(checkIn.time);
    if (checkInDate) {
      let shiftStartHour = 8;
      let shiftStartMinute = 0;
      let toleransi = 15;
      
      if (shift && shift.startTime) {
        const startParts = shift.startTime.split(":");
        shiftStartHour = parseInt(startParts[0]);
        shiftStartMinute = parseInt(startParts[1]);
        toleransi = shift.lateTolerance ?? 15;
      }
      
      const checkInTotalMenit = checkInDate.getHours() * 60 + checkInDate.getMinutes();
      const shiftStartTotalMenit = shiftStartHour * 60 + shiftStartMinute;
      const selisih = checkInTotalMenit - shiftStartTotalMenit;
      
      if (selisih > toleransi) {
        return { 
          status: "terlambat", 
          label: `⏰ Terlambat ${Math.floor(selisih)} menit`, 
          color: "bg-yellow-100 text-yellow-700" 
        };
      }
    }
  }
  
  if (checkIn && checkOut) {
    return { status: "hadir", label: "✅ Hadir", color: "bg-green-100 text-green-700" };
  }
  
  return { status: "unknown", label: "📋 Belum Absen", color: "bg-gray-100 text-gray-500" };
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// ================= KOMPONEN UTAMA =================
export default function AttendancePage() {
  const [data, setData] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [corrections, setCorrections] = useState<Record<string, CorrectionRequest>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [correctionsLoading, setCorrectionsLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [tempDept, setTempDept] = useState("ALL");
  const [tempJabatan, setTempJabatan] = useState("ALL");
  const [tempEmployee, setTempEmployee] = useState("ALL");
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempStatus, setTempStatus] = useState("ALL");

  const [dept, setDept] = useState("ALL");
  const [jabatan, setJabatan] = useState("ALL");
  const [employee, setEmployee] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("ALL");

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

  useEffect(() => {
    if (usersLoading) return;
    
    setCorrectionsLoading(true);
    const q = query(
      collection(db, "attendance_requests"),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(
      q,
      (snap) => {
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
              id: doc.id,
              uid: data.uid,
              name: data.name,
              date: data.date,
              checkIn: data.checkIn,
              checkOut: data.checkOut,
              status: data.status,
              approvedBy: data.approvedBy,
              approvedByName: data.approvedByName,
              approvedAt: data.approvedAt,
            };
          }
        });
        setCorrections(obj);
        setCorrectionsLoading(false);
      },
      (err) => {
        console.error("Error loading corrections:", err);
        setCorrectionsLoading(false);
      }
    );
    return () => unsub();
  }, [usersLoading]);

  useEffect(() => {
    if (usersLoading || correctionsLoading) return;
    
    setLoading(true);
    const q = query(collection(db, "attendance"), orderBy("date", "desc"));
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Attendance[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          const user = users[d.uid] || {};
          
          let dateStr = "";
          if (d.date?.toDate) {
            const dateObj = d.date.toDate();
            dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          }
          const dateKey = `${d.uid}_${dateStr}`;
          const correction = corrections[dateKey];
          
          let isCorrected = false;
          let correctedCheckIn: string | undefined;
          let correctedCheckOut: string | undefined;
          let checkInData = d.checkIn;
          let checkOutData = d.checkOut;
          
          if (correction && correction.status === "approved") {
            isCorrected = true;
            correctedCheckIn = correction.checkIn;
            correctedCheckOut = correction.checkOut;
            
            const dateObj = d.date?.toDate ? d.date.toDate() : new Date();
            
            if (correction.checkIn) {
              const correctedTime = formatTimeFromString(correction.checkIn, dateObj);
              checkInData = {
                ...d.checkIn,
                time: correctedTime,
                isCorrected: true,
                photo: d.checkIn?.photo,
              };
            }
            
            if (correction.checkOut) {
              const correctedTime = formatTimeFromString(correction.checkOut, dateObj);
              checkOutData = {
                ...d.checkOut,
                time: correctedTime,
                isCorrected: true,
                photo: d.checkOut?.photo,
              };
            }
          }
          
          arr.push({
            id: doc.id,
            ...d,
            name: user.name || d.name || "-",
            department: user.department || d.department || "-",
            jabatan: user.jabatan || d.jabatan || "-",
            dailyRate: user.dailyRate || d.dailyRate || 0,
            checkIn: checkInData,
            checkOut: checkOutData,
            isCorrected: isCorrected,
            correctedCheckIn: correctedCheckIn,
            correctedCheckOut: correctedCheckOut,
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
  }, [users, usersLoading, corrections, correctionsLoading]);

  const openDetailModal = async (attendance: Attendance) => {
    setSelectedAttendance(attendance);
    
    try {
      const userDoc = await getDoc(doc(db, "users", attendance.uid));
      if (userDoc.exists()) {
        setSelectedUserDetail(userDoc.data() as User);
      } else {
        setSelectedUserDetail(null);
      }
    } catch (error) {
      console.error("Error loading user detail:", error);
      setSelectedUserDetail(null);
    }
    
    setShowDetailModal(true);
  };

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
      if (status !== "ALL") {
        ok = ok && getAttendanceStatus(a).status === status;
      }
      if (startDate) {
        const date = toDate(a.date);
        if (date) {
          ok = ok && onlyDate(date) >= onlyDate(new Date(startDate));
        }
      }
      if (endDate) {
        const date = toDate(a.date);
        if (date) {
          ok = ok && onlyDate(date) <= onlyDate(new Date(endDate));
        }
      }
      
      return ok;
    });
  }, [data, dept, jabatan, employee, status, startDate, endDate]);

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
    if (tempStartDate && tempEndDate && new Date(tempStartDate) > new Date(tempEndDate)) {
      alert("Tanggal mulai harus lebih kecil dari tanggal akhir");
      return;
    }
    
    setDept(tempDept);
    setJabatan(tempJabatan);
    setEmployee(tempEmployee);
    setStatus(tempStatus);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  }, [tempDept, tempJabatan, tempEmployee, tempStatus, tempStartDate, tempEndDate]);

  const resetFilter = useCallback(() => {
    setTempDept("ALL");
    setTempJabatan("ALL");
    setTempEmployee("ALL");
    setTempStatus("ALL");
    setTempStartDate("");
    setTempEndDate("");
    setDept("ALL");
    setJabatan("ALL");
    setEmployee("ALL");
    setStatus("ALL");
    setStartDate("");
    setEndDate("");
  }, []);

  // app/(admin)/attendance/page.tsx
// Update fungsi exportDetailExcel dan exportDetailPDF

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
        // 🔥 TAMBAHKAN FIELD BANK
        Bank: users[a.uid]?.bankName || "-",
        No_Rekening: users[a.uid]?.bankAccountNumber || "-",
        Nama_Rekening: users[a.uid]?.bankAccountName || "-",
        Status_Koreksi: a.isCorrected ? "Sudah Dikoreksi" : "Normal",
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail Attendance");
    
    // Set column width
    ws['!cols'] = [
      { wch: 20 }, // Nama
      { wch: 15 }, // Department
      { wch: 15 }, // Jabatan
      { wch: 10 }, // Shift
      { wch: 12 }, // Tanggal
      { wch: 10 }, // Jam Masuk
      { wch: 10 }, // Jam Pulang
      { wch: 10 }, // Jam Kerja
      { wch: 15 }, // Status
      { wch: 15 }, // Bank
      { wch: 20 }, // No Rekening
      { wch: 20 }, // Nama Rekening
      { wch: 15 }, // Status Koreksi
    ];
    
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
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengexport data");
    } finally {
      setExporting(null);
    }
  };

  if (loading || usersLoading || correctionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-sm text-green-600">✅ Hadir</p>
                <p className="text-2xl font-bold text-green-800">{stats.hadir}</p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-yellow-600">⏰ Terlambat</p>
                <p className="text-2xl font-bold text-yellow-800">{stats.terlambat}</p>
              </div>
              <span className="text-3xl">⏰</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-red-600">❌ Tidak Hadir</p>
                <p className="text-2xl font-bold text-red-800">{stats.alpha}</p>
              </div>
              <span className="text-3xl">❌</span>
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-orange-600">⚠️ NSP</p>
                <p className="text-2xl font-bold text-orange-800">{stats.nsp}</p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-purple-600">📅 Libur</p>
                <p className="text-2xl font-bold text-purple-800">{stats.libur}</p>
              </div>
              <span className="text-3xl">📅</span>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-indigo-600">✏️ Dikoreksi</p>
                <p className="text-2xl font-bold text-indigo-800">{stats.corrected}</p>
              </div>
              <span className="text-3xl">✏️</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
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
            <select
              value={tempStatus}
              onChange={(e) => setTempStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="ALL">📋 Semua Status</option>
              <option value="hadir">✅ Hadir</option>
              <option value="terlambat">⏰ Terlambat</option>
              <option value="alpha">❌ Tidak Hadir</option>
              <option value="nsp">⚠️ NSP (Belum Pulang)</option>
              <option value="libur">📅 Libur</option>
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

        {/* DETAIL TABLE */}
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
                  <th className="px-4 py-3 text-left">Shift</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Masuk</th>
                  <th className="px-4 py-3 text-left">Pulang</th>
                  <th className="px-4 py-3 text-left">Jam Kerja</th>
                  <th className="px-4 py-3 text-left">Foto</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((a, idx) => {
                  const workHours = getWorkHours(a);
                  const masukDisplay = a.isCorrected && a.correctedCheckIn 
                    ? a.correctedCheckIn 
                    : formatTime(a.checkIn?.time);
                  const pulangDisplay = a.isCorrected && a.correctedCheckOut 
                    ? a.correctedCheckOut 
                    : formatTime(a.checkOut?.time);
                  const statusInfo = getAttendanceStatus(a);
                  const hasCheckInPhoto = !!a.checkIn?.photo;
                  const hasCheckOutPhoto = !!a.checkOut?.photo;
                  
                  return (
                    <tr 
                      key={a.id} 
                      onClick={() => openDetailModal(a)}
                      className={`border-b cursor-pointer transition-all duration-150 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-blue-50 hover:shadow-inner`}
                    >
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3">{a.department}</td>
                      <td className="px-4 py-3">{a.jabatan}</td>
                      <td className="px-4 py-3">
                        {a.shift ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.shift.color }} />
                            <span className="text-xs">{a.shift.name}</span>
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">{formatDate(a.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${a.checkIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {masukDisplay || "--:--"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${a.checkOut ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {pulangDisplay || "--:--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {workHours > 0 ? formatWorkHours(workHours) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {hasCheckInPhoto && (
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                              <span className="text-xs text-green-600">IN</span>
                            </div>
                          )}
                          {hasCheckOutPhoto && (
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <span className="text-xs text-blue-600">OUT</span>
                            </div>
                          )}
                          {!hasCheckInPhoto && !hasCheckOutPhoto && <span className="text-gray-400 text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
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

        {/* Recap Table */}
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

      {/* MODAL DETAIL ABSENSI */}
      {showDetailModal && selectedAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {selectedUserDetail?.photoUrl ? (
                  <img 
                    src={selectedUserDetail.photoUrl} 
                    alt={selectedAttendance.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {getInitials(selectedAttendance.name)}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedAttendance.name}</h2>
                  <p className="text-green-100 text-sm">{selectedAttendance.department} • {selectedAttendance.jabatan}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)} 
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informasi Absensi */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📋</span> Informasi Absensi
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Tanggal</span>
                      <span className="font-medium text-gray-800">{formatDate(selectedAttendance.date)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Shift</span>
                      <div className="flex items-center gap-2">
                        {selectedAttendance.shift && (
                          <>
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: selectedAttendance.shift.color }}
                            />
                            <span className="font-medium">{selectedAttendance.shift.name}</span>
                            <span className="text-xs text-gray-500">
                              ({selectedAttendance.shift.startTime} - {selectedAttendance.shift.endTime})
                            </span>
                          </>
                        )}
                        {!selectedAttendance.shift && <span className="text-gray-400">-</span>}
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttendanceStatus(selectedAttendance).color}`}>
                        {getAttendanceStatus(selectedAttendance).label}
                      </span>
                    </div>
                    {selectedAttendance.isCorrected && (
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-500">Koreksi</span>
                        <span className="text-purple-600 text-sm">✓ Sudah Dikoreksi</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Check-in & Check-out */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>⏰</span> Waktu Absensi
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <div>
                        <span className="text-gray-500">Check-in</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {selectedAttendance.checkIn?.lat && selectedAttendance.checkIn?.lng && (
                            <span>
                              📍 {selectedAttendance.checkIn.lat.toFixed(6)}, {selectedAttendance.checkIn.lng.toFixed(6)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-green-600">
                          {formatDateTime(selectedAttendance.checkIn?.time) || "--:--"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <div>
                        <span className="text-gray-500">Check-out</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {selectedAttendance.checkOut?.lat && selectedAttendance.checkOut?.lng && (
                            <span>
                              📍 {selectedAttendance.checkOut.lat.toFixed(6)}, {selectedAttendance.checkOut.lng.toFixed(6)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-blue-600">
                          {formatDateTime(selectedAttendance.checkOut?.time) || "--:--"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Jam Kerja</span>
                      <span className="font-medium text-gray-800">
                        {formatWorkHours(getWorkHours(selectedAttendance))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lokasi Kantor */}
                {selectedAttendance.officeLocation && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>📍</span> Lokasi Kantor
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-500">Nama Kantor</span>
                        <span className="font-medium">{selectedAttendance.officeLocation.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-500">Radius</span>
                        <span>{selectedAttendance.officeLocation.radius} meter</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-500">Jarak Anda</span>
                        <span className={selectedAttendance.isWithinRadius ? "text-green-600" : "text-red-600"}>
                          {selectedAttendance.distance?.toFixed(0) || 0} meter
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-500">Status Radius</span>
                        <span className={selectedAttendance.isWithinRadius ? "text-green-600" : "text-red-600"}>
                          {selectedAttendance.isWithinRadius ? "✅ Dalam Radius" : "❌ Di Luar Radius"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Foto Absensi */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📸</span> Foto Absensi
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedAttendance.checkIn?.photo && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Foto Check-in</p>
                        <img 
                          src={selectedAttendance.checkIn.photo} 
                          alt="Check-in"
                          className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(selectedAttendance.checkIn?.photo, '_blank')}
                        />
                        <p className="text-xs text-gray-400 mt-1">{formatTime(selectedAttendance.checkIn?.time)}</p>
                      </div>
                    )}
                    {selectedAttendance.checkOut?.photo && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Foto Check-out</p>
                        <img 
                          src={selectedAttendance.checkOut.photo} 
                          alt="Check-out"
                          className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(selectedAttendance.checkOut?.photo, '_blank')}
                        />
                        <p className="text-xs text-gray-400 mt-1">{formatTime(selectedAttendance.checkOut?.time)}</p>
                      </div>
                    )}
                    {!selectedAttendance.checkIn?.photo && !selectedAttendance.checkOut?.photo && (
                      <div className="col-span-2 text-center py-4 text-gray-400">
                        Tidak ada foto absensi
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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