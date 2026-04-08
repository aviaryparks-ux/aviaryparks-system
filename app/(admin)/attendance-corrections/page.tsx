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
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useNotification } from "@/components/ToastNotification";
import { useAuth } from "@/contexts/AuthContext";

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
  const { showNotification } = useNotification();
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
    const q = query(collection(db, "attendance_requests"), orderBy("createdAt", "desc"));
    
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
      
      if (newPending > previousPendingCount && previousPendingCount !== 0) {
        const deptText = userRole === "spv" || userRole === "manager" 
          ? ` di departemen ${userDepartment}` 
          : "";
        showNotification(
          `📋 Ada ${newPending - previousPendingCount} request koreksi baru${deptText}!`,
          "info"
        );
      }
      
      setPendingCount(newPending);
      setPreviousPendingCount(newPending);
    });

    return () => unsub();
  }, [userRole, userDepartment, previousPendingCount, showNotification]);

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
      showNotification("❌ Anda tidak memiliki akses untuk approve request ini", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const userRole = user?.role || "employee";
      const updatedFlowSnapshot = [...r.flowSnapshot];
      
      if (userRole === "spv" || userRole === "manager") {
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
        
        showNotification(`✅ Request dari ${r.name} telah disetujui oleh SPV, menunggu approval HR`, "success");
        
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
        
        showNotification(`✅ Request dari ${r.name} telah disetujui oleh HRD`, "success");
      }
      
    } catch (e) {
      showNotification(`❌ Gagal approve request: ${e}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  };

  const reject = async (r: Request) => {
    if (!canApprove(r)) {
      showNotification("❌ Anda tidak memiliki akses untuk reject request ini", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const userRole = user?.role || "employee";
      const updatedFlowSnapshot = [...r.flowSnapshot];
      
      if (userRole === "spv" || userRole === "manager") {
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
        
        showNotification(`❌ Request dari ${r.name} ditolak oleh SPV`, "warning");
        
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
        
        showNotification(`❌ Request dari ${r.name} ditolak oleh HRD`, "warning");
      }
      
    } catch (e) {
      showNotification(`❌ Gagal reject request: ${e}`, "error");
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
    if (request.currentStep === 0) return "⏳ Menunggu SPV";
    if (request.currentStep === 1) return "⏳ Menunggu HRD";
    return "📋 Proses";
  };

  const getStepColor = (request: Request) => {
    if (request.status === "approved") return "text-green-600";
    if (request.status === "rejected") return "text-red-600";
    if (request.currentStep === 0) return "text-yellow-600";
    if (request.currentStep === 1) return "text-blue-600";
    return "text-gray-600";
  };

  const hasAccess = userRole === "super_admin" || userRole === "hr" || userRole === "manager" || userRole === "spv";

  if (!hasAccess) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Akses Ditolak</h2>
          <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr", "manager", "spv"]}>
      <div className="space-y-6 p-6">
        {/* Header dengan Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold">Koreksi Absensi</h1>
            <p className="text-green-100 mt-1">
              Kelola dan review request koreksi absensi karyawan
              {userRole === "spv" || userRole === "manager" ? (
                <span className="block text-sm text-green-200 mt-1">
                  📍 Hanya menampilkan request dari departemen: <strong>{userDepartment}</strong>
                </span>
              ) : userRole === "hr" ? (
                <span className="block text-sm text-green-200 mt-1">
                  📍 Menampilkan semua request dari semua departemen
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-yellow-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">
                  Pending
                  {userRole === "hr" && <span className="block text-xs text-yellow-500">(menunggu HR)</span>}
                  {userRole === "spv" && <span className="block text-xs text-yellow-500">(menunggu SPV)</span>}
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{roleBasedPendingCount}</p>
              </div>
              <div className="rounded-xl bg-yellow-100 p-3">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Approved</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{approvedCount}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-red-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Rejected</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{rejectedCount}</p>
              </div>
              <div className="rounded-xl bg-red-100 p-3">
                <span className="text-2xl">❌</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="rounded-xl bg-white p-2 shadow-md border border-gray-100">
          <div className="flex gap-1 overflow-x-auto">
            {["ALL", "pending", "approved", "rejected"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-5 py-2 text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
                  filter === tab
                    ? "bg-green-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab === "ALL" ? "Semua" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "pending" && roleBasedPendingCount > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    filter === tab ? "bg-white text-green-600" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {roleBasedPendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Karyawan</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Dept</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Jabatan</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Jam</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Alasan</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((r, idx) => {
                  const canAction = canApprove(r);
                  const stepText = getStepText(r);
                  const stepColor = getStepColor(r);
                  
                  return (
                    <tr 
                      key={r.id} 
                      className={`border-b transition-all duration-150 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-green-50`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.department?.toLowerCase() === "wildlife" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {r.department || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.jabatan || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-700">{r.checkIn ?? "--"} - {r.checkOut ?? "--"}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-gray-600" title={r.reason}>
                          {r.reason.length > 60 ? `${r.reason.substring(0, 60)}...` : r.reason}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-medium ${stepColor}`}>
                            {stepText}
                          </span>
                          {r.currentStep === 0 && r.status === "pending" && (
                            <span className="text-[10px] text-yellow-500">Menunggu SPV</span>
                          )}
                          {r.currentStep === 1 && r.status === "pending" && (
                            <span className="text-[10px] text-blue-500">SPV ✓, menunggu HR</span>
                          )}
                          {r.status === "approved" && (
                            <span className="text-[10px] text-green-500">
                              Oleh: {r.approvedByName} • {formatDateTime(r.approvedAt)}
                            </span>
                          )}
                          {r.status === "rejected" && (
                            <span className="text-[10px] text-red-500">
                              Oleh: {r.rejectedByName} • {formatDateTime(r.rejectedAt)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "pending" && canAction ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approve(r)}
                              disabled={loading[r.id]}
                              className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-all duration-200 ${
                                loading[r.id] 
                                  ? "bg-gray-400 cursor-not-allowed" 
                                  : "bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg"
                              }`}
                            >
                              {loading[r.id] ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </button>
                            <button
                              onClick={() => reject(r)}
                              disabled={loading[r.id]}
                              className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-all duration-200 ${
                                loading[r.id] 
                                  ? "bg-gray-400 cursor-not-allowed" 
                                  : "bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg"
                              }`}
                            >
                              {loading[r.id] ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "Reject"
                              )}
                            </button>
                          </div>
                        ) : r.status === "pending" && !canAction ? (
                          <span className="text-xs text-gray-400 italic">
                            {userRole === "hr" ? "Menunggu SPV" : 
                             userRole === "spv" ? "Menunggu approval" : "Tidak ada akses"}
                          </span>
                        ) : r.status === "approved" ? (
                          <span className="text-xs text-green-600 font-medium">✓ Disetujui</span>
                        ) : r.status === "rejected" ? (
                          <span className="text-xs text-red-600 font-medium">✗ Ditolak</span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayData.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-lg font-medium">Tidak ada request koreksi</p>
                {userRole === "hr" && (
                  <p className="text-sm mt-1">Tidak ada request yang menunggu approval HR</p>
                )}
                {(userRole === "spv" || userRole === "manager") && (
                  <p className="text-sm mt-1">Belum ada request koreksi dari departemen {userDepartment}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}