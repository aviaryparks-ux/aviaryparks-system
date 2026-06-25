"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppEvent } from "@/types/event";
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
import { format, isThisMonth, isAfter, startOfDay } from "date-fns";
import { id } from "date-fns/locale";

const CHART_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444"];
const SALES_COLORS = ["#8b5cf6", "#6366f1", "#ec4899", "#14b8a6", "#f43f5e"];

export default function EventDashboardPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AppEvent[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as AppEvent);
      });
      setEvents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Summary Cards
  const thisMonthEvents = events.filter((e) => e.startDate && isThisMonth(new Date(e.startDate)));
  const totalFEO = thisMonthEvents.filter((e) => e.type === "FEO").length;
  const totalREO = thisMonthEvents.filter((e) => e.type === "REO").length;
  const approvedThisMonth = thisMonthEvents.filter((e) => e.status === "approved").length;
  const approvedPercentage = thisMonthEvents.length > 0 ? Math.round((approvedThisMonth / thisMonthEvents.length) * 100) : 0;

  // 2. Status Distribution (Pie Chart)
  const statusCounts = events.reduce((acc, event) => {
    acc[event.status] = (acc[event.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: "Approved", value: statusCounts["approved"] || 0 },
    { name: "Draft", value: statusCounts["draft"] || 0 },
    { name: "Negotiation", value: statusCounts["negotiation"] || 0 },
    { name: "Rejected", value: statusCounts["rejected"] || 0 },
  ].filter(d => d.value > 0);

  // 3. Last 6 Months Trend (Bar Chart)
  const last6MonthsData = () => {
    const data = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = format(d, "MMM yyyy", { locale: id });
      
      const monthEvents = events.filter(e => {
        if (!e.startDate) return false;
        const evDate = new Date(e.startDate);
        return evDate.getMonth() === d.getMonth() && evDate.getFullYear() === d.getFullYear();
      });

      data.push({
        month: monthStr,
        FEO: monthEvents.filter(e => e.type === "FEO").length,
        REO: monthEvents.filter(e => e.type === "REO").length,
      });
    }
    return data;
  };

  // 4. Top Sales Leaderboard (Bar Chart)
  const salesLeaderboard = () => {
    const salesCounts = events.reduce((acc, event) => {
      // Hanya hitung event yang bukan rejected/cancelled
      if (event.status === "rejected" || event.status === "cancelled") return acc;
      
      let salesName = "";
      if (event.type === "FEO" && event.feoData?.salesIncharge) {
        salesName = event.feoData.salesIncharge;
      } else if (event.type === "REO" && event.reoData?.salesIncharge) {
        salesName = event.reoData.salesIncharge;
      }

      if (salesName) {
        acc[salesName] = (acc[salesName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(salesCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Ambil Top 5
  };

  // 5. Upcoming Events
  const upcomingEvents = events
    .filter(e => e.startDate && isAfter(new Date(e.startDate), startOfDay(new Date())) && e.status !== "rejected" && e.status !== "cancelled")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredFeature="view_events_dashboard">
      <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Event</h1>
          <p className="text-slate-500 mt-1">Ringkasan statistik FEO & REO serta performa tim Sales.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Event (Bulan Ini)</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{thisMonthEvents.length}</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total FEO (Bulan Ini)</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600">{totalFEO}</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total REO (Bulan Ini)</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-500">{totalREO}</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Approved (Bulan Ini)</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-500">{approvedPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${approvedPercentage}%` }}></div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Top Sales Leaderboard */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">🔥 Top Sales Leaderboard</h2>
              <p className="text-sm text-slate-500">Berdasarkan jumlah event yang ditangani</p>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesLeaderboard()} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={32}>
                    {salesLeaderboard().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SALES_COLORS[index % SALES_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend 6 Bulan */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">Trend Event (6 Bulan Terakhir)</h2>
              <p className="text-sm text-slate-500">Perbandingan jumlah FEO dan REO bulanan</p>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last6MonthsData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="FEO" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="REO" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">Distribusi Status Event</h2>
              <p className="text-sm text-slate-500">Keseluruhan status dokumen FEO & REO</p>
            </div>
            <div className="h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                <div className="text-center">
                  <p className="text-3xl font-black text-slate-800">{events.length}</p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Events List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Event Mendatang</h2>
                <p className="text-sm text-slate-500">Jadwal event yang akan segera dilaksanakan</p>
              </div>
              <Link href="/events/calendar" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                Lihat Kalender
              </Link>
            </div>
            <div className="flex-1 overflow-auto">
              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Belum ada event mendatang</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex gap-4 items-center p-3 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                      <div className="bg-slate-100 p-3 rounded-xl min-w-[70px] text-center shrink-0">
                        <p className="text-xs font-bold text-slate-500 uppercase">{format(new Date(event.startDate), "MMM", { locale: id })}</p>
                        <p className="text-xl font-black text-slate-800 leading-none mt-1">{format(new Date(event.startDate), "dd")}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${event.type === 'FEO' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {event.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${event.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 truncate">{event.title}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {event.type === 'FEO' ? event.clientName : (event.reoData?.guestName || event.clientName)} • {event.startTime} - {event.endTime}
                        </p>
                      </div>
                      <Link 
                        href={`/events/${event.type.toLowerCase()}/${event.id}`}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
