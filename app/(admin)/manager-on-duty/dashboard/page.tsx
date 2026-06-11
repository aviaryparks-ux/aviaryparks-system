// app/(admin)/manager-on-duty/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  limit
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { MODSchedule, getDayOfWeek, getDayName, formatDate, getRoleLabel } from "@/types/mod";

export default function MODDashboardPage() {
  const { user } = useAuth();
  const [currentSchedule, setCurrentSchedule] = useState<MODSchedule | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<MODSchedule[]>([]);
  const [stats, setStats] = useState({
    totalSchedules: 0,
    totalReports: 0,
    submittedReports: 0,
    reviewedReports: 0
  });
  const [loading, setLoading] = useState(true);

  // Get today's info
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayDayOfWeek = getDayOfWeek(todayStr);

  useEffect(() => {
    // Load today's schedule
    const todayQuery = query(
      collection(db, "mod_schedules"),
      where("date", "==", todayStr)
    );

    const unsubToday = onSnapshot(todayQuery, (snap) => {
      if (!snap.empty) {
        setCurrentSchedule({ id: snap.docs[0].id, ...snap.docs[0].data() } as MODSchedule);
      } else {
        setCurrentSchedule(null);
      }
      setLoading(false);
    });

    // Load all schedules for recent list
    const allScheduleQuery = query(
      collection(db, "mod_schedules"),
      orderBy("date", "desc"),
      limit(20)
    );
    const unsubAllSchedules = onSnapshot(allScheduleQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MODSchedule));
      setRecentSchedules(list.slice(0, 5));
      setStats(prev => ({ ...prev, totalSchedules: snap.size }));
    });

    return () => {
      unsubToday();
      unsubAllSchedules();
    };
  }, [todayStr]);

  useEffect(() => {
    // Load report stats
    const reportQuery = query(collection(db, "mod_reports"), limit(100));
    const unsubReports = onSnapshot(reportQuery, (snap) => {
      let submitted = 0;
      let reviewed = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === "submitted") submitted++;
        if (data.status === "reviewed") reviewed++;
      });
      setStats(prev => ({
        ...prev,
        totalReports: snap.size,
        submittedReports: submitted,
        reviewedReports: reviewed
      }));
    });

    return () => unsubReports();
  }, []);

  // Check if current user is MOD today
  const isCurrentUserMOD = currentSchedule?.userId === user?.uid;
  const canCreateSchedule = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";
  const canReview = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="space-y-6 p-6">
        {/* MOD Status Banner - Only show on Fri/Sat/Sun */}
        {todayDayOfWeek && (
          <div className={`rounded-lg border p-5 ${isCurrentUserMOD ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${isCurrentUserMOD ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-lg">
                    {isCurrentUserMOD ? "Anda sedang bertugas (MOD) hari ini" : "Petugas MOD Hari Ini"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {getDayName(todayDayOfWeek)} - {formatDate(todayStr)}
                  </p>
                </div>
              </div>
              {currentSchedule && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{currentSchedule.userName}</p>
                    <p className="text-xs text-slate-500">{currentSchedule.department} • {getRoleLabel(currentSchedule.role)}</p>
                  </div>
                </div>
              )}
            </div>
            {isCurrentUserMOD && (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/manager-on-duty/fill"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  Isi Laporan MOD
                </Link>
                <Link
                  href="/work-orders/create"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Buat Work Order
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Not MOD Day Banner */}
        {!todayDayOfWeek && (
          <div className="rounded-lg p-5 bg-white border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                 <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Hari Biasa</h2>
                <p className="text-sm text-slate-500">
                  Operasional normal. Sistem MOD hanya aktif pada hari Jumat, Sabtu, dan Minggu.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Jadwal MOD</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-800">{stats.totalSchedules}</p>
              <p className="text-xs text-slate-500">hari</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Laporan</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-800">{stats.totalReports}</p>
              <p className="text-xs text-slate-500">dokumen</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Menunggu Review</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-800">{stats.submittedReports}</p>
              <p className="text-xs text-slate-500">laporan</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Selesai Review</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-800">{stats.reviewedReports}</p>
              <p className="text-xs text-slate-500">laporan</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming MOD Days */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-semibold text-slate-800 text-sm">Jadwal 7 Hari Kedepan</h2>
                {canCreateSchedule && (
                  <Link
                    href="/manager-on-duty/schedule"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    + Buat Jadwal
                  </Link>
                )}
              </div>
              <div className="p-5">
                {loading ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Memuat jadwal...</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[...Array(7)].map((_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() + i);
                      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const dayOfWeek = getDayOfWeek(dateStr);
                      const schedule = recentSchedules.find(s => s.date === dateStr);

                      if (!dayOfWeek) return null;

                      return (
                        <div
                          key={dateStr}
                          className={`p-3 rounded-lg border ${
                            i === 0 ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/30'
                          } ${!schedule && 'opacity-70'}`}
                        >
                          <p className="text-xs text-slate-500 font-medium mb-1">{date.toLocaleDateString('id-ID', { weekday: 'short' })}</p>
                          <p className="text-lg font-semibold text-slate-800 leading-none">{date.getDate()}</p>
                          {schedule ? (
                            <div className="mt-3 pt-3 border-t border-gray-200/60">
                              <p className="text-xs font-medium text-slate-800 truncate" title={schedule.userName}>{schedule.userName.split(' ')[0]}</p>
                              <p className="text-[10px] text-slate-500 truncate" title={schedule.department}>{schedule.department}</p>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-transparent text-center">
                               <p className="text-[10px] text-slate-400">Kosong</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
               <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
                 <h2 className="font-semibold text-slate-800 text-sm">Aksi Cepat</h2>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-200">
                  <Link href="/manager-on-duty" className="p-5 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                     <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     <span className="text-xs font-medium text-slate-700">Jadwal</span>
                  </Link>
                  <Link href="/manager-on-duty/dashboard" className="p-5 flex flex-col items-center justify-center gap-2 bg-slate-50">
                     <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                     <span className="text-xs font-medium text-blue-700">Dashboard</span>
                  </Link>
                  <Link href="/manager-on-duty/template" className="p-5 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                     <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                     <span className="text-xs font-medium text-slate-700">Template</span>
                  </Link>
                  <Link href="/work-orders" className="p-5 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                     <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                     <span className="text-xs font-medium text-slate-700">Work Orders</span>
                  </Link>
               </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
               <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                  <h2 className="font-semibold text-slate-800 text-sm">Jadwal Terbaru</h2>
                  <Link href="/manager-on-duty" className="text-xs text-slate-500 hover:text-slate-700">Lihat Semua</Link>
               </div>
               <div className="divide-y divide-gray-100">
                  {recentSchedules.slice(0, 5).map((schedule) => (
                    <div key={schedule.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                       <div>
                          <p className="text-sm font-medium text-slate-800">{getDayName(schedule.dayOfWeek)}, {formatDate(schedule.date)}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                             <p className="text-xs text-slate-500">{schedule.userName}</p>
                          </div>
                       </div>
                       <Link
                          href={`/manager-on-duty/schedule?id=${schedule.id}`}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                       </Link>
                    </div>
                  ))}
                  {recentSchedules.length === 0 && (
                     <div className="p-8 text-center text-xs text-slate-400">Belum ada jadwal.</div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}