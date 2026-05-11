// app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
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

const COLORS = ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, data }: any) => {
  if (active && payload && payload.length) {
    const monthData = data?.find((d: any) => d.month === label);
    const terlambatCount = payload.find((p: any) => p.dataKey === "terlambat")?.value || 0;
    const alphaCount = payload.find((p: any) => p.dataKey === "alpha")?.value || 0;

    return (
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 p-5 min-w-[280px] z-50">
        <div className="border-b border-slate-100 pb-3 mb-4">
          <p className="font-bold text-slate-800 text-lg">{label} {new Date().getFullYear()}</p>
          <p className="text-xs text-slate-500 mt-1">Detail Kehadiran Bulanan</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-sm text-slate-700 font-medium">Hadir</span>
            </div>
            <span className="font-bold text-emerald-600">{payload.find((p: any) => p.dataKey === "hadir")?.value || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span className="text-sm text-slate-700 font-medium">Terlambat</span>
            </div>
            <span className="font-bold text-amber-600">{terlambatCount}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-slate-700 font-medium">Tidak Hadir</span>
            </div>
            <span className="font-bold text-red-600">{alphaCount}</span>
          </div>
        </div>

        {terlambatCount > 0 && monthData?.terlambatDetails && monthData.terlambatDetails.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Karyawan Terlambat
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {monthData.terlambatDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-amber-50 rounded-lg">
                  <span className="text-slate-700 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-amber-600 font-semibold">{item.total}x</span>
                </div>
              ))}
              {monthData.terlambatDetails.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center py-1">+{monthData.terlambatDetails.length - 5} lainnya</p>
              )}
            </div>
          </div>
        )}

        {alphaCount > 0 && monthData?.alphaDetails && monthData.alphaDetails.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Karyawan Tidak Hadir
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {monthData.alphaDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-red-50 rounded-lg">
                  <span className="text-slate-700 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-red-600 font-semibold">{item.total} hari</span>
                </div>
              ))}
              {monthData.alphaDetails.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center py-1">+{monthData.alphaDetails.length - 5} lainnya</p>
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

  useEffect(() => {
    loadAllData();
  }, [selectedYear]);

  async function loadAllData() {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadStats(),
        loadMonthlyData(),
        loadDepartmentData(),
        loadShiftDistribution(),
        loadRecentActivities(),
      ]);
    } catch (err: any) {
      console.error("Error loading dashboard:", err);
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const [usersSnap, attendanceSnap, requestsSnap, shiftsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "attendance")),
        getDocs(collection(db, "attendance_requests")),
        getDocs(collection(db, "shifts")),
      ]);

      let totalUsers = 0;
      usersSnap.forEach(doc => {
        const role = doc.data().role;
        if (role === "employee" || role === "spv" || role === "staff") {
          totalUsers++;
        }
      });

      const today = new Date().toISOString().split("T")[0];
      let todayAttendance = 0;
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate) {
          const dateStr = data.date.toDate().toISOString().split("T")[0];
          if (dateStr === today && data.checkIn) {
            todayAttendance++;
          }
        }
      });

      let pending = 0, approved = 0, rejected = 0;
      requestsSnap.forEach(doc => {
        const status = doc.data().status;
        if (status === "pending") pending++;
        else if (status === "approved") approved++;
        else if (status === "rejected") rejected++;
      });

      let activeShifts = 0;
      shiftsSnap.forEach(doc => {
        if (doc.data().isActive === true) activeShifts++;
      });

      // FIX: Calculate attendance rate based on unique days per user
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Count unique user-day combinations
      const userDaysMap = new Map<string, Set<string>>();
      attendanceSnap.forEach(doc => {
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

      // Calculate total possible attendance days (users x 30 days)
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

  async function loadMonthlyData() {
    try {
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const usersSnap = await getDocs(collection(db, "users"));
      const userMap: Record<string, string> = {};
      usersSnap.forEach(doc => {
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

      attendanceSnap.forEach(doc => {
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

  async function loadDepartmentData() {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const deptMap: Record<string, { total: number; hadir: number }> = {};

      usersSnap.forEach(doc => {
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

      const attendanceSnap = await getDocs(collection(db, "attendance"));
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate && data.date.toDate() >= thirtyDaysAgo && data.checkIn) {
          const userDoc = usersSnap.docs.find(u => u.id === data.uid);
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

  async function loadShiftDistribution() {
    try {
      const shiftsSnap = await getDocs(collection(db, "shifts"));
      const distribution: ShiftDistribution[] = [];
      let index = 0;

      shiftsSnap.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false && data.name !== "Day Off" && data.name !== "PHC") {
          distribution.push({
            name: data.name,
            value: 0,
            color: data.color || COLORS[index % COLORS.length],
          });
          index++;
        }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const shiftCount: Record<string, number> = {};

      const attendanceSnap = await getDocs(collection(db, "attendance"));
      attendanceSnap.forEach(doc => {
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

  async function loadRecentActivities() {
    try {
      const activities: any[] = [];

      const attendanceQuery = query(
        collection(db, "attendance"),
        orderBy("date", "desc"),
        limit(5)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate) {
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
          limit(5)
        );
        const auditSnap = await getDocs(auditQuery);
        auditSnap.forEach(doc => {
          const data = doc.data();
          if (data.changedAt?.toDate) {
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

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-lg">Memuat dashboard...</p>
            <p className="text-slate-400 text-sm mt-2">Mohon tunggu sebentar</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center bg-white/80 backdrop-blur-sm p-10 rounded-3xl shadow-2xl border border-red-100 max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-semibold text-lg mb-2">{error}</p>
            <p className="text-slate-500 text-sm mb-6">Terjadi kesalahan saat memuat data. Silakan coba lagi.</p>
            <button
              onClick={() => loadAllData()}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/20"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-6 lg:p-8">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

          :root {
            --primary: #0f172a;
            --accent: #0ea5e9;
            --success: #22c55e;
            --warning: #eab308;
            --danger: #ef4444;
          }

          * {
            font-family: 'Plus Jakarta Sans', sans-serif;
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }

          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
            50% { box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.2); }
          }

          @keyframes countUp {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }

          .animate-slide-up {
            animation: slideUp 0.5s ease-out forwards;
            opacity: 0;
          }

          .animate-slide-in {
            animation: slideIn 0.4s ease-out forwards;
            opacity: 0;
          }

          .glass-effect {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.5);
          }

          .card-hover {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .card-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          }

          .btn-primary {
            background: linear-gradient(135deg, var(--accent) 0%, #0284c7 100%);
            transition: all 0.2s ease;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px -5px rgba(14, 165, 233, 0.4);
          }

          .progress-ring {
            transition: stroke-dashoffset 0.5s ease-in-out;
          }

          .stat-icon {
            background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%);
          }

          .table-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          }
        `}</style>

        {/* Header */}
        <div className={`relative overflow-hidden rounded-3xl mb-8 animate-slide-up`} style={{ animationDelay: '0.1s' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700" />
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-400/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-teal-400/30 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-white/10 rounded-full blur-2xl" />

          <div className="relative z-10 px-8 py-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-[72px] h-[72px] bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">Dashboard HR</h1>
                  <p className="text-emerald-100 mt-2 text-lg">Sistem Manajemen Kehadiran & Payroll</p>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-white text-center">
                  <p className="text-2xl font-bold">{new Date().toLocaleDateString('id-ID', { day: 'numeric' })}</p>
                  <p className="text-xs text-emerald-200">{new Date().toLocaleDateString('id-ID', { weekday: 'long', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Karyawan */}
          <div className={`glass-effect rounded-2xl p-6 card-hover animate-slide-up`} style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">Aktif</span>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">Total Karyawan</p>
            <p className="text-4xl font-extrabold text-slate-800">{stats.totalUsers}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Karyawan aktif dalam sistem</span>
            </div>
          </div>

          {/* Absen Hari Ini */}
          <div className={`glass-effect rounded-2xl p-6 card-hover animate-slide-up`} style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full">Hari Ini</span>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">Absen Hari Ini</p>
            <p className="text-4xl font-extrabold text-slate-800">{stats.todayAttendance}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalUsers > 0 ? (stats.todayAttendance / stats.totalUsers) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">{stats.totalUsers > 0 ? Math.round((stats.todayAttendance / stats.totalUsers) * 100) : 0}%</span>
            </div>
          </div>

          {/* Pending Koreksi */}
          <div className={`glass-effect rounded-2xl p-6 card-hover animate-slide-up`} style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${stats.pendingRequests > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                {stats.pendingRequests > 0 ? 'Perlu Aksi' : 'Selesai'}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">Pending Koreksi</p>
            <p className={`text-4xl font-extrabold ${stats.pendingRequests > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {stats.pendingRequests}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Menunggu approval</span>
            </div>
          </div>

          {/* Kehadiran Rate */}
          <div className={`glass-effect rounded-2xl p-6 card-hover animate-slide-up`} style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">Tingkat Kehadiran</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-extrabold text-slate-800">{attendanceRate}</p>
              <span className="text-xl font-bold text-slate-400 mb-1">%</span>
            </div>
            <div className="mt-3">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke={attendanceRate >= 80 ? '#22c55e' : attendanceRate >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${attendanceRate * 1.76} 176`}
                    className="progress-ring"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Year Filter */}
        <div className={`glass-effect rounded-2xl p-5 mb-8 animate-slide-up flex items-center justify-between`} style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Filter Tahun</p>
              <p className="text-xs text-slate-500">Pilih tahun untuk melihat data tren</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[2024, 2025, 2026].map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  selectedYear === year
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Main Chart */}
        {monthlyData.some(m => m.total > 0) && (
          <div className={`glass-effect rounded-2xl p-6 mb-8 animate-slide-up`} style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Tren Kehadiran {selectedYear}</h2>
                  <p className="text-sm text-slate-500">Hover pada chart untuk melihat detail karyawan</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs text-slate-600 font-medium">Hadir</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-xs text-slate-600 font-medium">Terlambat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-slate-600 font-medium">Tidak Hadir</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip data={monthlyData} />} />
                <Bar dataKey="hadir" name="Hadir" fill="#22c55e" radius={[8, 8, 0, 0]} maxBarSize={40} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#eab308" radius={[8, 8, 0, 0]} maxBarSize={40} />
                <Bar dataKey="alpha" name="Tidak Hadir" fill="#ef4444" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Department Performance */}
          {departmentData.length > 0 && (
            <div className={`glass-effect rounded-2xl p-6 animate-slide-up`} style={{ animationDelay: '0.45s' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Performa Departemen</h2>
                  <p className="text-sm text-slate-500">30 hari terakhir</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fontWeight: 500, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                  />
                  <Bar dataKey="hadir" name="Hadir" fill="#22c55e" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Shift Distribution */}
          {shiftDistribution.length > 0 && (
            <div className={`glass-effect rounded-2xl p-6 animate-slide-up`} style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Distribusi Shift</h2>
                  <p className="text-sm text-slate-500">Shift aktif dalam 30 hari</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={shiftDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
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
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any) => `${value || 0} records`}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => <span className="text-sm text-slate-600 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activities */}
          <div className={`glass-effect rounded-2xl overflow-hidden animate-slide-up`} style={{ animationDelay: '0.55s' }}>
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Aktivitas Terbaru</h2>
                  <p className="text-sm text-slate-500">Aktivitas sistem terbaru</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {recentActivities.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">Belum ada aktivitas</p>
                </div>
              ) : (
                recentActivities.slice(0, 8).map((activity, idx) => (
                  <div key={idx} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${activity.type === "attendance" ? "bg-emerald-500" : "bg-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(activity.time)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
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
          <div className={`glass-effect rounded-2xl p-6 animate-slide-up`} style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Aksi Cepat</h2>
                <p className="text-sm text-slate-500">Navigasi cepat ke fitur utama</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/attendance" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Attendance</p>
                  <p className="text-xs text-slate-500">Lihat absensi</p>
                </div>
              </Link>

              <Link href="/attendance-corrections" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl hover:from-amber-100 hover:to-yellow-100 transition-all border border-amber-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Koreksi</p>
                  <p className="text-xs text-slate-500">Kelola request</p>
                </div>
              </Link>

              <Link href="/users" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl hover:from-blue-100 hover:to-indigo-100 transition-all border border-blue-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Users</p>
                  <p className="text-xs text-slate-500">Kelola karyawan</p>
                </div>
              </Link>

              <Link href="/shifts" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl hover:from-purple-100 hover:to-violet-100 transition-all border border-purple-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Shifts</p>
                  <p className="text-xs text-slate-500">Kelola shift</p>
                </div>
              </Link>

              <Link href="/payroll" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl hover:from-rose-100 hover:to-pink-100 transition-all border border-rose-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Payroll</p>
                  <p className="text-xs text-slate-500">Kelola gaji</p>
                </div>
              </Link>

              <Link href="/schedule-shift" className="group flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-50 to-sky-50 rounded-2xl hover:from-cyan-100 hover:to-sky-100 transition-all border border-cyan-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Schedule</p>
                  <p className="text-xs text-slate-500">Jadwalkan shift</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}