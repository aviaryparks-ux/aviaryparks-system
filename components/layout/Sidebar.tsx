// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActivePath = (path: string) => {
    if (path === "/dashboard") return pathname === path;
    return pathname.startsWith(path);
  };

  // Cek apakah user memiliki akses ke menu berdasarkan role
  const hasAccess = (roles: string[]) => {
    if (!user) return false;
    if (roles.includes("all")) return true;
    return roles.includes(user.role);
  };

  // ==================== SEMUA MENU LENGKAP ====================
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
        { name: "Shift Audit", path: "/shift-audit", icon: <ShiftIcon />, roles: ["super_admin", "hr"] },
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

  // Filter menu groups berdasarkan role user
  const visibleGroups = menuGroups.filter(group => {
    if (group.roles.includes("all")) return true;
    if (!user) return false;
    return group.roles.includes(user.role);
  });

  if (!user) return null;

  return (
    <aside
      className={`
        flex flex-col h-screen sticky top-0 bg-white border-r border-gray-200 transition-all duration-300
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Sidebar Header with Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2 group">
            {/* Logo SVG */}
            <div className="relative w-8 h-8">
              <Image
                src="/images/logo-aviarypark.svg"
                alt="AviaryPark Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800 text-sm">AviaryParks</span>
              <span className="text-[10px] text-gray-400">Management System</span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="w-full flex justify-center">
            <div className="relative w-8 h-8">
              <Image
                src="/images/logo-aviarypark.svg"
                alt="AviaryPark Logo"
                fill
                className="object-contain"
              />
            </div>
          </Link>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hidden md:block flex-shrink-0"
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        )}
      </div>

      {/* Navigation Menu - SCROLLABLE */}
      <nav className="flex-1 overflow-y-auto py-4 sidebar-scroll">
        {visibleGroups.map((group) => {
          // Filter items dalam group berdasarkan role
          const visibleItems = group.items.filter(item => hasAccess(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-4">
              {/* Group Header */}
              {!collapsed && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
                </div>
              )}

              {/* Menu Items */}
              <div className="mt-1 space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = isActivePath(item.path);
                  
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={onClose}
                      className={`
                        flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium
                        transition-all duration-200 group relative
                        ${isActive
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }
                      `}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className={`w-5 h-5 ${isActive ? "text-green-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.name}</span>}
                      
                      {/* Tooltip untuk collapsed mode */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                          {item.name}
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
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="text-xs text-gray-400 text-center">
            <p>© 2024 AviaryParks</p>
            <p className="mt-1">v1.0.0 | Role: {user.role}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

// ==================== ICONS ====================
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v4M9 1v4M15 1v4" />
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