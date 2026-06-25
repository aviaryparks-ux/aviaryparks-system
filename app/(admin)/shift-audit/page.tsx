// app/(admin)/shift-audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  startAfter,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  oldShiftId: string;
  oldShiftName: string;
  newShiftId: string;
  newShiftName: string;
  action: "create" | "update" | "delete";
  changedBy: string;
  changedByName: string;
  changedByRole: string;
  changedAt: any;
  notes: string;
};

export default function ShiftAuditPage() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ total: 0, create: 0, update: 0, delete: 0 });

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isHR = currentUser?.role === "hr";
  
  const canViewAudit = isSuperAdmin || isAdmin || isHR;

  const loadLogs = async (loadMore: boolean = false) => {
    if (!canViewAudit) return;
    
    setLoading(true);
    try {
      let q = query(
        collection(db, "shift_audit_logs"),
        orderBy("changedAt", "desc"),
        limit(50)
      );
      
      if (loadMore && lastDoc) {
        q = query(
          collection(db, "shift_audit_logs"),
          orderBy("changedAt", "desc"),
          startAfter(lastDoc),
          limit(50)
        );
      }
      
      const snapshot = await getDocs(q);
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as AuditLog[];
      
      if (loadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 50);
      
      const allLogs = loadMore ? [...logs, ...newLogs] : newLogs;
      const total = allLogs.length;
      const create = allLogs.filter(l => l.action === "create").length;
      const update = allLogs.filter(l => l.action === "update").length;
      const del = allLogs.filter(l => l.action === "delete").length;
      setStats({ total, create, update, delete: del });
      
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.changedByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.oldShiftName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.newShiftName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === "all" || log.action === filterAction;
    
    let matchesDate = true;
    if (filterDate && log.changedAt) {
      const logDate = log.changedAt.toDate().toISOString().split("T")[0];
      matchesDate = logDate === filterDate;
    }
    
    return matchesSearch && matchesAction && matchesDate;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Tambah</span>;
      case "update":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Ubah</span>;
      case "delete":
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Hapus</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">-</span>;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Super Admin</span>;
      case "admin":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">Admin</span>;
      case "hr":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">HR</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">{role}</span>;
    }
  };

  if (!canViewAudit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredFeature="manage_shifts">
      <div className="space-y-6 pb-20">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Perubahan</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Tambah Shift</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.create}</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-orange-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Ubah Shift</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.update}</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-red-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Hapus Shift</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stats.delete}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Data
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Cari</label>
              <input
                type="text"
                placeholder="Nama karyawan, admin, atau shift..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Filter Aksi</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full appearance-none border border-slate-200 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors focus:bg-white"
              >
                <option value="all">Semua Aksi</option>
                <option value="create">Tambah Shift</option>
                <option value="update">Ubah Shift</option>
                <option value="delete">Hapus Shift</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Filter Tanggal</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors focus:bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterDate("");
                setFilterAction("all");
                loadLogs();
              }}
              className="px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="rounded-xl bg-white shadow-md border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-slate-800">
                Riwayat Perubahan
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{filteredLogs.length} record</span>
                <button
                  onClick={() => loadLogs()}
                  className="text-emerald-600 text-sm hover:text-emerald-700 font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
          
          {loading && logs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-lg font-medium">Tidak ada riwayat perubahan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Waktu</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Karyawan</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Tanggal Shift</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Shift Lama</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Shift Baru</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Aksi</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Diubah Oleh</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Keterangan</th>
                </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr 
                      key={log.id} 
                      className={`border-t transition-all duration-150 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-green-50`}
                    >
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(log.changedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{log.userName}</p>
                          <p className="text-xs text-gray-400">{log.userId?.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-600">{log.date}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.oldShiftName ? (
                          <span className="text-gray-600">{log.oldShiftName}</span>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.newShiftName ? (
                          <span className="text-green-600 font-medium">{log.newShiftName}</span>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{log.changedByName}</p>
                          <p className="text-xs text-gray-400">{log.changedBy?.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getRoleBadge(log.changedByRole)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[250px]" title={log.notes}>
                        <div className="truncate">{log.notes}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {hasMore && !loading && filteredLogs.length > 0 && (
            <div className="p-4 text-center border-t border-gray-100">
              <button
                onClick={() => loadLogs(true)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">
          <div className="flex flex-wrap justify-center gap-4">
            <span>Setiap perubahan shift akan tercatat di sini untuk keperluan audit</span>
            <span>Data yang tercatat: siapa yang mengubah, shift apa yang diubah, dan kapan perubahan terjadi</span>
            <span>Gunakan fitur filter untuk mencari perubahan tertentu</span>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}