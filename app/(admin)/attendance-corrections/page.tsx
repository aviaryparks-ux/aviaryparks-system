// app/(admin)/attendance-corrections/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  Timestamp,
  getDoc,
  setDoc,
  limit
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { Clock, CheckCircle2, XCircle, FileEdit, AlertTriangle, ShieldAlert, Inbox } from "lucide-react";

type Request = {
  id: string;
  uid: string;
  name: string;
  department: string;
  jabatan: string;
  date: any;
  checkIn?: string;
  checkOut?: string;
  reason: string;
  status: string;
  currentStep: number;
  flowSnapshot: Array<{
    role: string;
    status: string;
    by?: string;
    byName?: string;
    at?: any;
    note?: string;
  }>;
  createdAt?: any;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: any;
};

export default function AttendanceCorrectionsPage() {
  const [allData, setAllData] = useState<Request[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [filter, setFilter] = useState("ALL");
  const [pendingCount, setPendingCount] = useState(0);
  const [previousPendingCount, setPreviousPendingCount] = useState(0);
  const { user } = useAuth();

  const userRole = user?.role || "employee";
  const userDepartment = user?.department || "";

  const canViewRequest = (request: Request): boolean => {
    if (userRole === "super_admin") return true;
    if (userRole === "hr") return true;
    if ((userRole === "manager" || userRole === "spv")) {
      return request.department?.toLowerCase() === userDepartment?.toLowerCase();
    }
    return false;
  };

  const canApprove = (request: Request): boolean => {
    if (request.status !== "pending") return false;
    if (userRole === "super_admin") return true;

    if ((userRole === "manager" || userRole === "spv")) {
      const isSameDept = request.department?.toLowerCase() === userDepartment?.toLowerCase();
      const isStepZero = request.currentStep === 0;
      const spvNotApproved = request.flowSnapshot?.[0]?.status === 'waiting';
      return isSameDept && isStepZero && spvNotApproved;
    }

    if (userRole === "hr") {
      const spvApproved = request.currentStep >= 1;
      const hrNotApproved = request.currentStep < 2;
      const hrWaiting = request.flowSnapshot?.[1]?.status === 'waiting';
      return spvApproved && hrNotApproved && hrWaiting;
    }

    return false;
  };

  const getFilteredByRole = (requests: Request[]) => {
    if (userRole === "super_admin") return requests;
    if (userRole === "hr") {
      return [...requests].sort((a, b) => {
        if (a.currentStep >= 1 && b.currentStep < 1) return -1;
        if (a.currentStep < 1 && b.currentStep >= 1) return 1;
        return 0;
      });
    }
    if (userRole === "manager" || userRole === "spv") {
      return requests.filter(
        (req) => req.department?.toLowerCase() === userDepartment?.toLowerCase()
      );
    }
    return [];
  };

  const getFilteredByStatus = (requests: Request[]) => {
    if (filter === "ALL") return requests;
    return requests.filter((req) => req.status === filter);
  };

  const filteredByRole = getFilteredByRole(allData);
  const displayData = getFilteredByStatus(filteredByRole);
  
  const roleBasedPendingCount = filteredByRole.filter((r) => r.status === "pending").length;
  const approvedCount = filteredByRole.filter((r) => r.status === "approved").length;
  const rejectedCount = filteredByRole.filter((r) => r.status === "rejected").length;

  useEffect(() => {
    const q = query(collection(db, "attendance_requests"), orderBy("createdAt", "desc"), limit(200));
    
    const unsub = onSnapshot(q, (snap) => {
      const arr: Request[] = [];
      let newPending = 0;

      snap.forEach((doc) => {
        const data = doc.data();
        const requestData: Request = {
          id: doc.id,
          uid: data.uid || "",
          name: data.name || "",
          department: data.department || "",
          jabatan: data.jabatan || "",
          date: data.date,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          reason: data.reason || "",
          status: data.status || "pending",
          currentStep: data.currentStep || 0,
          flowSnapshot: data.flowSnapshot || [],
          createdAt: data.createdAt,
          approvedBy: data.approvedBy,
          approvedByName: data.approvedByName,
          approvedAt: data.approvedAt,
          rejectedBy: data.rejectedBy,
          rejectedByName: data.rejectedByName,
          rejectedAt: data.rejectedAt,
        };
        
        arr.push(requestData);
        
        if (data.status === "pending") {
          if (userRole === "super_admin") {
            newPending++;
          } else if (userRole === "hr") {
            if (data.currentStep >= 1) newPending++;
          } else if ((userRole === "manager" || userRole === "spv") && 
                     data.department?.toLowerCase() === userDepartment?.toLowerCase() &&
                     data.currentStep === 0) {
            newPending++;
          }
        }
      });
      
      setAllData(arr);
      
      // 🔥 GANTI: notifikasi menggunakan toast
      if (newPending > previousPendingCount && previousPendingCount !== 0) {
        const deptText = userRole === "spv" || userRole === "manager" 
          ? ` di departemen ${userDepartment}` 
          : "";
        toast.success(`📋 Ada ${newPending - previousPendingCount} request koreksi baru${deptText}!`, {
          duration: 5000,
        });
      }
      
      setPendingCount(newPending);
      setPreviousPendingCount(newPending);
    });

    return () => unsub();
  }, [userRole, userDepartment, previousPendingCount]);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    try {
      return ts.toDate().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const formatDateTime = (ts: any) => {
    if (!ts) return "-";
    try {
      return ts.toDate().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const approve = async (r: Request) => {
    if (!canApprove(r)) {
      toast.error("❌ Anda tidak memiliki akses untuk approve request ini");
      return;
    }

    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const userRole = user?.role || "employee";
      const updatedFlowSnapshot = [...r.flowSnapshot];

      // Super Admin bisa approve langsung ke semua departemen (langsung apply koreksi)
      if (userRole === "super_admin") {
        updatedFlowSnapshot[0] = {
          ...updatedFlowSnapshot[0],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };
        updatedFlowSnapshot[1] = {
          ...updatedFlowSnapshot[1],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        const dateObj = r.date.toDate();
        const yyyy = dateObj.getFullYear();
        const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const dd = dateObj.getDate().toString().padStart(2, "0");
        const docId = `${r.uid}_${yyyy}-${mm}-${dd}`;
        const attendanceRef = doc(db, "attendance", docId);
        const snap = await getDoc(attendanceRef);

        const updateData: any = {};

        if (r.checkIn) {
          const [h, m] = r.checkIn.split(":");
          updateData["checkIn.time"] = Timestamp.fromDate(new Date(yyyy, mm - 1, dd, parseInt(h), parseInt(m)));
        }
        if (r.checkOut) {
          const [h, m] = r.checkOut.split(":");
          updateData["checkOut.time"] = Timestamp.fromDate(new Date(yyyy, mm - 1, dd, parseInt(h), parseInt(m)));
        }

        if (!snap.exists()) {
          await setDoc(attendanceRef, {
            uid: r.uid,
            name: r.name,
            date: r.date,
            department: r.department,
            jabatan: r.jabatan,
            createdAt: Timestamp.now(),
          });
        }
        await updateDoc(attendanceRef, updateData);

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          status: "approved",
          currentStep: 2,
          approvedBy: user?.uid,
          approvedByName: user?.name,
          approvedAt: Timestamp.now(),
        });

        toast.success(`✅ Request dari ${r.name} telah disetujui oleh Super Admin`);
      } else if (userRole === "spv" || userRole === "manager") {
        updatedFlowSnapshot[0] = {
          ...updatedFlowSnapshot[0],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          currentStep: 1,
          status: "pending",
        });

        toast.success(`✅ Request dari ${r.name} telah disetujui oleh SPV, menunggu approval HR`);

      } else if (userRole === "hr") {
        updatedFlowSnapshot[1] = {
          ...updatedFlowSnapshot[1],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        const dateObj = r.date.toDate();
        const yyyy = dateObj.getFullYear();
        const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const dd = dateObj.getDate().toString().padStart(2, "0");
        const docId = `${r.uid}_${yyyy}-${mm}-${dd}`;
        const attendanceRef = doc(db, "attendance", docId);
        const snap = await getDoc(attendanceRef);

        const updateData: any = {};

        if (r.checkIn) {
          const [h, m] = r.checkIn.split(":");
          updateData["checkIn.time"] = Timestamp.fromDate(new Date(yyyy, mm - 1, dd, parseInt(h), parseInt(m)));
        }
        if (r.checkOut) {
          const [h, m] = r.checkOut.split(":");
          updateData["checkOut.time"] = Timestamp.fromDate(new Date(yyyy, mm - 1, dd, parseInt(h), parseInt(m)));
        }

        if (!snap.exists()) {
          await setDoc(attendanceRef, {
            uid: r.uid,
            name: r.name,
            date: r.date,
            department: r.department,
            jabatan: r.jabatan,
            createdAt: Timestamp.now(),
          });
        }
        await updateDoc(attendanceRef, updateData);

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          status: "approved",
          currentStep: 2,
          approvedBy: user?.uid,
          approvedByName: user?.name,
          approvedAt: Timestamp.now(),
        });

        toast.success(`✅ Request dari ${r.name} telah disetujui oleh HRD`);
      }

    } catch (e) {
      toast.error(`❌ Gagal approve request: ${e}`);
    } finally {
      setLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  };

  const reject = async (r: Request) => {
    if (!canApprove(r)) {
      toast.error("❌ Anda tidak memiliki akses untuk reject request ini");
      return;
    }

    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const userRole = user?.role || "employee";
      const updatedFlowSnapshot = [...r.flowSnapshot];

      if (userRole === "super_admin") {
        updatedFlowSnapshot[0] = {
          ...updatedFlowSnapshot[0],
          status: "rejected",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };
        updatedFlowSnapshot[1] = {
          ...updatedFlowSnapshot[1],
          status: "rejected",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          status: "rejected",
          rejectedBy: user?.uid,
          rejectedByName: user?.name,
          rejectedAt: Timestamp.now(),
        });

        toast.error(`❌ Request dari ${r.name} ditolak oleh Super Admin`);
      } else if (userRole === "spv" || userRole === "manager") {
        updatedFlowSnapshot[0] = {
          ...updatedFlowSnapshot[0],
          status: "rejected",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          status: "rejected",
          rejectedBy: user?.uid,
          rejectedByName: user?.name,
          rejectedAt: Timestamp.now(),
        });

        toast.error(`❌ Request dari ${r.name} ditolak oleh SPV`);

      } else if (userRole === "hr") {
        updatedFlowSnapshot[1] = {
          ...updatedFlowSnapshot[1],
          status: "rejected",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };

        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          status: "rejected",
          rejectedBy: user?.uid,
          rejectedByName: user?.name,
          rejectedAt: Timestamp.now(),
        });

        toast.error(`❌ Request dari ${r.name} ditolak oleh HRD`);
      }

    } catch (e) {
      toast.error(`❌ Gagal reject request: ${e}`);
    } finally {
      setLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const getStepText = (request: Request) => {
    if (request.status === "approved") return "✅ Selesai";
    if (request.status === "rejected") return "❌ Ditolak";
    if (request.currentStep === 0 && request.flowSnapshot?.[0]?.status === 'waiting') return "⏳ Menunggu Approval";
    if (request.currentStep === 0) return "⏳ Menunggu HRD";
    if (request.currentStep === 1) return "⏳ Menunggu HRD";
    return "📋 Proses";
  };

  const getStepColor = (request: Request) => {
    if (request.status === "approved") return "text-green-600";
    if (request.status === "rejected") return "text-red-600";
    if (request.currentStep === 0 && request.flowSnapshot?.[0]?.status === 'waiting') return "text-purple-600";
    if (request.currentStep === 0) return "text-blue-600";
    if (request.currentStep === 1) return "text-blue-600";
    return "text-gray-600";
  };

  const hasAccess = userRole === "super_admin" || userRole === "hr" || userRole === "manager" || userRole === "spv";

  if (!hasAccess) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
          <p className="text-slate-500">Anda tidak memiliki hak akses ke halaman Koreksi Kehadiran.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredFeature="manage_attendance">
      <div className="space-y-6 pb-20">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Menunggu</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{roleBasedPendingCount}</h3>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100/50">
                  {userRole === "hr" ? "Review HR" : userRole === "spv" ? "Review SPV" : "Tindakan"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Disetujui</p>
              <h3 className="text-2xl font-bold text-slate-800">{approvedCount}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
              <XCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ditolak</p>
              <h3 className="text-2xl font-bold text-slate-800">{rejectedCount}</h3>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["ALL", "pending", "approved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-xl whitespace-nowrap border ${
                filter === tab
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {tab === "ALL" ? "Semua Request" : tab === "pending" ? "Menunggu" : tab === "approved" ? "Disetujui" : "Ditolak"}
              {tab === "pending" && roleBasedPendingCount > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-lg ${
                  filter === tab ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}>
                  {roleBasedPendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Karyawan</th>
                  <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Waktu & Shift</th>
                  <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Alasan Koreksi</th>
                  <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Status Approval</th>
                  <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayData.map((r) => {
                  const canAction = canApprove(r);
                  const stepText = getStepText(r);
                  const stepColor = getStepColor(r);
                  
                  return (
                    <tr 
                      key={r.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{r.name}</span>
                          <span className="text-xs font-medium text-slate-500 mt-0.5">{r.jabatan || "-"} • {r.department || "-"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{formatDate(r.date)}</span>
                          <span className="text-xs font-mono font-medium text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded-md inline-block w-fit border border-slate-200">
                            {r.checkIn ?? "--:--"} → {r.checkOut ?? "--:--"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs text-slate-600 text-sm leading-relaxed" title={r.reason}>
                          {r.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wide ${
                            r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            r.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                            "bg-amber-50 text-amber-700 border-amber-100"
                          }`}>
                            {stepText}
                          </span>
                          
                          {r.status === "pending" && (
                            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {r.currentStep === 0 ? "Review SPV" : "Review HR"}
                            </span>
                          )}
                          
                          {r.status === "approved" && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Oleh: {r.approvedByName}
                            </span>
                          )}
                          
                          {r.status === "rejected" && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Oleh: {r.rejectedByName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {r.status === "pending" && canAction ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => approve(r)}
                              disabled={loading[r.id]}
                              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {loading[r.id] ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Setujui
                            </button>
                            <button
                              onClick={() => reject(r)}
                              disabled={loading[r.id]}
                              className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {loading[r.id] ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              Tolak
                            </button>
                          </div>
                        ) : r.status === "pending" && !canAction ? (
                          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            Menunggu Hak Akses
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {displayData.length === 0 && (
              <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                  <Inbox className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-bold text-slate-700 mb-1">Tidak ada request koreksi</p>
                <p className="text-sm text-slate-500">
                  {userRole === "hr" ? "Semua request sudah direview." : 
                   (userRole === "spv" || userRole === "manager") ? `Belum ada request dari departemen ${userDepartment}.` : 
                   "Belum ada data koreksi absensi yang masuk."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}