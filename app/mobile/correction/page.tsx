// app/mobile/correction/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore";

export default function MobileCorrectionPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load user data dan existing attendance
  useEffect(() => {
    if (user) {
      loadUserData();
      loadExistingAttendance();
    }
  }, [user, selectedDate]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
      if (!userDoc.empty) {
        setUserData(userDoc.docs[0].data());
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const loadExistingAttendance = async () => {
    if (!user) return;
    setIsLoadingData(true);
    setDateError(null);
    
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateTime = new Date(selectedDate);
      selectedDateTime.setHours(0, 0, 0, 0);
      
      // Cek tanggal tidak boleh lebih dari hari ini
      if (selectedDateTime > today) {
        setDateError("Tidak bisa mengajukan koreksi untuk tanggal yang akan datang");
        setIsLoadingData(false);
        return;
      }
      
      // Cek apakah sudah ada pengajuan pending
      const pendingQuery = query(
        collection(db, "attendance_requests"),
        where("uid", "==", user.uid),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay)),
        where("status", "==", "pending")
      );
      const pendingSnap = await getDocs(pendingQuery);
      
      if (!pendingSnap.empty) {
        setDateError("Anda sudah memiliki pengajuan koreksi untuk tanggal ini yang masih pending");
        setIsLoadingData(false);
        return;
      }
      
      // Cek apakah sudah ada yang approved
      const approvedQuery = query(
        collection(db, "attendance_requests"),
        where("uid", "==", user.uid),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay)),
        where("status", "==", "approved")
      );
      const approvedSnap = await getDocs(approvedQuery);
      
      if (!approvedSnap.empty) {
        setDateError("Pengajuan koreksi untuk tanggal ini sudah disetujui");
        setIsLoadingData(false);
        return;
      }
      
      // Ambil data absensi yang ada
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay))
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      
      if (!attendanceSnap.empty) {
        const data = attendanceSnap.docs[0].data();
        setExistingAttendance(data);
        
        // Auto-fill jam yang sudah ada
        if (data.checkIn?.time) {
          const checkInDate = data.checkIn.time.toDate();
          setCheckIn(`${checkInDate.getHours().toString().padStart(2, '0')}:${checkInDate.getMinutes().toString().padStart(2, '0')}`);
        }
        if (data.checkOut?.time) {
          const checkOutDate = data.checkOut.time.toDate();
          setCheckOut(`${checkOutDate.getHours().toString().padStart(2, '0')}:${checkOutDate.getMinutes().toString().padStart(2, '0')}`);
        }
      } else {
        setDateError("Tidak ditemukan data absensi untuk tanggal ini");
      }
      
    } catch (error) {
      console.error("Error loading attendance:", error);
      setDateError("Gagal memuat data: " + error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const validateTimeOrder = (inTime: string, outTime: string): boolean => {
    if (!inTime || !outTime) return true;
    const [inHour, inMin] = inTime.split(":").map(Number);
    const [outHour, outMin] = outTime.split(":").map(Number);
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    return outMinutes > inMinutes;
  };

  const handleSubmit = async () => {
    if (dateError) {
      alert(dateError);
      return;
    }
    
    if (!checkIn || !checkOut) {
      alert("Jam masuk dan jam pulang harus dipilih");
      return;
    }
    
    if (!validateTimeOrder(checkIn, checkOut)) {
      alert("Jam pulang harus lebih dari jam masuk");
      return;
    }
    
    if (!reason) {
      alert("Alasan koreksi harus diisi");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "attendance_requests"), {
        uid: user?.uid,
        name: user?.name,
        department: user?.department || userData?.department || "",
        jabatan: user?.jabatan || userData?.jabatan || "",
        date: Timestamp.fromDate(new Date(selectedDate)),
        checkIn: checkIn,
        checkOut: checkOut,
        reason: reason,
        status: "pending",
        createdAt: Timestamp.now(),
        oldCheckIn: existingAttendance?.checkIn?.time 
          ? new Date(existingAttendance.checkIn.time.toDate()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : null,
        oldCheckOut: existingAttendance?.checkOut?.time 
          ? new Date(existingAttendance.checkOut.time.toDate()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : null,
        currentStep: 0,
        flowSnapshot: [
          { role: "spv", status: "waiting" },
          { role: "hrd", status: "waiting" },
        ],
      });

      alert("✅ Pengajuan koreksi berhasil dikirim!");
      setCheckIn("");
      setCheckOut("");
      setReason("");
    } catch (error: any) {
      alert("❌ Gagal: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDepartmentName = (deptCode: string) => {
    const departments: Record<string, string> = {
      hrd: "HRD",
      it: "IT",
      finance: "Finance",
      marketing: "Marketing",
      operations: "Operations",
      sales: "Sales",
      customer_service: "Customer Service",
      wildlife: "Wildlife",
    };
    return departments[deptCode?.toLowerCase()] || deptCode || "-";
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="w-1 h-8 bg-green-500 rounded-full"></div>
          <div>
            <div className="text-xs text-green-600 font-semibold">AVIARYPARK INDONESIA</div>
            <div className="text-sm text-gray-500">Form Koreksi Absensi</div>
          </div>
        </div>
        
        {/* User Info Card */}
        {userData && (
          <div className="mb-5 p-3 bg-gray-50 rounded-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{user?.name}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                  {getDepartmentName(user?.department)}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {user?.jabatan || "-"}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Date Picker */}
        <div className="mb-4">
          <label className="block text-gray-600 text-sm mb-1">Tanggal</label>
          <div className={`border rounded-xl p-3 flex items-center gap-2 ${dateError ? "border-red-500" : "border-gray-200"}`}>
            <span className="text-green-500">📅</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 outline-none bg-transparent"
            />
          </div>
          {dateError && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <span>⚠️</span> {dateError}
            </p>
          )}
        </div>
        
        {/* Info existing attendance */}
        {existingAttendance && !dateError && (
          <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-200">
            <p className="text-orange-600 text-xs flex items-center gap-1">
              <span>ℹ️</span> Data absensi yang ada akan otomatis terisi. Silakan perbaiki jika diperlukan.
            </p>
          </div>
        )}
        
        {/* Loading state */}
        {isLoadingData ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          !dateError && (
            <>
              {/* Check-in Time */}
              <div className="mb-4">
                <label className="block text-gray-600 text-sm mb-1">Jam Masuk</label>
                <div className="border border-gray-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-green-500">⏰</span>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="flex-1 outline-none bg-transparent"
                  />
                </div>
              </div>
              
              {/* Check-out Time */}
              <div className="mb-4">
                <label className="block text-gray-600 text-sm mb-1">Jam Pulang</label>
                <div className="border border-gray-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-green-500">⏰</span>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="flex-1 outline-none bg-transparent"
                  />
                </div>
              </div>
              
              {/* Reason */}
              <div className="mb-6">
                <label className="block text-gray-600 text-sm mb-1">Alasan Koreksi</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Jelaskan alasan koreksi..."
                />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengirim...</span>
                  </div>
                ) : (
                  "KIRIM PENGAJUAN"
                )}
              </button>
            </>
          )
        )}
      </div>

      <div className="bg-white/10 rounded-2xl p-4">
        <p className="text-white/70 text-xs text-center">
          Pengajuan koreksi akan diproses oleh Supervisor dan HRD
        </p>
      </div>
    </div>
  );
}