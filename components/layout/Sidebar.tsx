// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { subscribeToUnreadCount } from "@/lib/chat/firebase";
import { useEffect, useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUnreadCount(setUnreadChatCount);
    return () => unsub();
  }, [user]);

  const isActivePath = (path: string) => {
    if (path === "/dashboard") return pathname === path;
    return pathname.startsWith(path);
  };

  const hasAccess = (item: any) => {
    if (!user) return false;
    const normalizedRole = user.role.toLowerCase().replace(/\s+/g, '_');
    
    if (item.roles && item.roles.includes("all")) return true;
    if (item.feature) return can(item.feature);
    if (item.roles) return item.roles.includes(normalizedRole);
    return false;
  };

  const menuGroups = [
    {
      title: "MAIN",
      items: [
        { name: "Dashboard", path: "/dashboard", icon: <DashboardIcon />, roles: ["all"] },
        { name: "Artikel & Pengumuman", path: "/articles", icon: <ArticleIcon />, roles: ["super_admin", "admin", "hr", "owner", "gm"] },
        { name: "Chat", path: "/chat", icon: <ChatIcon />, roles: ["all"] },
      ],
    },
    {
      title: "ATTENDANCE",
      items: [
        { name: "Absensi", path: "/attendance", icon: <AttendanceIcon />, feature: "view_attendance" },
        { name: "Koreksi Kehadiran", path: "/attendance-corrections", icon: <CorrectionIcon />, feature: "manage_attendance" },
        { name: "Jadwal Shift", path: "/schedule-shift", icon: <ScheduleIcon />, feature: "view_shifts" },
        { name: "Shift", path: "/shifts", icon: <ShiftIcon />, feature: "manage_shifts" },
        { name: "Shift Audit", path: "/shift-audit", icon: <AuditIcon />, feature: "manage_shifts" },
        { name: "Manager on Duty", path: "/manager-on-duty", icon: <MODIcon />, feature: "view_mod" },
      ],
    },
    {
      title: "HUMAN RESOURCES",
      items: [
        { name: "Data Pegawai", path: "/users", icon: <UsersIcon />, feature: "view_users" },
        { name: "Struktur Organisasi", path: "/org-chart", icon: <OrgChartIcon />, feature: "view_users" },
        { name: "Internal Memo", path: "/internal-memo", icon: <MemoIcon />, feature: "view_memo" },
        { name: "Work Orders", path: "/work-orders", icon: <WorkOrderIcon />, feature: "view_work_orders" },
        { name: "Kompetensi", path: "/competencies", icon: <CompetencyIcon />, feature: "view_assessments" },
        { name: "Aspek Penilaian", path: "/assessment-aspects", icon: <AspectIcon />, feature: "manage_assessments" },
        { name: "Rentang Nilai", path: "/score-ranges", icon: <RangeIcon />, feature: "manage_assessments" },
      ],
    },
    {
      title: "PERFORMANCE",
      items: [
        { name: "KPI", path: "/kpi", icon: <KPIIcon />, feature: "view_assessments" },
        { name: "Setting KPI", path: "/kpi/settings", icon: <SettingIcon />, feature: "manage_assessments" },
        { name: "Periode Penilaian", path: "/kpi/periods", icon: <PeriodIcon />, feature: "manage_assessments" },
        { name: "Input Penilaian", path: "/assessments/input", icon: <InputIcon />, feature: "view_assessments" },
        { name: "Dalam Masa Penilaian", path: "/assessments/active", icon: <ActiveIcon />, feature: "view_assessments" },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { name: "Payroll", path: "/payroll", icon: <PayrollIcon />, feature: "view_payroll" },
        { name: "Laporan", path: "/reports/export", icon: <ReportIcon />, feature: "manage_payroll" },
      ],
    },
    {
      title: "EVENTS",
      items: [
        { name: "Dashboard Event", path: "/events/dashboard", icon: <DashboardIcon />, roles: ["all"] },
        { name: "Database Klien", path: "/events/clients", icon: <DatabaseIcon />, roles: ["all"] },
        { name: "Kalender Event", path: "/events/calendar", icon: <CalendarIcon />, roles: ["all"] },
        { name: "Daftar REO", path: "/events/reo", icon: <ReoIcon />, roles: ["super_admin", "admin", "hr", "manager"] },
        { name: "Daftar FEO", path: "/events/feo", icon: <FeoIcon />, roles: ["super_admin", "admin", "hr", "manager"] },
      ],
    },
    {
      title: "ADMIN",
      items: [
        { name: "Approval Flow", path: "/approval-flow", icon: <ApprovalIcon />, feature: "manage_settings" },
        { name: "Settings", path: "/settings", icon: <SettingsIcon />, feature: "manage_settings" },
        { name: "Departments", path: "/settings/departments", icon: <SettingsIcon />, roles: ["super_admin", "admin", "hr", "owner", "gm"] },
        { name: "Hak Akses (RBAC)", path: "/settings/roles", icon: <RolesIcon />, roles: ["super_admin"] },
      ],
    },
  ];

  if (!user) return null;

  return (
    <aside className={`bg-white h-screen flex flex-col border-r border-slate-100 transition-all duration-300 print:hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${collapsed ? "w-20" : "w-[260px]"}`}>
      
      {/* Header Search Area */}
      <div className="h-20 bg-emerald-600 flex-shrink-0 flex items-center px-4 shadow-sm relative overflow-hidden">
        {/* Subtle decorative circle */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        {!collapsed ? (
          <div className="flex items-center gap-3 w-full relative z-10">
            <button className="text-white/80 hover:text-white lg:hidden" onClick={onClose}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Cari menu..." 
                className="w-full bg-white/10 border border-emerald-400/30 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-emerald-100 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
              />
            </div>
            {onToggle && (
              <button onClick={onToggle} className="text-emerald-100 hover:text-white hidden lg:block relative z-10 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-center relative z-10">
             {onToggle && (
              <button onClick={onToggle} className="text-emerald-100 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        {menuGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter(item => hasAccess(item));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-6">
              {!collapsed && (
                <div className="px-3 mb-2 mt-4">
                  <span className="text-[10px] font-extrabold text-emerald-600/70 tracking-[0.15em] uppercase">
                    {group.title}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = isActivePath(item.path);
                  
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={onClose}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group
                        ${isActive 
                          ? "bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold shadow-[0_2px_10px_rgba(16,185,129,0.05)]" 
                          : "border border-transparent text-slate-500 hover:bg-slate-50 hover:text-emerald-600 font-medium"
                        }
                      `}
                      title={collapsed ? item.name : undefined}
                    >
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-emerald-500 rounded-r-full"></div>}
                      <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all duration-300 relative ${isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"}`}>
                        {item.icon}
                        {item.path === "/chat" && unreadChatCount > 0 && collapsed && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        )}
                      </span>
                      
                      {!collapsed && (
                        <span className="flex-1 text-[13px] tracking-wide flex justify-between items-center">
                          {item.name}
                          {item.path === "/chat" && unreadChatCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {unreadChatCount}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      
      {/* Footer Info */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-100 flex items-center gap-3 bg-white">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 text-sm font-black shrink-0">
            N
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ROLE</p>
            <p className="text-sm font-bold text-slate-700 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </aside>
  );
}

// ==================== ICONS ====================
// (Reusing same clean line icons)
const DashboardIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const AttendanceIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const CorrectionIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const ScheduleIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ShiftIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const AuditIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const MODIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const WorkOrderIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const UsersIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const OrgChartIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20v-6h4v6a1 1 0 001 1h3a1 1 0 001-1v-6h2a1 1 0 00.8-1.6l-9-12a1 1 0 00-1.6 0l-9 12a1 1 0 00.8 1.6h2v6a1 1 0 001 1h3a1 1 0 001-1z" /></svg>;
const MemoIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const CompetencyIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const AspectIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const RangeIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
const SettingsIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const KPIIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const SettingIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const PeriodIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const InputIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const ActiveIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const PayrollIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ReportIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const ApprovalIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const RolesIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const ChatIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const ArticleIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>;
const CalendarIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const ReoIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const FeoIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const DatabaseIcon = () => <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
