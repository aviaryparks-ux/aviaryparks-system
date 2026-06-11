// app/(admin)/manager-on-duty/report/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { formatDate, getDayName } from "@/types/mod";

type Report = {
  id: string;
  scheduleId: string;
  date: string;
  dayOfWeek: string;
  submittedByName: string;
  submittedAt: any;
  status: string;
  areaAnswers?: any[];
  problems?: any[];
};

export default function MODReportListPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const q = query(
      collection(db, "mod_reports"),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Report[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Report);
      });
      setReports(list);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedMonth]);

  const filteredReports = statusFilter === "all"
    ? reports
    : reports.filter(r => r.status === statusFilter);

  const stats = {
    total: reports.length,
    draft: reports.filter(r => r.status === 'draft').length,
    submitted: reports.filter(r => r.status === 'submitted').length,
    reviewed: reports.filter(r => r.status === 'reviewed').length
  };

  // Count checked questions
  const getReportStats = (report: Report) => {
    let total = 0, checked = 0, problems = 0;
    const areaData = report.areaAnswers || (report as any).areas || [];
    areaData.forEach((area: any) => {
      area.questions?.forEach((q: any) => {
        if (q.actionRequired || q.needNote || q.needPhoto) {
          total++;
          if (q.isChecked) checked++;
        }
      });
    });
    if (report.problems) problems = report.problems.length;
    return { total, checked, problems };
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="space-y-6 pb-20">
        {/* Header Clean */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laporan MOD</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola dan review laporan inspeksi Manager on Duty</p>
          </div>
          {/* Filter */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
            />
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex gap-1 pr-1">
              {["all", "draft", "submitted", "reviewed"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    statusFilter === s ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {s === "all" ? `Semua (${stats.total})` :
                   s === "draft" ? `Draft (${stats.draft})` :
                   s === "submitted" ? `Submitted (${stats.submitted})` :
                   `Reviewed (${stats.reviewed})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Laporan', value: stats.total, color: 'text-slate-800' },
            { label: 'Draft', value: stats.draft, color: 'text-amber-600' },
            { label: 'Submitted', value: stats.submitted, color: 'text-blue-600' },
            { label: 'Reviewed', value: stats.reviewed, color: 'text-emerald-600' }
          ].map((stat, i) => (
            <div key={i} className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="block rounded-xl bg-white border border-slate-200 overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 animate-pulse">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 shrink-0"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-slate-100 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="flex gap-4">
                      <div className="h-4 bg-slate-100 rounded w-16"></div>
                      <div className="h-4 bg-slate-100 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="w-24 h-10 bg-slate-100 rounded-lg shrink-0"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-xl border-2 border-slate-200 border-dashed bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center mt-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-5 text-slate-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Belum ada laporan</h3>
            <p className="text-sm text-slate-500">Tidak ada laporan MOD untuk filter atau bulan ini.</p>
          </div>
        ) : (
          <div className="space-y-3 mt-6">
            {filteredReports.map(r => {
              const s = getReportStats(r);
              return (
                <Link key={r.id} href={`/manager-on-duty/report/${r.id}`} className="block rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden group">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shrink-0 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{(getDayName(r.dayOfWeek as any) || new Date(r.date).toLocaleDateString('id-ID', {weekday: 'short'})).substring(0,3)}</span>
                      <span className="text-xl font-bold text-slate-700">{new Date(r.date).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 truncate">Laporan Inspeksi - {formatDate(r.date)}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                          r.status === "reviewed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          r.status === "submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {r.status === "draft" ? "Draft" : r.status === "submitted" ? "Submitted" : "Reviewed"}
                        </span>
                      </div>
                        <p className="text-[13px] text-slate-500 mb-2">Disubmit oleh <span className="font-medium text-slate-700">{r.submittedByName || (r as any).userName}</span></p>
                      <div className="flex flex-wrap gap-4 text-xs font-medium">
                        <span className="flex items-center gap-1 text-slate-600">
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                          {s.checked}/{s.total} Area Dicek
                        </span>
                        {s.problems > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            {s.problems} Masalah
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex w-8 h-8 rounded-full bg-slate-50 items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-8 border-t border-slate-100">
          <Link href="/manager-on-duty" className="rounded-xl p-4 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Jadwal MOD</h3>
                <p className="text-xs text-slate-500">Kelola jadwal</p>
              </div>
            </div>
          </Link>
          <Link href="/manager-on-duty/dashboard" className="rounded-xl p-4 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Dashboard</h3>
                <p className="text-xs text-slate-500">Ringkasan statistik</p>
              </div>
            </div>
          </Link>
          <Link href="/manager-on-duty/template" className="rounded-xl p-4 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-amber-600 group-hover:bg-amber-50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Template</h3>
                <p className="text-xs text-slate-500">Edit pertanyaan</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}