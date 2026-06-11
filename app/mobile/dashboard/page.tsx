"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import Link from "next/link";
import { Bell, Calendar, Clock, FileText, CheckCircle, Clock3, AlertCircle, Megaphone } from "lucide-react";

export default function MobileDashboard() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [announcementCount, setAnnouncementCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadTodayAttendance();
      loadWorkOrders();
      loadHistory();
      loadAnnouncements();
    }
  }, [user]);

  const loadAnnouncements = async () => {
    try {
      const q = query(
        collection(db, "articles"),
        where("isActive", "==", true),
        limit(10)
      );
      const snap = await getDocs(q);
      setAnnouncementCount(snap.size);
    } catch (e) {
      console.error(e);
    }
  };

  const loadUserData = async () => {
    const userDoc = await getDoc(doc(db, "users", user!.uid));
    if (userDoc.exists()) setUserData(userDoc.data());
  };

  const loadTodayAttendance = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const docId = `${user!.uid}_${today}`;
    const snap = await getDoc(doc(db, "attendance", docId));
    if (snap.exists()) setTodayAttendance(snap.data());
  };

  const loadWorkOrders = async () => {
    // 1. Fetch user data to get division
    const userDoc = await getDoc(doc(db, "users", user!.uid));
    const uData = userDoc.exists() ? userDoc.data() : null;
    
    let q;
    if (uData?.division) {
      // Fetch WO assigned to their division
      q = query(collection(db, "work_orders"), where("assignedToDivision", "==", uData.division), limit(20));
    } else {
      // Fallback: fetch all if no division is found (or maybe empty array)
      q = query(collection(db, "work_orders"), limit(20));
    }

    const snap = await getDocs(q);
    
    // Sort in memory and take top 5
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
    setWorkOrders(data.slice(0, 5));
  };

  const loadHistory = async () => {
    const q = query(
      collection(db, "attendance"),
      where("uid", "==", user!.uid),
      limit(20)
    );
    const snap = await getDocs(q);
    
    // Sort in memory and take top 5
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => (b.date?.toDate()?.getTime() || 0) - (a.date?.toDate()?.getTime() || 0));
    setRecentHistory(data.slice(0, 5));
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "--:--";
    return timestamp.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const firstName = userData?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  return (
    <div className="space-y-6 pb-6">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Selamat pagi, {firstName}! <span className="text-xl">🌿</span>
          </h2>
          <p className="text-green-100 text-sm mt-1">Tetap semangat dan selesaikan tugas hari ini.</p>
        </div>
        <button className="relative p-2 bg-white/20 backdrop-blur-sm rounded-full text-white">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-green-900"></span>
        </button>
      </div>

      {/* 4 Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Kehadiran */}
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/20">
          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-2">
            <Calendar size={18} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Kehadiran Hari Ini</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">
            {todayAttendance?.checkIn ? formatTime(todayAttendance.checkIn.time) : "--:--"}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${todayAttendance?.checkIn ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <p className="text-[10px] text-gray-500">{todayAttendance?.checkIn ? "Masuk" : "Belum Absen"}</p>
          </div>
        </div>

        {/* Sisa Cuti */}
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/20">
          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-2">
            <FileText size={18} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Sisa Cuti Tahunan</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">8 <span className="text-sm font-normal text-gray-500">Hari</span></p>
          <p className="text-[10px] text-orange-600 font-medium mt-1 bg-orange-50 w-fit px-1.5 py-0.5 rounded">Tahun 2024</p>
        </div>

        {/* Tugas */}
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/20">
          <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle size={18} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Work Order Hari Ini</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">{workOrders.length}</p>
          <p className="text-[10px] text-green-600 font-medium mt-1 bg-green-50 w-fit px-1.5 py-0.5 rounded">2 Selesai</p>
        </div>

        {/* Pengumuman */}
        <Link href="/mobile/announcements" className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/20 block hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-2">
            <Megaphone size={18} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Pengumuman Baru</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">{announcementCount}</p>
          <p className="text-[10px] text-blue-600 font-medium mt-1">Lihat sekarang →</p>
        </Link>
      </div>

      {/* Tugas Saya */}
      <div className="bg-white/95 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Work Order Terbaru</h3>
          <Link href="/mobile/tasks" className="text-xs text-green-600 font-medium hover:underline">
            Lihat Semua
          </Link>
        </div>

        <div className="space-y-3">
          {workOrders.length > 0 ? workOrders.map((wo, i) => (
            <div key={wo.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${wo.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                  {wo.status === 'completed' ? <CheckCircle size={16} /> : <Clock3 size={16} />}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm line-clamp-1">{wo.title || "Tanpa Judul"}</p>
                  <p className="text-xs text-gray-500">{wo.location || "Area Taman"}</p>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-1 rounded-md ${wo.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {wo.status === 'completed' ? 'Selesai' : 'Proses'}
              </span>
            </div>
          )) : (
            <div className="text-center py-6">
              <AlertCircle size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Belum ada work order hari ini.</p>
            </div>
          )}
        </div>
      </div>

      {/* Riwayat Kehadiran (Mini) */}
      <div className="bg-white/95 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Riwayat Kehadiran</h3>
          <Link href="/mobile/history" className="text-xs text-green-600 font-medium hover:underline">
            Lihat Lengkap
          </Link>
        </div>
        
        <div className="space-y-3">
          {recentHistory.slice(0, 3).map((item, i) => (
             <div key={item.id} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
               <div>
                 <p className="text-sm font-medium text-gray-800">{item.date?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                 <p className="text-[10px] text-gray-500">Shift: {item.shift?.name || "Reguler"}</p>
               </div>
               <div className="text-right">
                 <p className="text-xs font-mono text-gray-700">{item.checkIn ? formatTime(item.checkIn.time) : "--:--"} - {item.checkOut ? formatTime(item.checkOut.time) : "--:--"}</p>
               </div>
             </div>
          ))}
          {recentHistory.length === 0 && (
            <p className="text-sm text-center text-gray-500 py-2">Belum ada riwayat.</p>
          )}
        </div>
      </div>

    </div>
  );
}
