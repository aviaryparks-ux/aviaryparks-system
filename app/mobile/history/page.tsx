// app/mobile/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

export default function MobileHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "--:--";
    const date = timestamp.toDate();
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-10">
        <span className="text-5xl mb-4 block">📭</span>
        <p className="text-white/70">Belum ada riwayat absensi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item, idx) => (
        <div key={idx} className="bg-white rounded-2xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-bold text-gray-800">{formatDate(item.date)}</p>
              <p className="text-xs text-gray-400">
                {item.date?.toDate?.()?.toLocaleDateString("id-ID", { weekday: "long" })}
              </p>
            </div>
            {item.workHours && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {item.workHours}
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-gray-500">Check-in</p>
              <p className="font-medium text-gray-700">{formatTime(item.checkIn?.time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Check-out</p>
              <p className="font-medium text-gray-700">{formatTime(item.checkOut?.time)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}