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
  where,
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

  // Get user role and department
  const userRole = user?.role || "employee";
  const userDepartment = user?.department || "";

  // 🔥 CEK APAKAH USER BISA MELIHAT REQUEST INI
  const canViewRequest = (request: Request): boolean => {
    // Super Admin bisa melihat semua
    if (userRole === "super_admin") return true;
    
    // HR bisa melihat request yang sudah di-approve SPV (currentStep >= 1)
    // DAN request yang masih pending (belum di-approve SPV) juga bisa dilihat untuk monitoring
    if (userRole === "hr") {
      // HR bisa melihat semua request dari semua departemen
      // Tapi hanya bisa approve yang sudah di-approve SPV
      return true;
    }
    
    // Manager/SPV hanya melihat request dari departemennya
    if (userRole === "manager" || userRole === "spv") {
      return request.department?.toLowerCase() === userDepartment?.toLowerCase();
    }
    
    return false;
  };

  // 🔥 CEK APAKAH USER BISA APPROVE/REJECT REQUEST INI
  const canApprove = (request: Request): boolean => {
    // Hanya request dengan status pending yang bisa diapprove
    if (request.status !== "pending") return false;

    // Super Admin bisa approve semua
    if (userRole === "super_admin") return true;

    // SPV/Manager: hanya bisa approve request yang currentStep = 0 (belum di-approve siapa pun)
    // DAN dari departemennya sendiri
    if ((userRole === "manager" || userRole === "spv")) {
      // Cek apakah dari departemen yang sama
      const isSameDept = request.department?.toLowerCase() === userDepartment?.toLowerCase();
      // Cek apakah masih step 0 (belum di-approve SPV)
      const isStepZero = request.currentStep === 0;
      // Cek apakah SPV belum approve (flowSnapshot[0].status === 'waiting')
      const spvNotApproved = request.flowSnapshot?.[0]?.status === 'waiting';
      
      return isSameDept && isStepZero && spvNotApproved;
    }

    // HR: hanya bisa approve request yang sudah di-approve SPV (currentStep >= 1)
    // DAN belum di-approve HR (currentStep < 2)
    if (userRole === "hr") {
      // Cek apakah SPV sudah approve (currentStep >= 1)
      const spvApproved = request.currentStep >= 1;
      // Cek apakah HR belum approve (currentStep < 2)
      const hrNotApproved = request.currentStep < 2;
      // Cek apakah flowSnapshot HR masih waiting
      const hrWaiting = request.flowSnapshot?.[1]?.status === 'waiting';
      
      return spvApproved && hrNotApproved && hrWaiting;
    }

    return false;
  };

  // Filter data berdasarkan role user
  const getFilteredByRole = (requests: Request[]) => {
    if (userRole === "super_admin") {
      return requests;
    } else if (userRole === "hr") {
      // HR melihat semua request, tapi sorting berdasarkan currentStep
      // Urutkan: yang sudah di-approve SPV (currentStep >= 1) lebih dulu
      return [...requests].sort((a, b) => {
        // Prioritas: yang sudah di-approve SPV (currentStep >= 1) lebih dulu
        if (a.currentStep >= 1 && b.currentStep < 1) return -1;
        if (a.currentStep < 1 && b.currentStep >= 1) return 1;
        return 0;
      });
    } else if (userRole === "manager" || userRole === "spv") {
      return requests.filter(
        (req) => req.department?.toLowerCase() === userDepartment?.toLowerCase()
      );
    }
    return [];
  };

  // Filter data berdasarkan tab status
  const getFilteredByStatus = (requests: Request[]) => {
    if (filter === "ALL") return requests;
    return requests.filter((req) => req.status === filter);
  };

  // Data final yang ditampilkan
  const filteredByRole = getFilteredByRole(allData);
  const displayData = getFilteredByStatus(filteredByRole);
  
  // Hitung pending count berdasarkan role
  const roleBasedPendingCount = filteredByRole.filter((r) => r.status === "pending").length;
  const approvedCount = filteredByRole.filter((r) => r.status === "approved").length;
  const rejectedCount = filteredByRole.filter((r) => r.status === "rejected").length;

  // Real-time listener untuk attendance requests
  useEffect(() => {
    // Query semua request
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
        
        // Hitung pending berdasarkan role user
        if (data.status === "pending") {
          if (userRole === "super_admin") {
            newPending++;
          } else if (userRole === "hr") {
            // HR: hanya hitung yang sudah di-approve SPV
            if (data.currentStep >= 1) {
              newPending++;
            }
          } else if ((userRole === "manager" || userRole === "spv") && 
                     data.department?.toLowerCase() === userDepartment?.toLowerCase() &&
                     data.currentStep === 0) {
            // SPV: hanya hitung yang belum di-approve
            newPending++;
          }
        }
      });
      
      setAllData(arr);
      
      // Notifikasi untuk request baru
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

  // 🔥 APPROVE FUNCTION dengan step yang benar
  const approve = async (r: Request) => {
    if (!canApprove(r)) {
      showNotification("❌ Anda tidak memiliki akses untuk approve request ini", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
      const userRole = user?.role || "employee";
      const currentStep = r.currentStep;
      const updatedFlowSnapshot = [...r.flowSnapshot];
      
      // Determine which step is being approved
      if (userRole === "spv" || userRole === "manager") {
        // SPV approve step 0
        updatedFlowSnapshot[0] = {
          ...updatedFlowSnapshot[0],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };
        
        // Update ke step 1 (menunggu HR)
        await updateDoc(doc(db, "attendance_requests", r.id), {
          flowSnapshot: updatedFlowSnapshot,
          currentStep: 1,
          // Status masih pending karena belum di-approve HR
          status: "pending",
        });
        
        showNotification(`✅ Request dari ${r.name} telah disetujui oleh SPV, menunggu approval HR`, "success");
        
      } else if (userRole === "hr") {
        // HR approve step 1
        updatedFlowSnapshot[1] = {
          ...updatedFlowSnapshot[1],
          status: "approved",
          by: user?.uid,
          byName: user?.name,
          at: Timestamp.now(),
        };
        
        // Update data absensi
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
        
        // Update final status
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

  // 🔥 REJECT FUNCTION
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
        // SPV reject step 0
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
        // HR reject step 1
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

  // 🔥 GET STEP TEXT untuk ditampilkan
  const getStepText = (request: Request) => {
    if (request.status === "approved") return "Selesai";
    if (request.status === "rejected") return "Ditolak";
    
    if (request.currentStep === 0) return "Menunggu SPV";
    if (request.currentStep === 1) return "Menunggu HRD";
    return "Proses";
  };

  const getStepColor = (request: Request) => {
    if (request.status === "approved") return "text-green-600";
    if (request.status === "rejected") return "text-red-600";
    
    if (request.currentStep === 0) return "text-yellow-600";
    if (request.currentStep === 1) return "text-blue-600";
    return "text-gray-600";
  };

  // Cek apakah user memiliki akses ke halaman ini
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Attendance Corrections
          </h1>
          <p className="text-gray-500 mt-1">
            Manage and review employee attendance correction requests
            {userRole === "spv" || userRole === "manager" ? (
              <span className="block text-sm text-yellow-600 mt-1">
                📍 Hanya menampilkan request dari departemen: <strong>{userDepartment}</strong>
                <br />✓ Anda dapat approve request yang belum di-approve siapa pun
              </span>
            ) : userRole === "hr" ? (
              <span className="block text-sm text-blue-600 mt-1">
                📍 Menampilkan semua request dari semua departemen
                <br />✓ Anda hanya dapat approve request yang sudah di-approve SPV
              </span>
            ) : userRole === "super_admin" ? (
              <span className="block text-sm text-purple-600 mt-1">
                📍 Full Access - Semua departemen, semua step
              </span>
            ) : null}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-yellow-600">
                  Pending
                  {userRole === "hr" && <span className="block text-xs">(menunggu approval HR)</span>}
                  {userRole === "spv" && <span className="block text-xs">(menunggu approval SPV)</span>}
                </p>
                <p className="text-2xl font-bold text-yellow-800">{roleBasedPendingCount}</p>
              </div>
              <span className="text-3xl">⏳</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Approved</p>
                <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
              </div>
              <span className="text-3xl">✓</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-red-600">Rejected</p>
                <p className="text-2xl font-bold text-red-800">{rejectedCount}</p>
              </div>
              <span className="text-3xl">✗</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-1">
          {["ALL", "pending", "approved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "pending" && roleBasedPendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {roleBasedPendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Dept</th>
                  <th className="px-4 py-3 text-left">Jabatan</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Jam</th>
                  <th className="px-4 py-3 text-left">Alasan</th>
                  <th className="px-4 py-3 text-left">Step</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((r, idx) => {
                  const canAction = canApprove(r);
                  const stepText = getStepText(r);
                  const stepColor = getStepColor(r);
                  
                  return (
                    <tr key={r.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.department?.toLowerCase() === "wildlife" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {r.department || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.jabatan || "-"}</td>
                      <td className="px-4 py-3">{formatDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono">{r.checkIn ?? "--"} - {r.checkOut ?? "--"}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate" title={r.reason}>
                          {r.reason.length > 60 ? `${r.reason.substring(0, 60)}...` : r.reason}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${stepColor}`}>
                          {stepText}
                        </span>
                        {/* Tooltip untuk info lebih detail */}
                        <div className="text-xs text-gray-400 mt-1">
                          {r.currentStep === 0 && "Menunggu SPV"}
                          {r.currentStep === 1 && "SPV ✓, menunggu HR"}
                          {r.currentStep === 2 && "Selesai"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "pending" && canAction ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approve(r)}
                              disabled={loading[r.id]}
                              className={`px-3 py-1.5 rounded-lg text-white text-sm transition-colors ${
                                loading[r.id] ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {loading[r.id] ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => reject(r)}
                              disabled={loading[r.id]}
                              className={`px-3 py-1.5 rounded-lg text-white text-sm transition-colors ${
                                loading[r.id] ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
                              }`}
                            >
                              {loading[r.id] ? "..." : "Reject"}
                            </button>
                          </div>
                        ) : r.status === "pending" && !canAction ? (
                          <span className="text-xs text-gray-400 italic">
                            {userRole === "hr" ? "Menunggu approval SPV" : "Tidak ada akses"}
                          </span>
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
                <p className="text-lg font-medium">No correction requests</p>
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