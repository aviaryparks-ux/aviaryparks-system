// components/layout/TopNav.backup.tsx
// BACKUP VERSION - Old TopNav before redesign
// Date: 2026-05-07
// This file can be deleted after confirming the new TopNav works well

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MenuIcon, NotificationIcon } from "@/components/icons/MenuIcons";
import Image from "next/image";

interface TopNavProps {
  onMenuClick: () => void;
  onMobileMenuClick: () => void;
}

export default function TopNav({ onMenuClick, onMobileMenuClick }: TopNavProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Pengajuan baru", message: "Handi mengajukan cuti", isRead: false, time: "5 menit lalu" },
    { id: 2, title: "Koreksi absensi", message: "Koreksi menunggu approval", isRead: false, time: "1 jam lalu" },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

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

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left section - Hamburger menu */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="hidden md:flex p-2.5 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-all"
          >
            <MenuIcon />
          </button>
          <button
            onClick={onMobileMenuClick}
            className="flex md:hidden p-2.5 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-all"
          >
            <MenuIcon />
          </button>

          {/* Mobile logo (only visible on mobile) */}
          <div className="flex md:hidden items-center gap-2">
            <div className="relative w-8 h-8">
              <Image
                src="/images/logo-aviarypark.svg"
                alt="AviaryPark Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-bold text-slate-800 text-sm">AviaryParks</span>
          </div>
        </div>

        {/* Center - Logo and Title (DESKTOP) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="relative w-12 h-12">
            <Image
              src="/images/logo-aviarypark.svg"
              alt="AviaryPark Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="flex flex-col">
            <span className="text-lg font-bold text-slate-800 tracking-tight">
              AviaryPark Management System
            </span>
            <span className="text-xs text-emerald-600 font-medium">Smart Park - Smart Management</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <span className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200/50 shadow-sm">
              {getRoleLabel(user.role)}
            </span>
          </div>

          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2.5 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-all"
            >
              <NotificationIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 overflow-hidden z-50 animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100/50 bg-gradient-to-r from-gray-50 to-white">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Notifikasi
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-slate-500 font-medium">Tidak ada notifikasi</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-5 border-b border-gray-50/50 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.isRead ? "bg-emerald-50/30" : ""}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-2.5 h-2.5 mt-2 rounded-full flex-shrink-0 ${!notif.isRead ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {notif.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-gray-200"
            >
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-200 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="text-white text-sm font-bold">{getInitials(user.name)}</span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 hidden sm:block ${isUserDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-3 w-72 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 overflow-hidden z-50 animate-slide-up">
                <div className="p-5 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border-b border-gray-100/50">
                  <div className="flex items-center gap-4">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt={user.name} className="w-14 h-14 rounded-xl object-cover shadow-lg" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                        <span className="text-white text-lg font-bold">{getInitials(user.name)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setIsUserDropdownOpen(false)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    My Profile
                  </Link>
                </div>

                <div className="p-2 border-t border-gray-100/50">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.2s ease-out forwards;
        }
      `}</style>
    </header>
  );
}
