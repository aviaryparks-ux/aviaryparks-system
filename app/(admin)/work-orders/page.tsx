// app/(admin)/work-orders/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, ClipboardList, AlertCircle, Clock, CheckCircle2, ChevronRight, Activity, Calendar, LayoutDashboard } from "lucide-react";
import {
  WorkOrder,
  getWOStatusLabel,
  getWOPriorityLabel,
  getWOPriorityColor
} from "@/types/work-order";

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "urgent" | "project">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  useEffect(() => {
    const q = query(
      collection(db, "work_orders"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: WorkOrder[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as WorkOrder);
      });
      setWorkOrders(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(workOrders.map(wo => wo.assignedToDept).filter(Boolean));
    return ["all", ...Array.from(depts)];
  }, [workOrders]);

  // Stats
  const stats = useMemo(() => ({
    total: workOrders.length,
    open: workOrders.filter(w => w.status === "open").length,
    in_progress: workOrders.filter(w => w.status === "in_progress").length,
    pending_approval: workOrders.filter(w => w.status === "pending_approval").length,
    completed: workOrders.filter(w => w.status === "completed").length,
    urgent: workOrders.filter(w => w.type === "urgent").length,
    project: workOrders.filter(w => w.type === "project").length
  }), [workOrders]);

  // Filtered list
  const filtered = useMemo(() => {
    return workOrders.filter(wo => {
      if (typeFilter !== "all" && wo.type !== typeFilter) return false;
      if (statusFilter !== "all" && wo.status !== statusFilter) return false;
      if (deptFilter !== "all" && wo.assignedToDept !== deptFilter) return false;
      if (priorityFilter !== "all" && wo.priority !== priorityFilter) return false;
      return true;
    });
  }, [workOrders, typeFilter, statusFilter, deptFilter, priorityFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-red-100 text-red-600";
      case "in_progress": return "bg-yellow-100 text-yellow-600";
      case "pending_approval": return "bg-blue-100 text-blue-600";
      case "completed": return "bg-green-100 text-green-600";
      case "cancelled": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "urgent"
      ? "bg-red-100 text-red-700 border border-red-200"
      : "bg-purple-100 text-purple-700 border border-purple-200";
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="space-y-8 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Work Orders</h1>
            <p className="text-slate-500 mt-1">Kelola dan pantau seluruh daftar tugas operasional</p>
          </div>
          <Link href="/work-orders/create" className="group">
            <button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all duration-300 transform group-hover:-translate-y-0.5">
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
              <span>Buat Work Order Baru</span>
            </button>
          </Link>
        </div>

        {/* Stats Grid with Glassmorphism & Gradients */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <ClipboardList className="w-6 h-6 text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-red-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-red-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Urgent</p>
            <p className="text-3xl font-black text-red-600 mt-1">{stats.urgent}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-purple-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <Activity className="w-6 h-6 text-purple-500 mb-2" />
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Project</p>
            <p className="text-3xl font-black text-purple-600 mt-1">{stats.project}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-orange-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <Clock className="w-6 h-6 text-orange-500 mb-2" />
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Open</p>
            <p className="text-3xl font-black text-orange-600 mt-1">{stats.open}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-amber-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <Activity className="w-6 h-6 text-amber-500 mb-2" />
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider text-center">In Progress</p>
            <p className="text-3xl font-black text-amber-600 mt-1">{stats.in_progress}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-100 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Selesai</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{stats.completed}</p>
          </div>
        </div>

        {/* Filters Panel with Glassmorphism */}
        <div className="rounded-2xl bg-white/60 backdrop-blur-xl p-5 shadow-lg border border-white/40">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-700">Filter Data</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipe</label>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm">
                <option value="all">Semua Tipe</option>
                <option value="urgent">Urgent</option>
                <option value="project">Project</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm">
                <option value="all">Semua Status</option>
                <option value="open">Buka</option>
                <option value="in_progress">Sedang Dikerjakan</option>
                <option value="pending_approval">Menunggu Persetujuan</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departemen</label>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm">
                {departments.map(d => (
                  <option key={d} value={d}>{d === "all" ? "Semua Dept" : d}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioritas</label>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm">
                <option value="all">Semua Prioritas</option>
                <option value="critical">Kritis</option>
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingScreen fullScreen={false} message="Memuat daftar Work Order..." size={120} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <ClipboardList className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Belum ada Work Order</h3>
            <p className="text-slate-500 mt-2 max-w-sm">Daftar work order masih kosong. Silakan buat work order baru menggunakan tombol di atas.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(wo => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`} className="block group">
                <div className="rounded-2xl bg-white p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-emerald-200 transition-all duration-300 transform group-hover:-translate-y-1 relative">
                  
                  {/* Decorative Left Border based on priority */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    wo.priority === 'critical' ? 'bg-red-500' :
                    wo.priority === 'high' ? 'bg-orange-500' :
                    wo.priority === 'medium' ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`} />

                  <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center pl-3">
                    {/* Left - Icon & Status */}
                    <div className="flex-shrink-0 flex sm:flex-col items-center gap-3 sm:w-28">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                        wo.type === "urgent" ? "bg-red-50 text-red-500" : "bg-purple-50 text-purple-500"
                      }`}>
                        {wo.type === "urgent" ? <AlertCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-center w-full shadow-sm ${getStatusColor(wo.status)}`}>
                        {getWOStatusLabel(wo.status as any)}
                      </span>
                    </div>

                    {/* Center - Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md tracking-wider border border-slate-200">{wo.woNumber}</span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getTypeBadge(wo.type)} shadow-sm`}>
                          {wo.type === "urgent" ? "URGENT" : "PROJECT"}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${getWOPriorityColor(wo.priority as any)}`}>
                          {getWOPriorityLabel(wo.priority as any)}
                        </span>
                        {wo.source === "mod" && (
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
                            <LayoutDashboard className="w-3 h-3" /> MOD
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-1">{wo.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{wo.description}</p>
                      
                      <div className="flex items-center gap-5 mt-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(wo.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                          <span>Dept: <span className="text-slate-700 font-bold">{wo.assignedToDept}</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Right - Meta & Arrow */}
                    <div className="flex-shrink-0 flex items-center gap-6 self-stretch sm:self-auto sm:w-40 justify-between sm:justify-end border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6 mt-2 sm:mt-0">
                      <div className="flex-1">
                        {wo.type === "urgent" && wo.sla && (
                          <div className="flex flex-col items-start sm:items-end bg-slate-50 p-2.5 rounded-xl border border-slate-100 w-full">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> SLA Limit
                            </span>
                            <span className={`text-sm font-black ${wo.sla.isOverdue ? "text-red-600" : "text-emerald-600"}`}>
                              {wo.sla.isOverdue ? "OVERDUE" : formatDate(wo.sla.dueDate)}
                            </span>
                          </div>
                        )}
                        {wo.type === "project" && wo.milestones && (
                          <div className="flex flex-col items-start sm:items-end bg-slate-50 p-2.5 rounded-xl border border-slate-100 w-full">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Progress
                            </span>
                            <span className="text-sm font-black text-purple-600">
                              {wo.milestones.filter(m => m.status === "completed").length} <span className="text-slate-400 font-medium">/ {wo.milestones.length}</span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors border border-slate-100">
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    </div>

                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Links with Glassmorphism */}
        <div className="mt-12">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">Akses Cepat</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/work-orders/template" className="group">
              <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-5 border border-indigo-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-200 transition-all duration-300 transform group-hover:-translate-y-1 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -mr-8 -mt-8"></div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">Template WO</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Kelola data area & inventory</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/manager-on-duty/dashboard" className="group">
              <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-5 border border-teal-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-teal-200 transition-all duration-300 transform group-hover:-translate-y-1 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-bl-full -mr-8 -mt-8"></div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 shadow-inner group-hover:scale-110 transition-transform">
                    <LayoutDashboard className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-teal-600 transition-colors">Manager on Duty</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Pantau Dashboard MOD</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/manager-on-duty" className="group">
              <div className="bg-gradient-to-br from-fuchsia-50 to-white rounded-2xl p-5 border border-fuchsia-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-fuchsia-200 transition-all duration-300 transform group-hover:-translate-y-1 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-500/5 rounded-bl-full -mr-8 -mt-8"></div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-fuchsia-100 flex items-center justify-center text-fuchsia-600 shadow-inner group-hover:scale-110 transition-transform">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-fuchsia-600 transition-colors">Jadwal MOD</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Kelola penugasan jadwal</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}