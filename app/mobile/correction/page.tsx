// app/mobile/correction/page.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export default function MobileCorrectionPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!checkIn || !checkOut || !reason) {
      alert("Semua field harus diisi!");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "attendance_requests"), {
        uid: user?.uid,
        name: user?.name,
        department: user?.department || "",
        jabatan: user?.jabatan || "",
        date: Timestamp.fromDate(new Date(selectedDate)),
        checkIn: checkIn,
        checkOut: checkOut,
        reason: reason,
        status: "pending",
        createdAt: Timestamp.now(),
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

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5">
        <div className="mb-4">
          <label className="block text-gray-600 text-sm mb-1">Tanggal</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 text-sm mb-1">Jam Masuk</label>
          <input
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 text-sm mb-1">Jam Pulang</label>
          <input
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

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

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? "Mengirim..." : "Kirim Pengajuan"}
        </button>
      </div>

      <div className="bg-white/10 rounded-2xl p-4">
        <p className="text-white/70 text-xs text-center">
          Pengajuan koreksi akan diproses oleh SPV/HRD Anda
        </p>
      </div>
    </div>
  );
}