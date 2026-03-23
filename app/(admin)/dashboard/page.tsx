// app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  totalAttendance: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  todayAttendance: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAttendance: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    todayAttendance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Load users
      const usersSnap = await getDocs(collection(db, "users"));
      const totalUsers = usersSnap.size;

      // Load attendance
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const totalAttendance = attendanceSnap.size;

      // Count today's attendance
      const today = new Date().toISOString().split("T")[0];
      let todayAttendance = 0;
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.date?.toDate) {
          const dateStr = data.date.toDate().toISOString().split("T")[0];
          if (dateStr === today) todayAttendance++;
        }
      });

      // Load requests
      const requestsSnap = await getDocs(collection(db, "attendance_requests"));
      let pending = 0, approved = 0, rejected = 0;
      requestsSnap.forEach(doc => {
        const status = doc.data().status;
        if (status === "pending") pending++;
        else if (status === "approved") approved++;
        else if (status === "rejected") rejected++;
      });

      setStats({
        totalUsers,
        totalAttendance,
        pendingRequests: pending,
        approvedRequests: approved,
        rejectedRequests: rejected,
        todayAttendance,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: "👥",
      color: "from-blue-500 to-blue-600",
      bgLight: "bg-blue-50",
      link: "/users",
    },
    {
      title: "Today Attendance",
      value: stats.todayAttendance,
      icon: "📅",
      color: "from-green-500 to-green-600",
      bgLight: "bg-green-50",
      link: "/attendance",
    },
    {
      title: "Pending Requests",
      value: stats.pendingRequests,
      icon: "⏳",
      color: "from-yellow-500 to-yellow-600",
      bgLight: "bg-yellow-50",
      link: "/attendance-corrections",
    },
    {
      title: "Approved",
      value: stats.approvedRequests,
      icon: "✅",
      color: "from-emerald-500 to-emerald-600",
      bgLight: "bg-emerald-50",
      link: "/attendance-corrections",
    },
    {
      title: "Rejected",
      value: stats.rejectedRequests,
      icon: "❌",
      color: "from-red-500 to-red-600",
      bgLight: "bg-red-50",
      link: "/attendance-corrections",
    },
    {
      title: "Total Attendance",
      value: stats.totalAttendance,
      icon: "📊",
      color: "from-purple-500 to-purple-600",
      bgLight: "bg-purple-50",
      link: "/attendance",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "employee"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Welcome to Attendance Management System</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card, idx) => (
            <Link
              key={idx}
              href={card.link}
              className={`
                relative overflow-hidden rounded-2xl p-6 transition-all duration-300
                hover:shadow-lg hover:scale-105 cursor-pointer group
                ${card.bgLight} border border-gray-100
              `}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity`} />
              <div className="relative z-10">
                <div className={`flex items-center justify-center w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl mb-4 shadow-lg`}>
                  <span className="text-2xl">{card.icon}</span>
                </div>
                <div className="text-sm font-medium text-gray-500 mb-1">{card.title}</div>
                <div className="text-3xl font-bold text-gray-800">{card.value.toLocaleString()}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>⚡</span>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/attendance"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">View Attendance</p>
                <p className="text-xs text-gray-500">Check today's records</p>
              </div>
            </Link>
            <Link
              href="/attendance-corrections"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">✏️</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Corrections</p>
                <p className="text-xs text-gray-500">Manage requests</p>
              </div>
            </Link>
            <Link
              href="/users"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Users</p>
                <p className="text-xs text-gray-500">Manage employees</p>
              </div>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">⚙️</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Settings</p>
                <p className="text-xs text-gray-500">Configure locations</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}