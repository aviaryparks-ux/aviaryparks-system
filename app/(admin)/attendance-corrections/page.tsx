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

type Request = {
  id: string;
  uid: string;
  name: string;
  date: any;
  checkIn?: string;
  checkOut?: string;
  reason: string;
  status: string;
};

export default function AttendanceCorrectionsPage() {
  const [data, setData] = useState<Request[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [filter, setFilter] = useState("ALL"); // ALL, pending, approved, rejected

  useEffect(() => {
    const q = query(collection(db, "attendance_requests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() });
      });
      setData(arr);
    });
    return () => unsub();
  }, []);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    return ts.toDate().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const approve = async (r: Request) => {
    setLoading((prev) => ({ ...prev, [r.id]: true }));
    try {
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
          createdAt: Timestamp.now(),
        });
      }
      await updateDoc(attendanceRef, updateData);
      await updateDoc(doc(db, "attendance_requests", r.id), { status: "approved" });
      alert("✅ Request approved");
    } catch (e) {
      alert("❌ Error: " + e);
    } finally {
      setLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  };

  const reject = async (id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await updateDoc(doc(db, "attendance_requests", id), { status: "rejected" });
      alert("✅ Request rejected");
    } catch (e) {
      alert("❌ Error: " + e);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const filteredData = data.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === filter;
  });

  const pendingCount = data.filter((r) => r.status === "pending").length;
  const approvedCount = data.filter((r) => r.status === "approved").length;
  const rejectedCount = data.filter((r) => r.status === "rejected").length;

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

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Attendance Corrections
          </h1>
          <p className="text-gray-500 mt-1">Manage and review employee attendance correction requests</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-800">{pendingCount}</p>
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
        <div className="flex gap-2 border-b border-gray-200">
          {["ALL", "pending", "approved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === tab
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Jam</th>
                  <th className="px-4 py-3 text-left">Alasan</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((r, idx) => (
                  <tr key={r.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
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
                            onClick={() => reject(r.id)}
                            disabled={loading[r.id]}
                            className={`px-3 py-1.5 rounded-lg text-white text-sm transition-colors ${
                              loading[r.id] ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {loading[r.id] ? "..." : "Reject"}
                          </button>
                        </div>
                      )}
                      {r.status !== "pending" && <span className="text-gray-400 text-sm">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-lg font-medium">No correction requests</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}