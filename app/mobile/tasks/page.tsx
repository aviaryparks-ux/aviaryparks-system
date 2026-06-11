"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit } from "firebase/firestore";
import Link from "next/link";
import { Search, MapPin, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function MobileTasks() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");

  const tabs = ["Semua", "Baru", "Proses", "Selesai", "Ditunda"];

  useEffect(() => {
    if (user) {
      loadWorkOrders();
    }
  }, [user]);

  const loadWorkOrders = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user data to get division
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      let q;
      if (userData?.division) {
        // Fetch WO assigned to their division
        q = query(collection(db, "work_orders"), where("assignedToDivision", "==", userData.division), limit(50));
      } else {
        // Fallback: fetch all if no division is found
        q = query(collection(db, "work_orders"), limit(50));
      }

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory to avoid Firebase Index issues
      data.sort((a: any, b: any) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
      setWorkOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const mapStatusForTab = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'Baru';
      case 'in_progress': return 'Proses';
      case 'completed': return 'Selesai';
      case 'pending': return 'Ditunda';
      case 'closed': return 'Ditutup';
      default: return 'Baru';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-orange-500';
      case 'high': return 'bg-red-500';
      case 'critical': return 'bg-red-700';
      default: return 'bg-orange-500';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filteredOrders = workOrders.filter(wo => {
    const statusLabel = mapStatusForTab(wo.status);
    const matchTab = selectedTab === "Semua" || statusLabel === selectedTab;
    const searchString = searchQuery.toLowerCase();
    const matchSearch = searchString === "" || 
                        (wo.title?.toLowerCase().includes(searchString) || 
                         wo.woNumber?.toLowerCase().includes(searchString));
    return matchTab && matchSearch;
  });

  const countByStatus = (statusLabel: string) => {
    return workOrders.filter(wo => mapStatusForTab(wo.status) === statusLabel).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative pb-20">
      
      {/* HEADER & SEARCH */}
      <div className="bg-white px-4 pt-6 pb-2 sticky top-0 z-30 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Work Order</h1>
        
        {/* Search Bar */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 sm:text-sm transition-all"
            placeholder="Cari judul atau nomor WO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* STATS ROW */}
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">
          <div className="text-center flex-1 border-r border-gray-200 last:border-0">
            <p className="text-[10px] text-gray-500 font-medium mb-0.5">SEMUA</p>
            <p className="text-lg font-bold text-gray-800 leading-none">{workOrders.length}</p>
          </div>
          <div className="text-center flex-1 border-r border-gray-200 last:border-0">
            <p className="text-[10px] text-orange-600 font-medium mb-0.5">BARU</p>
            <p className="text-lg font-bold text-orange-600 leading-none">{countByStatus("Baru")}</p>
          </div>
          <div className="text-center flex-1 border-r border-gray-200 last:border-0">
            <p className="text-[10px] text-blue-600 font-medium mb-0.5">PROSES</p>
            <p className="text-lg font-bold text-blue-600 leading-none">{countByStatus("Proses")}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[10px] text-green-600 font-medium mb-0.5">SELESAI</p>
            <p className="text-lg font-bold text-green-600 leading-none">{countByStatus("Selesai")}</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedTab === tab 
                  ? 'bg-green-600 text-white shadow-md shadow-green-600/20' 
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map(wo => (
              <Link 
                href={`/mobile/tasks/${wo.id}`} 
                key={wo.id}
                className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${getStatusStyle(wo.status)}`}>
                      {mapStatusForTab(wo.status).toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      {wo.woNumber || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(wo.priority)}`}></div>
                    <span className="text-[10px] font-medium text-gray-500 uppercase">{wo.priority || 'Medium'}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-800 text-sm mb-3 line-clamp-2 leading-snug">
                  {wo.title || "Tanpa Judul"}
                </h3>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <MapPin size={12} />
                    <span className="text-[10px] font-medium truncate max-w-[120px]">
                      {wo.locationArea || "Area Tidak Diketahui"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Calendar size={12} />
                    <span className="text-[10px] font-medium">
                      {formatDate(wo.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-gray-800 font-bold mb-1">Tidak ada Work Order</h3>
            <p className="text-gray-500 text-sm">Tidak ada work order yang sesuai dengan filter.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
