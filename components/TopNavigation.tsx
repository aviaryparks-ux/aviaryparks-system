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
};

export default function TopNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const allMenus: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      allowedRoles: ["super_admin", "admin", "hr", "manager", "spv", "employee"],
    },
    {
      name: "Attendance",
      path: "/attendance",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      allowedRoles: ["super_admin", "admin", "hr", "manager", "spv", "employee"],
    },
    {
      name: "Corrections",
      path: "/attendance-corrections",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      allowedRoles: ["super_admin", "hr", "manager", "spv"],
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
      name: "Settings",
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
      name: "Approval",
      path: "/approval-flow",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      allowedRoles: ["super_admin"],
    },
  ];

  const getFilteredMenus = () => {
    if (!user) return [];
    return allMenus.filter(menu => menu.allowedRoles.includes(user.role));
  };

  const filteredMenus = getFilteredMenus();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActivePath = (path: string) => pathname === path;

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
    };
    return labels[role] || "Employee";
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading || !user) {
    return (
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
  }

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-50">
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
              <span className="text-xs text-gray-400 hidden lg:block">| Attendance System</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {filteredMenus.map((menu) => (
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
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Role Badge */}
            <div className="hidden sm:block">
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {getRoleLabel(user.role)}
              </span>
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none group"
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border-2 border-green-500 shadow-sm transition-all group-hover:scale-105"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-sm transition-all group-hover:scale-105">
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
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in">
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
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </Link>
                  </div>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-gray-200">
            {filteredMenus.map((menu) => (
              <Link
                key={menu.name}
                href={menu.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
                  ${isActivePath(menu.path)
                    ? "bg-green-50 text-green-700"
                    : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                <span className="w-5 h-5">{menu.icon}</span>
                <span>{menu.name}</span>
              </Link>
            ))}
            <div className="border-t border-gray-200 my-2" />
            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </nav>
  );
}