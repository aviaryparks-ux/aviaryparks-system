"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppEvent } from "@/types/event";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function FEOListPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "action_needed">("all");

  useEffect(() => {
    const q = query(
      collection(db, "events"),
      where("type", "==", "FEO")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData: AppEvent[] = [];
      snapshot.forEach((doc) => {
        eventData.push({ id: doc.id, ...doc.data() } as AppEvent);
      });
      // Client-side sort to avoid Firebase Index requirements
      eventData.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      setEvents(eventData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">APPROVED</span>;
      case "waiting_approval":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">WAITING APPROVAL</span>;
      case "ongoing":
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">ONGOING</span>;
      case "done":
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">DONE</span>;
      case "cancelled":
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">CANCELLED</span>;
      case "rejected":
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">DITOLAK</span>;
      default:
        return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">DRAFT</span>;
    }
  };

  const getFilteredEvents = () => {
    if (activeTab === "all") return events;
    
    return events.filter(event => {
      if (event.status !== "waiting_approval") return false;
      const currentApprover = event.approvalFlow?.[event.currentApproverIndex || 0];
      return currentApprover?.approverUid === user?.uid;
    });
  };

  const filteredEvents = getFilteredEvents();
  const actionNeededCount = events.filter(event => event.status === "waiting_approval" && event.approvalFlow?.[event.currentApproverIndex || 0]?.approverUid === user?.uid).length;

  return (
    <ProtectedRoute requiredFeature="view_feo">
      <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Fieldtrip Event Order (FEO)</h1>
            <p className="text-slate-500 mt-1">Kelola pesanan rombongan fieldtrip</p>
          </div>
          <Link
            href="/events/feo/create"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Buat FEO Baru
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Semua FEO
          </button>
          <button
            onClick={() => setActiveTab("action_needed")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "action_needed" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Perlu Tindakan Saya
            {actionNeededCount > 0 && (
               <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                 {actionNeededCount}
               </span>
            )}
          </button>
        </div>

        {/* Table List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-sm">
                  <th className="p-4 font-semibold">TANGGAL & WAKTU</th>
                  <th className="p-4 font-semibold">NAMA SEKOLAH & EVENT</th>
                  <th className="p-4 font-semibold">PIC / INCHARGE</th>
                  <th className="p-4 font-semibold">PAX / LOKASI</th>
                  <th className="p-4 font-semibold">STATUS</th>
                  <th className="p-4 font-semibold text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Memuat data...</td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Belum ada data FEO</td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">
                        {format(new Date(event.startDate), "dd MMM yyyy", { locale: id })} <br/>
                        <span className="text-xs text-slate-400">{event.startTime} - {event.endTime}</span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold text-slate-800">{event.feoData?.schoolName || event.clientName || "-"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{event.title}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{event.feoData?.personIncharge || "-"}</td>
                      <td className="p-4 text-sm text-slate-600">
                        {event.feoData?.paxTotal || 0} pax <br />
                        <span className="text-xs text-slate-400">{event.feoData?.restaurantName || "-"} {event.feoData?.lunchArea ? `(${event.feoData.lunchArea})` : ''}</span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(event.status)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {((event.createdBy === user?.uid || user?.role === 'super_admin') && (event.status === 'draft' || event.status === 'negotiation' || event.status === 'rejected')) && (
                            <Link
                              href={`/events/feo/${event.id}/edit`}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Ubah
                            </Link>
                          )}
                          <Link
                            href={`/events/feo/${event.id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
