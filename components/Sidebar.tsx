// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Definisi menu dengan role yang diizinkan
  const allMenus = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      allowedRoles: ["super_admin", "admin", "hr", "spv", "employee"],
    },
    {
      name: "Attendance",
      path: "/attendance",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      allowedRoles: ["super_admin", "admin", "hr", "spv", "employee"],
    },
    {
      name: "Attendance Corrections",
      path: "/attendance-corrections",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      allowedRoles: ["super_admin", "admin", "hr", "spv"],
    },
    {
      name: "Users",
      path: "/users",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      allowedRoles: ["super_admin", "hr"],
    },
    {
      name: "Settings Lokasi",
      path: "/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      allowedRoles: ["super_admin"],
    },
    {
      name: "Approval Flow",
      path: "/approval-flow",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      allowedRoles: ["super_admin"],
    },
  ];

  // Filter menu berdasarkan role user yang login
  const getFilteredMenu = () => {
    if (!user) return [];
    return allMenus.filter(menu => menu.allowedRoles.includes(user.role));
  };

  const filteredMenu = getFilteredMenu();

  // Jika loading atau belum ada user, tampilkan skeleton
  if (loading || !user) {
    return (
      <aside className="w-64 bg-gradient-to-br from-gray-900 to-gray-800 flex-shrink-0">
        <div className="p-6 border-b border-gray-700">
          <div className="h-8 w-32 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside 
      className={`
        bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 
        text-white flex-shrink-0 shadow-2xl flex flex-col h-full
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Logo Section */}
      <div className={`relative px-6 py-6 border-b border-white/10 ${isCollapsed ? "px-2" : "px-6"}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-green-500 rounded-2xl blur-lg opacity-50 animate-pulse" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                WEB ADMIN
              </h1>
              <p className="text-[10px] text-gray-400">Attendance System</p>
            </div>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600
            flex items-center justify-center shadow-lg
            transition-all duration-200
            ${isCollapsed ? "rotate-180" : ""}
          `}
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation - Menu yang sudah difilter sesuai role */}
      <nav className="flex-1 px-3 py-6 overflow-y-auto">
        <div className="space-y-1">
          {filteredMenu.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  flex items-center gap-3 rounded-xl transition-all duration-200 group relative
                  ${isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3"}
                  ${
                    isActive
                      ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-600/20"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }
                `}
                title={isCollapsed ? item.name : ""}
              >
                <span className={`transition-colors flex-shrink-0 ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
                {isActive && !isCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                )}
                {isActive && isCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-500 rounded-r-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer - Role Info */}
      <div className={`p-4 border-t border-white/10 ${isCollapsed ? "text-center" : ""}`}>
        {!isCollapsed ? (
          <div className="text-center">
            <p className="text-[10px] text-gray-500">
              Logged in as: 
              <span className="text-green-400 ml-1">
                {user.role === "super_admin" ? "Super Admin" : 
                 user.role === "admin" ? "Admin" :
                 user.role === "hr" ? "HR" :
                 user.role === "spv" ? "Supervisor" : "Employee"}
              </span>
            </p>
            <p className="text-[10px] text-gray-600 mt-1">v2.0</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-8 h-8 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-xs text-green-400">
                {user.role === "super_admin" ? "SA" : 
                 user.role === "admin" ? "AD" :
                 user.role === "hr" ? "HR" :
                 user.role === "spv" ? "SV" : "EM"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Custom Scrollbar */}
      <style jsx>{`
        nav::-webkit-scrollbar {
          width: 4px;
        }
        nav::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        nav::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        nav::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </aside>
  );
}