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
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 min-w-[280px] z-50">
        <div className="border-b border-gray-100 pb-2 mb-2">
          <p className="font-bold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500">Detail Kehadiran</p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">✅ Hadir</span>
            <span className="font-semibold text-green-600">{payload.find((p: any) => p.dataKey === "hadir")?.value || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">⏰ Terlambat</span>
            <span className="font-semibold text-yellow-600">{terlambatCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">❌ Tidak Hadir</span>
            <span className="font-semibold text-red-600">{alphaCount}</span>
          </div>
        </div>
        
        {terlambatCount > 0 && monthData?.terlambatDetails && monthData.terlambatDetails.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-yellow-600 mb-1">⏰ Karyawan Terlambat:</p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {monthData.terlambatDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-yellow-500 text-[10px]">{item.total} kali</span>
                </div>
              ))}
              {monthData.terlambatDetails.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center">+{monthData.terlambatDetails.length - 5} lainnya</p>
              )}
            </div>
          </div>
        )}
        
        {alphaCount > 0 && monthData?.alphaDetails && monthData.alphaDetails.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-red-600 mb-1">❌ Karyawan Tidak Hadir:</p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {monthData.alphaDetails.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 truncate max-w-[120px]">{item.name}</span>
                  <span className="text-red-500 text-[10px]">{item.total} hari</span>
                </div>
              ))}
              {monthData.alphaDetails.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center">+{monthData.alphaDetails.length - 5} lainnya</p>
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
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let totalDaysWithAttendance = 0;
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate && data.date.toDate() >= thirtyDaysAgo && data.checkIn) {
          totalDaysWithAttendance++;
        }
      });
      const rate = totalUsers > 0 ? Math.round((totalDaysWithAttendance / (totalUsers * 30)) * 100) : 0;
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
                if (shift?.startTime) {
                  const checkInHour = checkIn.time?.toDate?.()?.getHours() || 0;
                  const shiftStartHour = parseInt(shift.startTime.split(":")[0]);
                  if (checkInHour > shiftStartHour + 1) {
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
            status: data.checkIn ? "✅ Check-in" : "📝 Absensi",
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
              status: `🔄 ${data.action === "update" ? "Update" : data.action === "create" ? "Tambah" : "Hapus"}`,
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat data dashboard...</p>
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
            onClick={() => loadAllData()}
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
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-green-100 mt-1">Attendance Management System</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Karyawan</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3">
                <span className="text-xl">👥</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Absen Hari Ini</p>
                <p className="text-2xl font-bold text-gray-800">{stats.todayAttendance}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <span className="text-xl">📅</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">Pending Koreksi</p>
                <p className="text-2xl font-bold text-gray-800">{stats.pendingRequests}</p>
              </div>
              <div className="rounded-xl bg-yellow-100 p-3">
                <span className="text-xl">⏳</span>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Kehadiran</p>
                <p className="text-2xl font-bold text-gray-800">{attendanceRate}%</p>
              </div>
              <div className="rounded-xl bg-purple-100 p-3">
                <span className="text-xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        {/* Year Selector */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">📅 Filter Tahun</span>
            <div className="flex gap-2">
              {[2024, 2025, 2026].map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    selectedYear === year
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chart */}
        {monthlyData.some(m => m.total > 0) && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800">📈 Tren Kehadiran {selectedYear}</h2>
              <p className="text-xs text-gray-400">Hover pada bar untuk melihat detail karyawan</p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip data={monthlyData} />} />
                <Legend />
                <Bar dataKey="hadir" name="✅ Hadir" fill="#22c55e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="terlambat" name="⏰ Terlambat" fill="#eab308" radius={[8, 8, 0, 0]} />
                <Bar dataKey="alpha" name="❌ Tidak Hadir" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Department Performance */}
          {departmentData.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
              <h2 className="text-md font-semibold text-gray-800 mb-4">🏢 Performa Departemen</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hadir" name="✅ Hadir" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="terlambat" name="⚠️ Terlambat" fill="#eab308" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Shift Distribution */}
          {shiftDistribution.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
              <h2 className="text-md font-semibold text-gray-800 mb-4">🥧 Distribusi Shift</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={shiftDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => (percent ?? 0) > 0.05 ? `${name}` : ""}
                  >
                    {shiftDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        {recentActivities.length > 0 && (
          <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-md font-semibold text-gray-800">🔄 Aktivitas Terbaru</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentActivities.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.type === "attendance" ? "bg-green-500" : "bg-blue-500"}`} />
                    <p className="text-sm text-gray-800">{activity.title}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(activity.time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-xl bg-white shadow-md border border-gray-100 p-5">
          <h2 className="text-md font-semibold text-gray-800 mb-3">⚡ Aksi Cepat</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Link href="/attendance" className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-green-50 transition">
              <span className="text-lg">📅</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Attendance</p>
                <p className="text-xs text-gray-400">Lihat absensi</p>
              </div>
            </Link>
            <Link href="/attendance-corrections" className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-yellow-50 transition">
              <span className="text-lg">✏️</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Koreksi</p>
                <p className="text-xs text-gray-400">Kelola request</p>
              </div>
            </Link>
            <Link href="/users" className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition">
              <span className="text-lg">👥</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Users</p>
                <p className="text-xs text-gray-400">Kelola karyawan</p>
              </div>
            </Link>
            <Link href="/shifts" className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition">
              <span className="text-lg">⏰</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Shifts</p>
                <p className="text-xs text-gray-400">Kelola shift</p>
              </div>
            </Link>
            <Link href="/schedule-shift" className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 transition">
              <span className="text-lg">📅</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Schedule</p>
                <p className="text-xs text-gray-400">Jadwalkan shift</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}