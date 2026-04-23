// components/TopNavigation.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

type MenuItem = {
  name: string;
  path: string;
  icon: React.ReactNode;
  allowedRoles: string[];
  children?: MenuItem[];
};

export default function TopNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // SEMUA MENU
  const allMenus: MenuItem[] = [
    // Menu utama yang sudah ada
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <DashboardIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "spv", "finance"],
    },
    {
      name: "Attendance",
      path: "/attendance",
      icon: <AttendanceIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "spv"],
    },
    {
      name: "Corrections",
      path: "/attendance-corrections",
      icon: <CorrectionIcon />,
      allowedRoles: ["super_admin", "hr", "spv"],
    },
    {
      name: "Schedule",
      path: "/schedule-shift",
      icon: <ScheduleIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "spv"],
    },
    {
      name: "Shifts",
      path: "/shifts",
      icon: <ShiftIcon />,
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Shift Audit",
      path: "/shift-audit",
      icon: <ShiftIcon />,
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Users",
      path: "/users",
      icon: <UsersIcon />,
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Attendance Settings",
      path: "/attendance-settings",
      icon: <SettingsIcon />,
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Payroll",
      path: "/payroll",
      icon: <PayrollIcon />,
      allowedRoles: ["super_admin", "hr", "finance"],
    },
    {
      name: "Morning Briefing",
      path: "/morning-briefing",
      icon: <MorningIcon />,
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <SettingsIcon />,
      allowedRoles: ["super_admin"],
    },
    {
      name: "Approval",
      path: "/approval-flow",
      icon: <ApprovalIcon />,
      allowedRoles: ["super_admin"],
    },
    // DROPDOWN MENU BARU
    {
      name: "Karyawan",
      path: "/employees",
      icon: <EmployeesIcon />,
      allowedRoles: ["super_admin", "admin", "hr"],
      children: [
        { name: "Data Pegawai", path: "/employees", icon: <ListIcon />, allowedRoles: ["super_admin", "admin", "hr"] },
        { name: "Tambah Pegawai", path: "/employees/add", icon: <AddIcon />, allowedRoles: ["super_admin", "hr"] },
        { name: "Import / Export", path: "/employees/import-export", icon: <ImportIcon />, allowedRoles: ["super_admin", "hr"] },
      ],
    },
    {
      name: "Master Data",
      path: "/competencies",
      icon: <MasterDataIcon />,
      allowedRoles: ["super_admin", "admin", "hr"],
      children: [
        { name: "Kompetensi", path: "/competencies", icon: <CompetencyIcon />, allowedRoles: ["super_admin", "hr"] },
        { name: "Aspek Penilaian", path: "/assessment-aspects", icon: <AspectIcon />, allowedRoles: ["super_admin", "hr"] },
        { name: "Rentang Nilai", path: "/score-ranges", icon: <RangeIcon />, allowedRoles: ["super_admin", "hr"] },
      ],
    },
    {
      name: "KPI & Kinerja",
      path: "/kpi",
      icon: <KPIIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "spv"],
      children: [
        { name: "Data KPI", path: "/kpi", icon: <DataIcon />, allowedRoles: ["super_admin", "admin", "hr", "spv"] },
        { name: "Setting KPI", path: "/kpi/settings", icon: <SettingIcon />, allowedRoles: ["super_admin", "hr"] },
        { name: "Periode Penilaian", path: "/kpi/periods", icon: <PeriodIcon />, allowedRoles: ["super_admin", "hr"] },
      ],
    },
    {
      name: "Penilaian",
      path: "/assessments",
      icon: <AssessmentIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "spv"],
      children: [
        { name: "Input Penilaian", path: "/assessments/input", icon: <InputIcon />, allowedRoles: ["super_admin", "hr", "spv"] },
        { name: "Dalam Masa Penilaian", path: "/assessments/active", icon: <ActiveIcon />, allowedRoles: ["super_admin", "hr", "spv"] },
        { name: "Riwayat Penilaian", path: "/assessments/history", icon: <HistoryIcon />, allowedRoles: ["super_admin", "hr", "spv"] },
      ],
    },
    {
      name: "Laporan",
      path: "/reports",
      icon: <ReportIcon />,
      allowedRoles: ["super_admin", "admin", "hr", "finance"],
      children: [
        { name: "Export Data", path: "/reports/export", icon: <ExportIcon />, allowedRoles: ["super_admin", "hr", "finance"] },
      ],
    },
  ];

  const getFilteredMenus = (): MenuItem[] => {
    if (!user) return [];
    return allMenus
      .filter(menu => menu.allowedRoles.includes(user.role))
      .map(menu => {
        if (menu.children) {
          return {
            ...menu,
            children: menu.children.filter(child => child.allowedRoles.includes(user.role)),
          };
        }
        return menu;
      })
      .filter(menu => !menu.children || menu.children.length > 0);
  };

  const filteredMenus = getFilteredMenus();

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      let isOutside = true;
      
      Object.values(dropdownRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          isOutside = false;
        }
      });
      
      if (isOutside && openDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  const toggleDropdown = (menuName: string) => {
    setOpenDropdown(openDropdown === menuName ? null : menuName);
  };

  const isActivePath = (path: string) => pathname === path;
  const isChildActive = (children?: MenuItem[]) => {
    if (!children) return false;
    return children.some(child => isActivePath(child.path));
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR",
      manager: "Manager",
      spv: "Supervisor",
      finance: "Finance",
    };
    return labels[role] || "Employee";
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading || !user) {
    return <NavSkeleton />;
  }

  if (!user || !filteredMenus.length) {
    return null;
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center shadow-md transition-all group-hover:scale-105">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="ml-2 text-base font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent hidden sm:block">
                AviaryParks
              </span>
              <span className="text-xs text-gray-400 hidden lg:block">| Management System</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {filteredMenus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const isActive = isActivePath(menu.path);
              const isDropdownOpen = openDropdown === menu.name;
              const hasActiveChild = isChildActive(menu.children);

              if (hasChildren) {
                return (
                  <div
                    key={menu.name}
                    className="relative"
                    ref={(el) => {
                      dropdownRefs.current[menu.name] = el;
                    }}
                  >
                    <button
                      onClick={() => toggleDropdown(menu.name)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                        transition-all duration-200
                        ${isDropdownOpen || isActive || hasActiveChild
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }
                      `}
                    >
                      <span className="w-4 h-4">{menu.icon}</span>
                      <span className="hidden lg:inline">{menu.name}</span>
                      <svg 
                        className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* DROPDOWN CONTENT */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {menu.children!.map((child) => (
                          <Link
                            key={child.path}
                            href={child.path}
                            onClick={() => setOpenDropdown(null)}
                            className={`
                              flex items-center gap-3 px-4 py-2 text-sm
                              ${isActivePath(child.path)
                                ? "bg-green-50 text-green-700"
                                : "text-gray-700 hover:bg-gray-100"
                              }
                            `}
                          >
                            <span className="w-4 h-4 text-gray-400">{child.icon}</span>
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={menu.name}
                  href={menu.path}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${isActivePath(menu.path)
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                >
                  <span className="w-4 h-4">{menu.icon}</span>
                  <span className="hidden lg:inline">{menu.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Section - User */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {getRoleLabel(user.role)}
              </span>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none group"
              >
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-green-500" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{getInitials(user.name)}</span>
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                          <span className="text-white font-bold">{getInitials(user.name)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsUserDropdownOpen(false)}>
                      <ProfileIcon /> My Profile
                    </Link>
                  </div>
                  <div className="border-t border-gray-100" />
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50">
                    <LogoutIcon /> Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-gray-200">
            {filteredMenus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;

              if (hasChildren) {
                return (
                  <div key={menu.name}>
                    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 font-medium">
                      <span className="w-5 h-5">{menu.icon}</span>
                      <span>{menu.name}</span>
                    </div>
                    <div className="ml-8 pl-4 border-l border-gray-200">
                      {menu.children!.map((child) => (
                        <Link
                          key={child.path}
                          href={child.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-sm rounded-lg my-1 ${isActivePath(child.path) ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                          <span className="w-4 h-4">{child.icon}</span>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={menu.name}
                  href={menu.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${isActivePath(menu.path) ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <span className="w-5 h-5">{menu.icon}</span>
                  <span>{menu.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

// ==================== ICONS ====================
const DashboardIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>);
const AttendanceIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const CorrectionIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const ScheduleIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>);
const ShiftIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
const SettingsIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const PayrollIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const MorningIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v4M9 1v4M15 1v4" /></svg>);
const ApprovalIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const EmployeesIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
const MasterDataIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>);
const KPIIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>);
const AssessmentIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const ReportIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);
const ListIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>);
const AddIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const ImportIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>);
const CompetencyIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>);
const AspectIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>);
const RangeIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>);
const DataIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>);
const SettingIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const PeriodIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const InputIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const ActiveIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const HistoryIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const ExportIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>);
const ProfileIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const LogoutIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);

const NavSkeleton = () => (
  <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
    <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse hidden sm:block" />
      </div>
      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
    </div>
  </nav>
);