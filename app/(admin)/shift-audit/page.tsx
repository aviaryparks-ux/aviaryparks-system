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
  where,
  Timestamp,
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
  changedAt: Timestamp;
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
      
      // Hitung statistik
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
        return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">➕ Tambah</span>;
      case "update":
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">✏️ Ubah</span>;
      case "delete":
        return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">🗑️ Hapus</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">-</span>;
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">Super Admin</span>;
      case "admin":
        return <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700">Admin</span>;
      case "hr":
        return <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">HR</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">{role}</span>;
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
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              📜 Riwayat Perubahan Shift
            </h1>
            <p className="text-gray-500 mt-1">
              Melihat siapa yang mengubah shift dan kapan perubahan dilakukan
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Data real-time</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Total Perubahan</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Tambah Shift</p>
                <p className="text-2xl font-bold text-green-800">{stats.create}</p>
              </div>
              <span className="text-3xl">➕</span>
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Ubah Shift</p>
                <p className="text-2xl font-bold text-blue-800">{stats.update}</p>
              </div>
              <span className="text-3xl">✏️</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-red-600">Hapus Shift</p>
                <p className="text-2xl font-bold text-red-800">{stats.delete}</p>
              </div>
              <span className="text-3xl">🗑️</span>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔍 Cari
              </label>
              <input
                type="text"
                placeholder="Cari nama karyawan, admin, atau shift..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏷️ Filter Aksi
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Semua Aksi</option>
                <option value="create">Tambah Shift</option>
                <option value="update">Ubah Shift</option>
                <option value="delete">Hapus Shift</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Filter Tanggal
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterAction("all");
                setFilterDate("");
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ↺ Reset Filter
            </button>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>📜</span>
              Riwayat Perubahan
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredLogs.length} record)
              </span>
            </h2>
            <button
              onClick={() => loadLogs()}
              className="text-green-600 text-sm hover:text-green-700 flex items-center gap-1"
            >
              <span>🔄</span>
              Refresh
            </button>
          </div>
          
          {loading && logs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-5xl mb-4">📭</div>
              <p>Tidak ada riwayat perubahan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">Karyawan</th>
                    <th className="px-4 py-3 text-left">Tanggal Shift</th>
                    <th className="px-4 py-3 text-left">Shift Lama</th>
                    <th className="px-4 py-3 text-left">Shift Baru</th>
                    <th className="px-4 py-3 text-left">Aksi</th>
                    <th className="px-4 py-3 text-left">Diubah Oleh</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={log.id} className={`border-t hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(log.changedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {log.userName}
                        <div className="text-xs text-gray-400">{log.userId?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {log.date}
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
                          <span className="font-medium">{log.changedByName}</span>
                          <div className="text-xs text-gray-400">{log.changedBy?.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getRoleBadge(log.changedByRole)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={log.notes}>
                        {log.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {hasMore && !loading && filteredLogs.length > 0 && (
            <div className="p-4 text-center border-t">
              <button
                onClick={() => loadLogs(true)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
              >
                Load More
              </button>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-500">
          <p>✅ Setiap perubahan shift akan tercatat di sini untuk keperluan audit</p>
          <p>👥 Data yang tercatat: siapa yang mengubah, shift apa yang diubah, dan kapan perubahan terjadi</p>
          <p>🔍 Gunakan fitur filter untuk mencari perubahan tertentu</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}