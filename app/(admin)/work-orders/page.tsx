// app/(admin)/work-orders/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      orderBy("createdAt", "desc")
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
      <div className="space-y-6 pb-20">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Urgent</p>
            <p className="text-xl font-bold text-red-600">{stats.urgent}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Project</p>
            <p className="text-xl font-bold text-purple-600">{stats.project}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Open</p>
            <p className="text-xl font-bold text-red-600">{stats.open}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">In Progress</p>
            <p className="text-xl font-bold text-yellow-600">{stats.in_progress}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-blue-600">{stats.pending_approval}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md border text-center">
            <p className="text-xs text-gray-500">Completed</p>
            <p className="text-xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl bg-white p-4 shadow-md border">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Tipe:</label>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="all">Semua</option>
                <option value="urgent">Urgent</option>
                <option value="project">Project</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Status:</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="all">Semua</option>
                <option value="open">Buka</option>
                <option value="in_progress">Sedang Dikerjakan</option>
                <option value="pending_approval">Menunggu Persetujuan</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Dept:</label>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                {departments.map(d => (
                  <option key={d} value={d}>{d === "all" ? "Semua" : d}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Priority:</label>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="all">Semua</option>
                <option value="critical">Kritis</option>
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <Link href="/work-orders/create" className="block">
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2">
            <span className="text-xl">➕</span>
            <span>Buat Work Order Baru</span>
          </button>
        </Link>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingScreen fullScreen={false} message="Memuat daftar Work Order..." size={120} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-md border">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500 text-lg">Belum ada Work Order</p>
            <p className="text-gray-400 text-sm mt-1">Klik tombol di atas untuk membuat baru</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(wo => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`} className="block rounded-xl bg-white shadow-md border overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Left - WO Number & Title */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{wo.woNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(wo.type)}`}>
                          {wo.type === "urgent" ? "⚡ Urgent" : "📁 Project"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(wo.status)}`}>
                          {getWOStatusLabel(wo.status as any)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-1">{wo.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-1">{wo.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>📅 {formatDate(wo.createdAt)}</span>
                        <span>📍 {wo.assignedToDept}</span>
                        <span className={`px-1.5 py-0.5 rounded ${getWOPriorityColor(wo.priority as any)}`}>
                          {getWOPriorityLabel(wo.priority as any)}
                        </span>
                        {wo.source === "mod" && (
                          <span className="text-purple-600">🔗 From MOD</span>
                        )}
                      </div>
                    </div>

                    {/* Right - SLA or Milestones indicator */}
                    <div className="text-right flex-shrink-0">
                      {wo.type === "urgent" && wo.sla && (
                        <div className="text-xs">
                          <p className="text-gray-500">SLA</p>
                          <p className={`font-medium ${wo.sla.isOverdue ? "text-red-600" : "text-green-600"}`}>
                            {wo.sla.isOverdue ? "⚠️ OVERDUE" : formatDate(wo.sla.dueDate)}
                          </p>
                        </div>
                      )}
                      {wo.type === "project" && wo.milestones && (
                        <div className="text-xs">
                          <p className="text-gray-500">Milestones</p>
                          <p className="font-medium text-purple-600">
                            {wo.milestones.filter(m => m.status === "completed").length}/{wo.milestones.length}
                          </p>
                        </div>
                      )}
                    </div>

                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/work-orders/template" className="bg-gradient-to-br from-orange-50 to-white rounded-xl p-4 border border-orange-100 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">📋</div>
              <div>
                <h3 className="font-semibold text-gray-800">Template WO</h3>
                <p className="text-xs text-gray-500">Kelola area & inventory</p>
              </div>
            </div>
          </Link>
          <Link href="/manager-on-duty/dashboard" className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border border-emerald-100 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">📝</div>
              <div>
                <h3 className="font-semibold text-gray-800">Manager on Duty</h3>
                <p className="text-xs text-gray-500">Dashboard MOD</p>
              </div>
            </div>
          </Link>
          <Link href="/manager-on-duty" className="bg-gradient-to-br from-purple-50 to-white rounded-xl p-4 border border-purple-100 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">📅</div>
              <div>
                <h3 className="font-semibold text-gray-800">Jadwal MOD</h3>
                <p className="text-xs text-gray-500">Kelola jadwal MOD</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}