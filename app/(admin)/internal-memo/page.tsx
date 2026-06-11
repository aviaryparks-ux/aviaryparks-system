// app/(admin)/internal-memo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, onSnapshot, limit } from "firebase/firestore";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

export default function InternalMemoPage() {
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [memos, setMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "action_needed">("all");

  useEffect(() => {
    if (!user) return;
    
    // Listen to all memos
    const q = query(collection(db, "internal_memos"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMemos(memosData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching memos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT": 
        return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm border border-slate-200">Draft</span>;
      case "PENDING": 
        return <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm border border-amber-200/60">Menunggu</span>;
      case "APPROVED": 
        return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm border border-emerald-200/60">Disetujui</span>;
      case "REJECTED": 
        return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm border border-red-200/60">Ditolak</span>;
      default: return null;
    }
  };

  const getFilteredMemos = () => {
    if (activeTab === "all") return memos;
    
    // Perlu Tindakan Saya
    // Artinya: Status PENDING, dan currentApproverIndex menunjuk pada giliran user ini
    return memos.filter(memo => {
      if (memo.status !== "PENDING") return false;
      const currentApprover = memo.approvalFlow?.[memo.currentApproverIndex || 0];
      return currentApprover?.approverUid === user?.uid;
    });
  };

  const filteredMemos = getFilteredMemos();

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!can("view_memo")) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-gray-500 mt-2">Anda tidak memiliki izin untuk melihat Internal Memo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-end items-center mb-6">
        {can("manage_memo") && (
          <Link 
            href="/internal-memo/create" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Buat Memo Baru
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "all" ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Semua Memo
        </button>
        <button
          onClick={() => setActiveTab("action_needed")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "action_needed" ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Perlu Tindakan Saya
          {memos.filter(memo => memo.status === "PENDING" && memo.approvalFlow?.[memo.currentApproverIndex || 0]?.approverUid === user?.uid).length > 0 && (
             <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
               {memos.filter(memo => memo.status === "PENDING" && memo.approvalFlow?.[memo.currentApproverIndex || 0]?.approverUid === user?.uid).length}
             </span>
          )}
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4 text-left">No. Memo</th>
                <th className="px-6 py-4 text-left">Perihal</th>
                <th className="px-6 py-4 text-left">Pembuat</th>
                <th className="px-6 py-4 text-left">Tanggal</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMemos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-slate-400 text-sm font-medium">Belum ada memo ditemukan.</p>
                  </td>
                </tr>
              ) : (
                filteredMemos.map((memo) => (
                  <tr key={memo.id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                    <td className="px-6 py-5 break-words whitespace-normal text-sm font-bold text-slate-700 max-w-[200px]">
                      {memo.memoNumber || "-"}
                    </td>
                    <td className="px-6 py-5 whitespace-normal text-sm text-slate-600 font-medium group-hover:text-emerald-600 transition-colors min-w-[200px]">
                      {memo.subject}
                    </td>
                    <td className="px-6 py-5 whitespace-normal text-sm text-slate-500">
                      {memo.createdBy?.name || "Unknown"}
                    </td>
                    <td className="px-6 py-5 whitespace-normal text-sm text-slate-500">
                      {memo.createdAt?.toDate ? memo.createdAt.toDate().toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                    </td>
                    <td className="px-6 py-5 whitespace-normal">
                      {getStatusBadge(memo.status)}
                    </td>
                    <td className="px-6 py-5 whitespace-normal text-center">
                      <Link 
                        href={`/internal-memo/${memo.id}`}
                        className="inline-flex items-center justify-center px-4 py-2 border-2 border-transparent text-xs font-bold rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all duration-300"
                      >
                        Buka Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
