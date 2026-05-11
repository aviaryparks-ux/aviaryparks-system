// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActivePath = (path: string) => {
    if (path === "/dashboard") return pathname === path;
    return pathname.startsWith(path);
  };

  const hasAccess = (roles: string[]) => {
    if (!user) return false;
    if (roles.includes("all")) return true;
    return roles.includes(user.role);
  };

  const allMenuItems = [
    { name: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
    { name: "Absensi", path: "/attendance", icon: <AttendanceIcon /> },
    { name: "Koreksi Absensi", path: "/attendance-corrections", icon: <CorrectionIcon /> },
    { name: "Jadwal Shift", path: "/schedule-shift", icon: <ScheduleIcon /> },
    { name: "Shift", path: "/shifts", icon: <ShiftIcon /> },
    { name: "Shift Audit", path: "/shift-audit", icon: <AuditIcon /> },
    { name: "Data Pegawai", path: "/users", icon: <UsersIcon /> },
    { name: "Kompetensi", path: "/competencies", icon: <CompetencyIcon /> },
    { name: "Aspek Penilaian", path: "/assessment-aspects", icon: <AspectIcon /> },
    { name: "Rentang Nilai", path: "/score-ranges", icon: <RangeIcon /> },
    { name: "Attendance Settings", path: "/attendance-settings", icon: <SettingsIcon /> },
    { name: "Morning Briefing", path: "/morning-briefing", icon: <MorningIcon /> },
    { name: "Pengumuman", path: "/articles", icon: <ArticleIcon /> },
    { name: "KPI", path: "/kpi", icon: <KPIIcon /> },
    { name: "Setting KPI", path: "/kpi/settings", icon: <SettingIcon /> },
    { name: "Periode Penilaian", path: "/kpi/periods", icon: <PeriodIcon /> },
    { name: "Input Penilaian", path: "/assessments/input", icon: <InputIcon /> },
    { name: "Dalam Masa Penilaian", path: "/assessments/active", icon: <ActiveIcon /> },
    { name: "Riwayat Penilaian", path: "/assessments/history", icon: <HistoryIcon /> },
    { name: "Payroll", path: "/payroll", icon: <PayrollIcon /> },
    { name: "Laporan", path: "/reports/export", icon: <ReportIcon /> },
    { name: "Approval Flow", path: "/approval-flow", icon: <ApprovalIcon /> },
    { name: "Settings", path: "/settings", icon: <SettingsIcon /> },
  ];

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = allMenuItems.filter(item =>
      item.name.toLowerCase().includes(query)
    );
    setSearchResults(results.slice(0, 6));
    setShowResults(true);
  }, [searchQuery]);

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery("");
    setShowResults(false);
    if (onClose) onClose();
  };

  const menuGroups = [
    {
      title: "MAIN",
      roles: ["all"],
      items: [
        { name: "Dashboard", path: "/dashboard", icon: <DashboardIcon />, roles: ["all"] },
      ],
    },
    {
      title: "ATTENDANCE",
      roles: ["super_admin", "admin", "hr", "spv"],
      items: [
        { name: "Absensi", path: "/attendance", icon: <AttendanceIcon />, roles: ["all"] },
        { name: "Koreksi Absensi", path: "/attendance-corrections", icon: <CorrectionIcon />, roles: ["super_admin", "hr", "spv"] },
        { name: "Jadwal Shift", path: "/schedule-shift", icon: <ScheduleIcon />, roles: ["super_admin", "admin", "hr"] },
        { name: "Shift", path: "/shifts", icon: <ShiftIcon />, roles: ["super_admin", "hr"] },
        { name: "Shift Audit", path: "/shift-audit", icon: <AuditIcon />, roles: ["super_admin", "hr"] },
      ],
    },
    {
      title: "HUMAN RESOURCES",
      roles: ["super_admin", "admin", "hr"],
      items: [
        { name: "Data Pegawai", path: "/users", icon: <UsersIcon />, roles: ["super_admin", "admin", "hr"] },
        { name: "Kompetensi", path: "/competencies", icon: <CompetencyIcon />, roles: ["super_admin", "hr"] },
        { name: "Aspek Penilaian", path: "/assessment-aspects", icon: <AspectIcon />, roles: ["super_admin", "hr"] },
        { name: "Rentang Nilai", path: "/score-ranges", icon: <RangeIcon />, roles: ["super_admin", "hr"] },
        { name: "Attendance Settings", path: "/attendance-settings", icon: <SettingsIcon />, roles: ["super_admin", "hr"] },
        { name: "Morning Briefing", path: "/morning-briefing", icon: <MorningIcon />, roles: ["super_admin", "hr"] },
        { name: "Pengumuman", path: "/articles", icon: <ArticleIcon />, roles: ["super_admin", "admin", "hr"] },
      ],
    },
    {
      title: "PERFORMANCE",
      roles: ["super_admin", "admin", "hr", "spv"],
      items: [
        { name: "KPI", path: "/kpi", icon: <KPIIcon />, roles: ["super_admin", "admin", "hr", "spv"] },
        { name: "Setting KPI", path: "/kpi/settings", icon: <SettingIcon />, roles: ["super_admin", "hr"] },
        { name: "Periode Penilaian", path: "/kpi/periods", icon: <PeriodIcon />, roles: ["super_admin", "hr"] },
        { name: "Input Penilaian", path: "/assessments/input", icon: <InputIcon />, roles: ["super_admin", "hr", "spv"] },
        { name: "Dalam Masa Penilaian", path: "/assessments/active", icon: <ActiveIcon />, roles: ["super_admin", "hr", "spv"] },
        { name: "Riwayat Penilaian", path: "/assessments/history", icon: <HistoryIcon />, roles: ["super_admin", "hr", "spv"] },
      ],
    },
    {
      title: "FINANCE",
      roles: ["super_admin", "admin", "hr", "finance"],
      items: [
        { name: "Payroll", path: "/payroll", icon: <PayrollIcon />, roles: ["super_admin", "hr", "finance"] },
        { name: "Laporan", path: "/reports/export", icon: <ReportIcon />, roles: ["super_admin", "hr", "finance"] },
      ],
    },
    {
      title: "ADMIN",
      roles: ["super_admin"],
      items: [
        { name: "Approval Flow", path: "/approval-flow", icon: <ApprovalIcon />, roles: ["super_admin"] },
        { name: "Settings", path: "/settings", icon: <SettingsIcon />, roles: ["super_admin"] },
      ],
    },
  ];

  const visibleGroups = menuGroups.filter(group => {
    if (group.roles.includes("all")) return true;
    if (!user) return false;
    return group.roles.includes(user.role);
  });

  if (!user) return null;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; }

        .sidebar-glass {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .menu-item-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .menu-item-hover:hover {
          transform: translateX(4px);
        }

        .active-indicator {
          position: relative;
        }

        .active-indicator::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: linear-gradient(180deg, #22c55e, #16a34a);
          border-radius: 0 4px 4px 0;
        }

        .group-title {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 163, 74, 0.05) 100%);
        }
      `}</style>

      <aside
        className={`
          sidebar-glass flex flex-col h-screen sticky top-0 border-r border-emerald-100/50
          shadow-xl shadow-emerald-900/5 transition-all duration-300 ease-out
          ${collapsed ? "w-20" : "w-64"}
        `}
      >
        {/* Sidebar Header - Search Bar */}
        <div className="relative h-16 flex-shrink-0 overflow-visible">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500" />
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="sidebar-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#sidebar-grid)" />
            </svg>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -top-4 -left-4 w-16 h-16 bg-emerald-300/20 rounded-full blur-lg" />

          <div className="relative z-10 flex items-center h-full px-3">
            {!collapsed ? (
              <div className="flex-1 relative" ref={searchRef}>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/30 transition-all"
                  />
                </div>

                {/* Search Results Dropdown - di luar container */}
                {showResults && (
                  <div className="fixed mt-2 ml-3 w-56 bg-white rounded-xl shadow-2xl border border-slate-200/80 overflow-hidden z-[100] animate-slide-up">
                    {searchResults.length > 0 ? (
                      searchResults.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => handleResultClick(item.path)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            {item.icon}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-slate-500">Tidak ada hasil</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button className="w-full flex justify-center p-2 bg-white/15 rounded-xl hover:bg-white/20 transition-all">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {onToggle && (
              <button
                onClick={onToggle}
                className="ml-2 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all duration-200 flex-shrink-0"
              >
                {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4 sidebar-scroll">
          {visibleGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(item => hasAccess(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="mb-3">
                {!collapsed ? (
                  <div className="group-title mx-3 px-3 py-2 rounded-lg">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                      {group.title}
                    </span>
                  </div>
                ) : (
                  <div className="mx-3 mb-2">
                    <div className="w-8 h-0.5 bg-emerald-200 mx-auto rounded-full" />
                  </div>
                )}

                <div className="mt-1 space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = isActivePath(item.path);

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={onClose}
                        className={`
                          menu-item-hover relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium
                          transition-all duration-200 group
                          ${isActive
                            ? "bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 active-indicator shadow-sm shadow-emerald-200/50"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }
                        `}
                        title={collapsed ? item.name : undefined}
                        style={{ animationDelay: `${groupIdx * 0.05}s` }}
                      >
                        <span className={`
                          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200
                          ${isActive
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                            : "bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600"
                          }
                        `}>
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.name}</span>
                        )}

                        {collapsed && (
                          <div className="absolute left-full ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-xl">
                            {item.name}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900" />
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="flex-shrink-0 border-t border-emerald-100/50 bg-gradient-to-t from-emerald-50/50 to-transparent p-4">
          {!collapsed ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/80 rounded-xl shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-600 font-medium">
                  v2.0 | {user.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ==================== ICONS ====================
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const AttendanceIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CorrectionIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ScheduleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
  </svg>
);

const ShiftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AuditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CompetencyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const AspectIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const RangeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MorningIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ArticleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);

const KPIIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PeriodIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const InputIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ActiveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PayrollIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ReportIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ApprovalIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
