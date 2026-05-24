// app/(admin)/manager-on-duty/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import { MODSchedule, getDayName, formatDate, formatDateShort, getDayOfWeek, getRoleLabel } from "@/types/mod";

export default function ManagerOnDutyPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<MODSchedule[]>([]);
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // 6 days = 2 weeks of weekends (Fri, Sat, Sun)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setCurrentPage(1); // Reset page when month changes
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const q = query(
      collection(db, "mod_schedules"),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: MODSchedule[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MODSchedule);
      });
      setSchedules(list);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedMonth]);

  // Fetch users for Manager Tersedia list
  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubUsers = onSnapshot(query(usersRef), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (["manager", "spv"].includes(data.role)) {
          list.push({ id: doc.id, ...data });
        }
      });
      setAvailableManagers(list);
    });
    return () => unsubUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus jadwal MOD ini?")) {
      try {
        await deleteDoc(doc(db, "mod_schedules", id));
      } catch (error) {
        console.error("Error deleting schedule:", error);
        alert("Gagal menghapus jadwal MOD");
      }
    }
  };

  const canCreate = user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr";
  const canEdit = user?.role === "super_admin";
  const canDelete = user?.role === "super_admin";

  // Data helpers
  const today = new Date().toISOString().split('T')[0];
  const modToday = schedules.find(s => s.date === today);
  const totalModThisMonth = schedules.length;

  const isManagerBusyToday = (userId: string) => {
    return schedules.some(s => s.date === today && s.userId === userId);
  };

  const getStatusBadge = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const todayObj = new Date(today);
    
    if (dateStr === today) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Berlangsung
        </span>
      );
    }
    if (dateObj > todayObj) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Terjadwal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        Selesai
      </span>
    );
  };

  // Generate calendar dates for the table (just Fri, Sat, Sun for now)
  const getTableRows = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = getDayOfWeek(dateStr);
      
      // We only show Fri, Sat, Sun per the original business logic, 
      // but in the mockup it shows all days? Let's stick to the business logic 
      // but show "Tidak Ada" or "Hari Libur" for empty days to match the mockup table look.
      // Wait, let's just show every day of the month for completeness, or just the weekend.
      // Let's stick to the requirement: Friday, Saturday, Sunday.
      if (dayOfWeek) {
        const schedule = schedules.find(s => s.date === dateStr);
        dates.push({ date: dateStr, dayOfWeek, schedule });
      }
    }
    return dates;
  };

  const tableRows = getTableRows();
  
  // Pagination logic
  const totalPages = Math.ceil(tableRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRows = tableRows.slice(startIndex, startIndex + itemsPerPage);

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="space-y-6 pb-20">
        
        {/* STATS CARDS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Manager on Duty Hari Ini */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Manager on Duty Hari Ini</p>
              {modToday ? (
                <>
                  <p className="text-base font-bold text-slate-800 truncate">{modToday.userName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{getRoleLabel(modToday.role)}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-slate-800 truncate">Belum Ditentukan</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">Tidak ada jadwal</p>
                </>
              )}
              {modToday && <p className="text-[10px] font-medium text-emerald-600 mt-1">08:00 - 17:00</p>}
            </div>
          </div>

          {/* Card 2: Laporan Masuk (Bulan Ini) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Laporan (Bulan Ini)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-800">12</p>
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center">
                  +2 dr bulan lalu
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Menunggu Follow Up */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Menunggu Follow Up</p>
              <p className="text-2xl font-bold text-amber-600">3</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Laporan perlu tindak lanjut</p>
            </div>
          </div>

          {/* Card 4: Persentase Kehadiran MOD */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tingkat Kehadiran (Bulan Ini)</p>
              <p className="text-2xl font-bold text-slate-800">100%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Selalu hadir tepat waktu</p>
            </div>
          </div>

        </div>

        {/* MAIN LAYOUT: Left (Tables) & Right (Sidebar widgets) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Tables */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* TABEL JADWAL MOD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Table Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-800">Jadwal Manager on Duty</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border border-slate-200 text-slate-600 rounded-lg pl-3 pr-2 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  {canCreate && (
                    <Link
                      href="/manager-on-duty/schedule"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Buat Jadwal
                    </Link>
                  )}
                </div>
              </div>

              {/* Table Content */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">Manager</th>
                      <th className="px-5 py-3">Jabatan</th>
                      <th className="px-5 py-3 hidden md:table-cell">Waktu</th>
                      <th className="px-5 py-3 hidden md:table-cell">Lokasi / Area</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8">
                          <div className="flex justify-center">
                            <LoadingScreen fullScreen={false} message="Memuat jadwal MOD..." size={80} />
                          </div>
                        </td>
                      </tr>
                    ) : paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">
                          Tidak ada jadwal di bulan ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map(({ date, dayOfWeek, schedule }, index) => {
                        const isSunday = dayOfWeek === 'sunday';
                        const dateText = new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                        const dayText = getDayName(dayOfWeek);

                        return (
                          <tr key={date} className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`text-sm ${isSunday ? 'text-red-500 font-semibold' : 'text-slate-700'}`}>
                                {dateText} ({dayText})
                              </span>
                            </td>
                            
                            {schedule ? (
                              <>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {schedule.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{schedule.userName}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-sm text-slate-600">{getRoleLabel(schedule.role)}</span>
                                </td>
                                <td className="px-5 py-3.5 hidden md:table-cell">
                                  <span className="text-sm text-slate-600">08:00 - 17:00</span>
                                </td>
                                <td className="px-5 py-3.5 hidden md:table-cell">
                                  <span className="text-sm text-slate-600">Head Office</span>
                                </td>
                                <td className="px-5 py-3.5">
                                  {getStatusBadge(schedule.date)}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {canEdit && (
                                      <Link href={`/manager-on-duty/schedule?id=${schedule.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                      </Link>
                                    )}
                                    {canDelete && (
                                      <button onClick={() => handleDelete(schedule.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-5 py-3.5 text-sm text-slate-400">-</td>
                                <td className="px-5 py-3.5 text-sm text-slate-400">-</td>
                                <td className="px-5 py-3.5 hidden md:table-cell text-sm text-slate-400">-</td>
                                <td className="px-5 py-3.5 hidden md:table-cell text-sm text-slate-400">-</td>
                                <td className="px-5 py-3.5">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    Tidak Ada
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-center text-slate-400 text-sm">
                                  {canCreate && (
                                    <Link href={`/manager-on-duty/schedule?date=${date}`} className="text-emerald-600 hover:underline text-xs font-medium">Isi</Link>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination UI */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <p>Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, tableRows.length)} dari {tableRows.length} jadwal</p>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt;
                    </button>
                    
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 flex items-center justify-center rounded font-medium transition-colors ${
                          currentPage === i + 1 
                            ? 'bg-emerald-500 text-white' 
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}

                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TABEL RIWAYAT MOD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Riwayat Manager on Duty</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">Manager</th>
                      <th className="px-5 py-3 hidden sm:table-cell">Waktu</th>
                      <th className="px-5 py-3 hidden md:table-cell">Lokasi / Area</th>
                      <th className="px-5 py-3">Catatan</th>
                      <th className="px-5 py-3 hidden lg:table-cell">Dibuat Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedules.filter(s => new Date(s.date) < new Date(today)).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-slate-400 text-sm">
                          Belum ada riwayat MOD.
                        </td>
                      </tr>
                    ) : (
                      schedules
                        .filter(s => new Date(s.date) < new Date(today))
                        .map(schedule => (
                          <tr key={schedule.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm text-slate-700">
                              {new Date(schedule.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                                  {schedule.userName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-slate-800">{schedule.userName}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 hidden sm:table-cell text-sm text-slate-600">08:00 - 17:00</td>
                            <td className="px-5 py-3 hidden md:table-cell text-sm text-slate-600">Head Office</td>
                            <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[150px]">
                              {schedule.notes || "-"}
                            </td>
                            <td className="px-5 py-3 hidden lg:table-cell text-xs text-slate-400">
                              {schedule.createdByEmail || "super_admin"}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Sidebar Widgets */}
          <div className="space-y-6">
            
            {/* MENU PINTASAN */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">Menu Pintasan</h2>
              </div>
                <div className="p-2 space-y-1">
                  <Link href="/manager-on-duty/fill" className="block p-3 hover:bg-slate-50 rounded-lg transition-colors">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Isi Laporan MOD</h3>
                      <p className="text-[11px] text-slate-500">Mulai inspeksi hari ini</p>
                    </div>
                  </Link>
                  <Link href="/manager-on-duty/dashboard" className="block p-3 hover:bg-slate-50 rounded-lg transition-colors">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Dashboard MOD</h3>
                      <p className="text-[11px] text-slate-500">Lihat statistik detail</p>
                    </div>
                  </Link>
                  <Link href="/manager-on-duty/template" className="block p-3 hover:bg-slate-50 rounded-lg transition-colors">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Template MOD</h3>
                      <p className="text-[11px] text-slate-500">Kelola form checklist</p>
                    </div>
                  </Link>
                  <Link href="/manager-on-duty/report" className="block p-3 hover:bg-slate-50 rounded-lg transition-colors">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Laporan MOD</h3>
                      <p className="text-[11px] text-slate-500">Lihat histori laporan</p>
                    </div>
                  </Link>
                </div>
            </div>

            {/* MANAGER TERSEDIA */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Manager Tersedia</h2>
                <button className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium">Lihat Semua</button>
              </div>
              <div className="p-2">
                {availableManagers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Belum ada data manager</div>
                ) : (
                  availableManagers.map(manager => {
                    const isBusy = isManagerBusyToday(manager.id);
                    return (
                      <div key={manager.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shadow-sm group-hover:border-emerald-200 transition-colors">
                            {manager.name ? manager.name.charAt(0).toUpperCase() : 'M'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{manager.name}</p>
                            <p className="text-[11px] text-slate-500 capitalize">{manager.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div>
                          {!isBusy ? (
                            <span className="px-2.5 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md">
                              Tersedia
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-md">
                              Bertugas
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* INFORMASI & KETENTUAN */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">Informasi & Ketentuan</h2>
              </div>
              <div className="p-5 space-y-5">
                
                <div className="flex gap-4 items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Waktu MOD standar</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">08:00 - 17:00 (dapat disesuaikan oleh admin sesuai shift berjalan).</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Tanggung jawab MOD</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Memastikan operasional berjalan lancar dan menangani eskalasi masalah pada hari libur.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Kontak Darurat</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Ext. 1234 atau 0812-3456-7890 (HR On Call).</p>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}