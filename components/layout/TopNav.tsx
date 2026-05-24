// components/layout/TopNav.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationIcon } from "@/components/icons/MenuIcons";

interface TopNavProps {
  onMobileMenuClick?: () => void;
}

export default function TopNav({ onMobileMenuClick }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState([
    { id: 1, title: "Pengajuan baru", message: "Handi mengajukan cuti", isRead: false, time: "5 menit lalu" },
    { id: 2, title: "Koreksi absensi", message: "Koreksi menunggu approval", isRead: false, time: "1 jam lalu" },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPageTitle = (path: string) => {
    if (path === "/dashboard") return "Dashboard";
    if (path.includes("/manager-on-duty")) return "Manager on Duty";
    if (path.includes("/attendance-corrections")) return "Koreksi Kehadiran";
    if (path.includes("/attendance-settings")) return "Pengaturan Absensi";
    if (path.includes("/attendance")) return "Absensi";
    if (path.includes("/users")) return "Data Pegawai";
    if (path.includes("/shifts")) return "Manajemen Shift";
    if (path.includes("/payroll")) return "Payroll";
    if (path.includes("/internal-memo")) {
      if (path.includes("/create")) return "Buat Memo Baru";
      if (path.split("/").length > 2) return "Detail Memo";
      return "Internal Memo";
    }
    return path.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Page";
  };

  const pageTitle = getPageTitle(pathname);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 glass-enterprise">
      <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
        
        {/* Left: Mobile Menu & Page Title */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onMobileMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-200/50 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{pageTitle}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
              <span>Home</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-slate-600">{pageTitle}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 lg:gap-6">
          
          {/* Date Picker Mockup */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 shadow-sm cursor-pointer hover:border-emerald-300 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <svg className="w-4 h-4 text-slate-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
            >
              <NotificationIcon />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#f8fafc]">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {/* Notif Dropdown (Simplified) */}
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800">Notifikasi</h3>
                  <button onClick={() => setNotifications([])} className="text-xs text-emerald-600 font-medium">Tandai dibaca</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                      <p className="text-sm font-medium text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 hidden sm:block" />

          {/* User Profile */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shadow-sm">
                <span className="text-white text-sm font-bold">{getInitials(user.name)}</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                  {user.name}
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </p>
                <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                <div className="p-2">
                  <Link href="/profile" onClick={() => setIsUserDropdownOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 rounded-lg font-medium transition-colors">
                    My Profile
                  </Link>
                  <div className="h-px bg-slate-100 my-1" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
