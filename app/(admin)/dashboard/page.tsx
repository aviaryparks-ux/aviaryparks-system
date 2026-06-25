// app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Helper function untuk convert timestamp ke Date
const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'string') { const date = new Date(timestamp); if (!isNaN(date.getTime())) return date; }
  if (typeof timestamp === 'number') { const date = new Date(timestamp); if (!isNaN(date.getTime())) return date; }
  return null;
};

interface DashboardStats {
  totalUsers: number;
  totalAttendance: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  todayAttendance: number;
  totalShifts: number;
  activeShifts: number;
}

interface MonthlyData {
  month: string;
  hadir: number;
  terlambat: number;
  alpha: number;
  total: number;
  terlambatDetails?: { name: string; total: number }[];
  alphaDetails?: { name: string; total: number }[];
}

interface DepartmentData {
  name: string;
  total: number;
  hadir: number;
  terlambat: number;
  percentage: number;
}

interface ShiftDistribution {
  name: string;
  value: number;
  color: string;
}

const CHART_COLORS = ["#7c3aed", "#4f46e5", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#ec4899"];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, data }: any) => {
  if (active && payload && payload.length) {
    const monthData = data?.find((d: any) => d.month === label);
    const terlambatCount = payload.find((p: any) => p.dataKey === "terlambat")?.value || 0;
    const alphaCount = payload.find((p: any) => p.dataKey === "alpha")?.value || 0;

    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 min-w-[260px]">
        <div className="border-b border-slate-100 pb-2 mb-3">
          <p className="font-semibold text-slate-800 text-sm">{label} {new Date().getFullYear()}</p>
          <p className="text-xs text-slate-400 mt-0.5">Detail Kehadiran Bulanan</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-600 font-medium">Hadir</span>
            </div>
            <span className="font-bold text-sm text-emerald-600">{payload.find((p: any) => p.dataKey === "hadir")?.value || 0}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-slate-600 font-medium">Terlambat</span>
            </div>
            <span className="font-bold text-sm text-amber-600">{terlambatCount}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
              <span className="text-xs text-slate-600 font-medium">Tidak Hadir</span>
            </div>
            <span className="font-bold text-sm text-red-600">{alphaCount}</span>
          </div>
        </div>

        {terlambatCount > 0 && monthData?.terlambatDetails && monthData.terlambatDetails.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-amber-600 mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Karyawan Terlambat
            </p>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {monthData.terlambatDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-amber-50/50 rounded">
                  <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-amber-600 font-semibold">{item.total}x</span>
                </div>
              ))}
              {monthData.terlambatDetails.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center py-0.5">+{monthData.terlambatDetails.length - 5} lainnya</p>
              )}
            </div>
          </div>
        )}

        {alphaCount > 0 && monthData?.alphaDetails && monthData.alphaDetails.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Karyawan Tidak Hadir
            </p>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {monthData.alphaDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-red-50/50 rounded">
                  <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-red-600 font-semibold">{item.total} hari</span>
                </div>
              ))}
              {monthData.alphaDetails.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center py-0.5">+{monthData.alphaDetails.length - 5} lainnya</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAttendance: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    todayAttendance: 0,
    totalShifts: 0,
    activeShifts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [shiftDistribution, setShiftDistribution] = useState<ShiftDistribution[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendanceRate, setAttendanceRate] = useState(0);

  const { user: currentUser } = useAuth();
  const isGlobalAdmin = currentUser?.role === "super_admin" || currentUser?.role === "hr" || 
                        ((currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.role === "gm" || currentUser?.role === "owner") && !currentUser?.department);
  const scopeDepartment = isGlobalAdmin ? null : currentUser?.department;

  useEffect(() => {
    if (currentUser !== undefined) {
      loadAllData();
    }
  }, [selectedYear, currentUser]);

  async function loadAllData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch each collection ONCE with limits/filters, then pass to sub-functions
      const yearStart = Timestamp.fromDate(new Date(selectedYear, 0, 1));
      const yearEnd = Timestamp.fromDate(new Date(selectedYear, 11, 31, 23, 59, 59));

      const [usersSnapRaw, attendanceSnapRaw, requestsSnapRaw, shiftsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), limit(500))),
        getDocs(query(
          collection(db, "attendance"),
          where("date", ">=", yearStart),
          where("date", "<=", yearEnd),
          orderBy("date", "desc")
        )),
        getDocs(query(collection(db, "attendance_requests"), orderBy("createdAt", "desc"), limit(200))),
        getDocs(collection(db, "shifts")),
      ]);

      const validUids = new Set();
      usersSnapRaw.forEach((doc: any) => {
        const data = doc.data();
        if (!scopeDepartment || data.department === scopeDepartment) {
          validUids.add(doc.id);
        }
      });

      const usersSnap = {
        docs: usersSnapRaw.docs.filter((doc: any) => validUids.has(doc.id)),
        size: validUids.size,
        forEach: (cb: any) => { usersSnapRaw.forEach((doc: any) => { if (validUids.has(doc.id)) cb(doc); }); }
      };

      const attendanceSnap = {
        docs: attendanceSnapRaw.docs.filter((doc: any) => validUids.has(doc.data().uid)),
        size: attendanceSnapRaw.docs.filter((doc: any) => validUids.has(doc.data().uid)).length,
        forEach: (cb: any) => { attendanceSnapRaw.forEach((doc: any) => { if (validUids.has(doc.data().uid)) cb(doc); }); }
      };

      const requestsSnap = {
        docs: requestsSnapRaw.docs.filter((doc: any) => validUids.has(doc.data().uid)),
        size: requestsSnapRaw.docs.filter((doc: any) => validUids.has(doc.data().uid)).length,
        forEach: (cb: any) => { requestsSnapRaw.forEach((doc: any) => { if (validUids.has(doc.data().uid)) cb(doc); }); }
      };

      await Promise.all([
        loadStats(usersSnap, attendanceSnap, requestsSnap, shiftsSnap),
        loadMonthlyData(attendanceSnap, usersSnap),
        loadDepartmentData(usersSnap, attendanceSnap),
        loadShiftDistribution(shiftsSnap, attendanceSnap),
        loadRecentActivities(validUids),
      ]);
    } catch (err: any) {
      console.error("Error loading dashboard:", err);
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(
    usersSnap: any,
    attendanceSnap: any,
    requestsSnap: any,
    shiftsSnap: any
  ) {
    try {
      let totalUsers = 0;
      usersSnap.forEach((doc: any) => {
        const role = doc.data().role;
        if (role === "employee" || role === "spv" || role === "staff") {
          totalUsers++;
        }
      });

      const today = new Date().toISOString().split("T")[0];
      let todayAttendance = 0;
      attendanceSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.date?.toDate) {
          const dateStr = data.date.toDate().toISOString().split("T")[0];
          if (dateStr === today && data.checkIn) {
            todayAttendance++;
          }
        }
      });

      let pending = 0, approved = 0, rejected = 0;
      requestsSnap.forEach((doc: any) => {
        const status = doc.data().status;
        if (status === "pending") pending++;
        else if (status === "approved") approved++;
        else if (status === "rejected") rejected++;
      });

      let activeShifts = 0;
      shiftsSnap.forEach((doc: any) => {
        if (doc.data().isActive === true) activeShifts++;
      });

      // Calculate attendance rate based on unique days per user (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userDaysMap = new Map<string, Set<string>>();
      attendanceSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.date?.toDate && data.date.toDate() >= thirtyDaysAgo && data.checkIn) {
          const dateStr = data.date.toDate().toISOString().split("T")[0];
          const uid = data.uid;
          if (!userDaysMap.has(uid)) {
            userDaysMap.set(uid, new Set());
          }
          userDaysMap.get(uid)!.add(dateStr);
        }
      });

      const totalPossibleDays = totalUsers * 30;
      let totalActualDays = 0;
      userDaysMap.forEach((daysSet) => {
        totalActualDays += daysSet.size;
      });

      const rate = totalPossibleDays > 0 ? Math.round((totalActualDays / totalPossibleDays) * 100) : 0;
      setAttendanceRate(Math.min(rate, 100));

      setStats({
        totalUsers,
        totalAttendance: attendanceSnap.size,
        pendingRequests: pending,
        approvedRequests: approved,
        rejectedRequests: rejected,
        todayAttendance,
        totalShifts: shiftsSnap.size,
        activeShifts,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async function loadMonthlyData(attendanceSnap: any, usersSnap: any) {
    try {
      const userMap: Record<string, string> = {};
      usersSnap.forEach((doc: any) => {
        userMap[doc.id] = doc.data().name || "Unknown";
      });

      const monthlyMap: Record<string, MonthlyData> = {};
      const terlambatCountPerUser: Record<string, Record<string, number>> = {};
      const alphaCountPerUser: Record<string, Record<string, number>> = {};

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      for (let i = 0; i < 12; i++) {
        monthlyMap[monthNames[i]] = { month: monthNames[i], hadir: 0, terlambat: 0, alpha: 0, total: 0 };
        terlambatCountPerUser[monthNames[i]] = {};
        alphaCountPerUser[monthNames[i]] = {};
      }

      attendanceSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.date?.toDate) {
          const date = data.date.toDate();
          if (date.getFullYear() === selectedYear) {
            const monthName = monthNames[date.getMonth()];
            const checkIn = data.checkIn;
            const shift = data.shift;
            const userName = userMap[data.uid] || data.name || "Unknown";

            if (monthlyMap[monthName]) {
              monthlyMap[monthName].total++;

              if (checkIn) {
                let isTerlambat = false;

                // Handle corrected check-in time or original
                let checkInTimeForCalc: Date | null = null;

                if (data.isCorrected && data.correctedCheckIn) {
                  // Use corrected time
                  const [h, m] = data.correctedCheckIn.split(":").map(Number);
                  checkInTimeForCalc = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
                } else if (checkIn.time) {
                  // Use original check-in time
                  checkInTimeForCalc = toDate(checkIn.time);
                }

                if (checkInTimeForCalc) {
                  // Default shift start: 08:00 with 15 min tolerance
                  let shiftStartHour = 8;
                  let shiftStartMinute = 0;
                  let toleransi = 15;

                  // Override with shift settings if available
                  if (shift?.startTime) {
                    const shiftParts = shift.startTime.split(":");
                    shiftStartHour = parseInt(shiftParts[0]);
                    shiftStartMinute = parseInt(shiftParts[1]);
                    toleransi = shift.lateTolerance ?? 15;
                  }

                  const shiftStartTotalMenit = shiftStartHour * 60 + shiftStartMinute;
                  const checkInTotalMenit = checkInTimeForCalc.getHours() * 60 + checkInTimeForCalc.getMinutes();
                  const selisih = checkInTotalMenit - shiftStartTotalMenit;

                  // Terlambat jika selisih > toleransi
                  if (selisih > toleransi) {
                    isTerlambat = true;
                  }
                }

                if (isTerlambat) {
                  monthlyMap[monthName].terlambat++;
                  terlambatCountPerUser[monthName][userName] = (terlambatCountPerUser[monthName][userName] || 0) + 1;
                } else {
                  monthlyMap[monthName].hadir++;
                }
              } else {
                monthlyMap[monthName].alpha++;
                alphaCountPerUser[monthName][userName] = (alphaCountPerUser[monthName][userName] || 0) + 1;
              }
            }
          }
        }
      });

      // FIX: Include alphaDetails in the result
      const result = Object.values(monthlyMap).map(month => ({
        ...month,
        terlambatDetails: Object.entries(terlambatCountPerUser[month.month])
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total),
        alphaDetails: Object.entries(alphaCountPerUser[month.month])
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total),
      }));

      setMonthlyData(result);
    } catch (error) {
      console.error("Error loading monthly data:", error);
      setMonthlyData([]);
    }
  }

  async function loadDepartmentData(usersSnap: any, attendanceSnap: any) {
    try {
      const deptMap: Record<string, { total: number; hadir: number }> = {};

      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        const role = data.role;
        const dept = data.department;

        if (!dept || dept === "" || dept === "-") return;
        if (role === "super_admin" || role === "admin" || role === "hr") return;

        if (!deptMap[dept]) {
          deptMap[dept] = { total: 0, hadir: 0 };
        }
        deptMap[dept].total++;
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      attendanceSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.date?.toDate && data.date.toDate() >= thirtyDaysAgo && data.checkIn) {
          const userDoc = usersSnap.docs.find((u: any) => u.id === data.uid);
          const role = userDoc?.data()?.role;
          const dept = userDoc?.data()?.department;

          if (dept && dept !== "" && dept !== "-" && role !== "super_admin" && role !== "admin" && role !== "hr") {
            if (deptMap[dept]) {
              deptMap[dept].hadir++;
            }
          }
        }
      });

      const result = Object.entries(deptMap)
        .map(([name, data]) => ({
          name: name.length > 12 ? name.substring(0, 10) + "..." : name,
          total: data.total,
          hadir: data.hadir,
          terlambat: data.total - data.hadir,
          percentage: data.total > 0 ? Math.round((data.hadir / data.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      setDepartmentData(result);
    } catch (error) {
      console.error("Error loading department data:", error);
      setDepartmentData([]);
    }
  }

  async function loadShiftDistribution(shiftsSnap: any, attendanceSnap: any) {
    try {
      const distribution: ShiftDistribution[] = [];
      let index = 0;

      shiftsSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.isActive !== false && data.name !== "Day Off" && data.name !== "PHC") {
          distribution.push({
            name: data.name,
            value: 0,
            color: CHART_COLORS[index % CHART_COLORS.length],
          });
          index++;
        }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const shiftCount: Record<string, number> = {};

      attendanceSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.date?.toDate && data.date.toDate() >= thirtyDaysAgo && data.shift?.name) {
          const shiftName = data.shift.name;
          if (shiftName !== "Day Off" && shiftName !== "PHC") {
            shiftCount[shiftName] = (shiftCount[shiftName] || 0) + 1;
          }
        }
      });

      const result = distribution.map(shift => ({
        ...shift,
        value: shiftCount[shift.name] || 0,
      })).filter(s => s.value > 0);

      setShiftDistribution(result.length > 0 ? result : [{ name: "Belum Ada Data", value: 1, color: "#9ca3af" }]);
    } catch (error) {
      console.error("Error loading shift distribution:", error);
      setShiftDistribution([{ name: "Belum Ada Data", value: 1, color: "#9ca3af" }]);
    }
  }

  async function loadRecentActivities(validUids: Set<unknown>) {
    try {
      const activities: any[] = [];

      const attendanceQuery = query(
        collection(db, "attendance"),
        orderBy("date", "desc"),
        limit(50) // Increased limit since we filter post-fetch
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate && validUids.has(data.uid)) {
          activities.push({
            id: doc.id,
            type: "attendance",
            title: `${data.name || data.userName || "Karyawan"} melakukan absensi`,
            time: data.date.toDate(),
            status: data.checkIn ? "check-in" : "absensi",
          });
        }
      });

      try {
        const auditQuery = query(
          collection(db, "shift_audit_logs"),
          orderBy("changedAt", "desc"),
          limit(50)
        );
        const auditSnap = await getDocs(auditQuery);
        auditSnap.forEach(doc => {
          const data = doc.data();
          if (data.changedAt?.toDate && validUids.has(data.uid)) {
            activities.push({
              id: doc.id,
              type: "shift_change",
              title: `${data.changedByName || "Admin"} mengubah shift ${data.userName || "karyawan"}`,
              time: data.changedAt.toDate(),
              status: data.action === "update" ? "update" : data.action === "create" ? "tambah" : "hapus",
            });
          }
        });
      } catch (err) {
        console.log("Audit log not available yet");
      }

      activities.sort((a, b) => b.time.getTime() - a.time.getTime());
      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error("Error loading recent activities:", error);
      setRecentActivities([]);
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  // ============================
  // LOADING STATE
  // ============================
  if (loading) {
    return (
      <ProtectedRoute requiredFeature="view_dashboard">
        <div className="min-h-[80vh] flex items-center justify-center">
          <LoadingScreen fullScreen={false} message="Memuat dashboard..." size={150} />
        </div>
      </ProtectedRoute>
    );
  }

  // ============================
  // ERROR STATE
  // ============================
  if (error) {
    return (
      <ProtectedRoute requiredFeature="view_dashboard">
        <div className="min-h-[80vh] flex items-center justify-center p-6">
          <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md">
            <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-semibold mb-1">{error}</p>
            <p className="text-slate-400 text-sm mb-5">Terjadi kesalahan saat memuat data.</p>
            <button
              onClick={() => loadAllData()}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // ============================
  // MAIN RENDER
  // ============================
  return (
    <ProtectedRoute requiredFeature="view_dashboard">
      <div className="space-y-6 pb-20">
        {/* ============================================ */}
        {/* STATS CARDS — White with colored left border */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Karyawan */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Karyawan</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalUsers}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Karyawan aktif</p>
            </div>
          </div>

          {/* Absen Hari Ini */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Absen Hari Ini</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-800">{stats.todayAttendance}</p>
                <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">{stats.totalUsers > 0 ? Math.round((stats.todayAttendance / stats.totalUsers) * 100) : 0}%</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stats.totalUsers > 0 ? (stats.todayAttendance / stats.totalUsers) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Pending Koreksi */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending Koreksi</p>
              <p className={`text-2xl font-bold ${stats.pendingRequests > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {stats.pendingRequests}
              </p>
              <p className="text-[11px] mt-0.5">
                {stats.pendingRequests > 0 ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full inline-block animate-pulse"></span>
                    Menunggu approval
                  </span>
                ) : (
                  <span className="text-slate-400">Semua terproses</span>
                )}
              </p>
            </div>
          </div>

          {/* Tingkat Kehadiran */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 flex-shrink-0 relative">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                <circle cx="18" cy="18" r="15" stroke={attendanceRate >= 80 ? '#22c55e' : attendanceRate >= 50 ? '#eab308' : '#ef4444'} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray={`${attendanceRate * 0.942} 94.2`} style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-700">{attendanceRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tingkat Kehadiran</p>
              <p className="text-2xl font-bold text-slate-800">{attendanceRate}<span className="text-sm font-medium text-slate-400 ml-1">%</span></p>
              <p className="text-[11px] text-slate-400 mt-0.5">30 hari terakhir</p>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* YEAR FILTER                                  */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Filter Tahun</p>
              <p className="text-xs text-slate-400">Pilih tahun untuk melihat data tren</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[2024, 2025, 2026].map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedYear === year
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* MAIN CHART — Bar Chart                       */}
        {/* ============================================ */}
        {monthlyData.some(m => m.total > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Tren Kehadiran {selectedYear}</h2>
                  <p className="text-xs text-slate-400">Hover pada chart untuk melihat detail karyawan</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs text-slate-500">Hadir</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                  <span className="text-xs text-slate-500">Terlambat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-slate-500">Tidak Hadir</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 500, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fontWeight: 500, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip data={monthlyData} />} />
                <Bar dataKey="hadir" name="Hadir" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="alpha" name="Tidak Hadir" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ============================================ */}
        {/* SECOND ROW — Department + Shift Charts       */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Department Performance */}
          {departmentData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Performa Departemen</h2>
                  <p className="text-xs text-slate-400">30 hari terakhir</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={departmentData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      padding: '10px'
                    }}
                  />
                  <Bar dataKey="hadir" name="Hadir" fill="#10b981" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Shift Distribution */}
          {shiftDistribution.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Distribusi Shift</h2>
                  <p className="text-xs text-slate-400">Shift aktif dalam 30 hari</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={shiftDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => (percent ?? 0) > 0.05 ? `${name}` : ""}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {shiftDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      padding: '10px'
                    }}
                    formatter={(value: any) => `${value || 0} records`}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-500 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* BOTTOM ROW — Activities + Quick Actions       */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Activities */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Aktivitas Terbaru</h2>
                  <p className="text-xs text-slate-400">Aktivitas sistem terbaru</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-50 max-h-[380px] overflow-y-auto">
              {recentActivities.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-sm">Belum ada aktivitas</p>
                </div>
              ) : (
                recentActivities.slice(0, 8).map((activity, idx) => (
                  <div key={idx} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activity.type === "attendance" ? "bg-emerald-500" : "bg-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(activity.time)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                        activity.type === "attendance"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Aksi Cepat</h2>
                <p className="text-xs text-slate-400">Navigasi cepat ke fitur utama</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/attendance", label: "Attendance", desc: "Lihat absensi", color: "emerald" },
                { href: "/attendance-corrections", label: "Koreksi", desc: "Kelola request", color: "amber" },
                { href: "/users", label: "Users", desc: "Kelola karyawan", color: "blue" },
                { href: "/shifts", label: "Shifts", desc: "Kelola shift", color: "violet" },
                { href: "/payroll", label: "Payroll", desc: "Kelola gaji", color: "rose" },
                { href: "/schedule-shift", label: "Schedule", desc: "Jadwalkan shift", color: "cyan" },
              ].map((item) => {
                const colorMap: Record<string, { bg: string; icon: string; border: string; hover: string }> = {
                  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100", hover: "hover:border-emerald-200 hover:bg-emerald-50/50" },
                  amber: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-100", hover: "hover:border-amber-200 hover:bg-amber-50/50" },
                  blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-100", hover: "hover:border-blue-200 hover:bg-blue-50/50" },
                  violet: { bg: "bg-violet-50", icon: "text-violet-600", border: "border-violet-100", hover: "hover:border-violet-200 hover:bg-violet-50/50" },
                  rose: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-100", hover: "hover:border-rose-200 hover:bg-rose-50/50" },
                  cyan: { bg: "bg-cyan-50", icon: "text-cyan-600", border: "border-cyan-100", hover: "hover:border-cyan-200 hover:bg-cyan-50/50" },
                };
                const c = colorMap[item.color];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 p-3.5 bg-white rounded-lg border ${c.border} ${c.hover} transition-all`}
                  >
                    <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <svg className={`w-4.5 h-4.5 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}