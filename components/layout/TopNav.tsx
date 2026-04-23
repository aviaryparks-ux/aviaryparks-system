// components/layout/TopNav.tsx
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
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
        {/* Left section - Hamburger menu */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <MenuIcon />
          </button>
          <button
            onClick={onMobileMenuClick}
            className="flex md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <MenuIcon />
          </button>
          
          {/* Mobile logo (only visible on mobile) */}
          <div className="flex md:hidden items-center gap-2">
            <div className="relative w-7 h-7">
              <Image
                src="/images/logo-aviarypark.svg"
                alt="AviaryPark Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-semibold text-gray-800 text-sm">AviaryParks</span>
          </div>
        </div>

        {/* Center - Logo and Title (DESKTOP) */}
        <div className="hidden md:flex items-center gap-3">
          {/* 🔥 LOGO SVG ANDA */}
          <div className="relative w-10 h-10">
            <Image
              src="/images/logo-aviarypark.svg"
              alt="AviaryPark Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          
          {/* Title */}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800">
              AviaryPark Management System
            </span>
            <span className="text-xs text-gray-400">Smart Park - Smart Management</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {getRoleLabel(user.role)}
            </span>
          </div>

          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <NotificationIcon />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Notifikasi</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-green-600 hover:text-green-700"
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      Tidak ada notifikasi
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.isRead ? "bg-green-50/30" : ""}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-2">{notif.time}</p>
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
              className="flex items-center gap-2 focus:outline-none group"
            >
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-green-500"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{getInitials(user.name)}</span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 hidden sm:block ${isUserDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsUserDropdownOpen(false)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </Link>
                </div>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}