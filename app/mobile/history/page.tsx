// app/mobile/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp 
} from "firebase/firestore";

export default function MobileHistoryPage() {
  const { user } = useAuth();
  const [correctionHistory, setCorrectionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    loadCorrectionHistory();
  }, [user]);

  const loadCorrectionHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "attendance_requests"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCorrectionHistory(data);
    } catch (error) {
      console.error("Error loading correction history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", { 
      day: "numeric", 
      month: "long", 
      year: "numeric" 
    });
  };

  const formatShortDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", { 
      day: "numeric", 
      month: "short" 
    });
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", { 
      day: "numeric", 
      month: "short", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Disetujui";
      case "rejected":
        return "Ditolak";
      default:
        return "Menunggu";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-orange-600 bg-orange-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return "✅";
      case "rejected":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStepText = (currentStep: number, status: string) => {
    if (status === "approved") return "Selesai";
    if (status === "rejected") return "Ditolak";
    if (currentStep === 0) return "Menunggu SPV";
    if (currentStep === 1) return "Menunggu HRD";
    return "Proses";
  };

  const getStepColor = (currentStep: number, status: string) => {
    if (status === "approved") return "text-green-600";
    if (status === "rejected") return "text-red-600";
    if (currentStep === 0) return "text-orange-600";
    if (currentStep === 1) return "text-blue-600";
    return "text-gray-500";
  };

  const filteredHistory = correctionHistory.filter(item => {
    if (filterStatus === "ALL") return true;
    return item.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 bg-white/10 rounded-2xl p-1">
        {["ALL", "pending", "approved", "rejected"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === tab
                ? "bg-green-600 text-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab === "ALL" ? "Semua" : getStatusText(tab)}
            {tab === "pending" && correctionHistory.filter(r => r.status === "pending").length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                {correctionHistory.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-white/70">Belum ada pengajuan koreksi</p>
          <p className="text-white/50 text-sm mt-1">Pengajuan koreksi akan muncul di sini</p>
        </div>
      ) : (
        filteredHistory.map((item, idx) => {
          const date = item.date?.toDate();
          const createdAt = item.createdAt?.toDate();
          const status = item.status || "pending";
          const currentStep = item.currentStep || 0;
          const stepText = getStepText(currentStep, status);
          const stepColor = getStepColor(currentStep, status);
          const statusColor = getStatusColor(status);
          const statusIcon = getStatusIcon(status);
          const statusText = getStatusText(status);
          
          const checkIn = item.checkIn || "--";
          const checkOut = item.checkOut || "--";
          const oldCheckIn = item.oldCheckIn;
          const oldCheckOut = item.oldCheckOut;
          const approvedBy = item.approvedByName || item.approvedBy;
          const rejectedBy = item.rejectedByName || item.rejectedBy;
          
          return (
            <div key={item.id || idx} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">📋</span>
                      <p className="font-bold text-gray-800">
                        {date ? formatDate(item.date) : "Tanggal tidak tersedia"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400">
                      Diajukan: {createdAt ? formatDateTime(item.createdAt) : "-"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusIcon} {statusText}
                    </span>
                    <span className={`text-xs ${stepColor}`}>
                      {stepText}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4">
                {/* Department & Jabatan */}
                {item.department && (
                  <div className="flex gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {item.department}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                      {item.jabatan || "-"}
                    </span>
                  </div>
                )}
                
                {/* Jam Koreksi */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">⏰</span>
                    <span className="text-sm font-medium text-gray-700">Jam Koreksi</span>
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Jam Masuk Baru</p>
                      <p className="font-medium text-green-600">{checkIn}</p>
                      {oldCheckIn && (
                        <p className="text-xs text-gray-400 line-through">Lama: {oldCheckIn}</p>
                      )}
                    </div>
                    <div className="text-gray-300">→</div>
                    <div>
                      <p className="text-xs text-gray-500">Jam Pulang Baru</p>
                      <p className="font-medium text-green-600">{checkOut}</p>
                      {oldCheckOut && (
                        <p className="text-xs text-gray-400 line-through">Lama: {oldCheckOut}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Alasan */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1">Alasan Koreksi</p>
                  <p className="text-sm text-gray-700">{item.reason || "-"}</p>
                </div>
                
                {/* Approval Info */}
                {status === "approved" && approvedBy && (
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✅</span>
                      <div>
                        <p className="text-xs text-green-600">Disetujui oleh</p>
                        <p className="text-sm font-medium text-green-700">{approvedBy}</p>
                        {item.approvedAt && (
                          <p className="text-xs text-green-500">
                            {formatDateTime(item.approvedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {status === "rejected" && rejectedBy && (
                  <div className="bg-red-50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">❌</span>
                      <div>
                        <p className="text-xs text-red-600">Ditolak oleh</p>
                        <p className="text-sm font-medium text-red-700">{rejectedBy}</p>
                        {item.rejectedAt && (
                          <p className="text-xs text-red-500">
                            {formatDateTime(item.rejectedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Flow Snapshot (Approval Flow) */}
                {item.flowSnapshot && item.flowSnapshot.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">Status Persetujuan</p>
                    <div className="flex items-center gap-2">
                      {item.flowSnapshot.map((step: any, i: number) => {
                        const stepStatus = step.status;
                        const isCompleted = stepStatus === "approved";
                        const isRejected = stepStatus === "rejected";
                        const isWaiting = stepStatus === "waiting";
                        
                        return (
                          <div key={i} className="flex-1">
                            <div className={`text-center p-2 rounded-lg ${
                              isCompleted ? "bg-green-50" : isRejected ? "bg-red-50" : "bg-gray-50"
                            }`}>
                              <div className={`text-sm ${
                                isCompleted ? "text-green-600" : isRejected ? "text-red-600" : "text-gray-400"
                              }`}>
                                {step.role === "spv" ? "👔" : "📋"}
                              </div>
                              <div className={`text-xs font-medium ${
                                isCompleted ? "text-green-600" : isRejected ? "text-red-600" : "text-gray-500"
                              }`}>
                                {step.role === "spv" ? "SPV" : "HRD"}
                              </div>
                              <div className={`text-xs ${
                                isCompleted ? "text-green-500" : isRejected ? "text-red-500" : "text-gray-400"
                              }`}>
                                {stepStatus === "approved" ? "✓" : stepStatus === "rejected" ? "✗" : "⏳"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}