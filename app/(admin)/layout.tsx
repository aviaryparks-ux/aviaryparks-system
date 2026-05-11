// app/(admin)/layout.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import Sidebar from "@/components/layout/Sidebar";
import Image from "next/image";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR",
      manager: "Manager",
      spv: "Supervisor",
      employee: "Employee",
      finance: "Finance",
    };
    return labels[role] || role;
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out forwards;
        }
        .footer-glass {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(34, 197, 94, 0.1);
        }
        .status-dot {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/30 to-blue-50/30">
        <TopNav />

        <div className="flex">
          <div className="hidden md:block">
            <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          </div>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative w-72 h-full bg-white shadow-2xl animate-slide-up">
                <Sidebar collapsed={false} onClose={() => setMobileMenuOpen(false)} />
              </div>
            </div>
          )}

          <main className="flex-1 min-h-screen">
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="max-w-full mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="footer-glass mt-auto py-5 px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Logo & Copyright */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 relative">
                <Image
                  src="/images/aviralogo.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                  sizes="36px"
                />
              </div>
              <span className="text-sm text-slate-500">
                © {new Date().getFullYear()} AviaryParks Management System
              </span>
            </div>

            {/* Info Pills */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {/* Date */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-slate-600">{currentDate}</span>
              </div>

              <div className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />

              {/* Time */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-slate-600">{currentTime}</span>
              </div>

              <div className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />

              {/* Version */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="text-xs font-medium text-emerald-700">v2.0</span>
              </div>

              <div className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />

              {/* User Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500 status-dot" />
                <span className="text-xs text-slate-500">Logged in as</span>
                <span className="text-xs font-semibold text-emerald-700">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}