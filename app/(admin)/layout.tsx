// app/(admin)/layout.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import Sidebar from "@/components/layout/Sidebar";

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

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  // Update date and time
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

  // Save sidebar state
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <TopNav
        onMenuClick={toggleSidebar}
        onMobileMenuClick={() => setMobileMenuOpen(true)}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 h-full bg-white shadow-xl animate-slide-in-left">
              <Sidebar collapsed={false} onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-full mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Footer with Glassmorphism */}
      <footer className="relative mt-12 border-t border-gray-200/50 bg-white/80 backdrop-blur-sm py-5 px-6">
        <div className="absolute inset-0 bg-gradient-to-r from-green-50/30 to-transparent"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-gray-500">
              © {new Date().getFullYear()} AviaryParks Management System
            </span>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">📅</span>
              <span className="text-gray-500">{currentDate}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
            <div className="flex items-center gap-1">
              <span className="text-gray-400">⏰</span>
              <span className="text-gray-500">{currentTime}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
            <div className="flex items-center gap-1">
              <span className="text-gray-400">📌</span>
              <span className="text-gray-500">v2.0</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-500">Logged in as</span>
              <span className="font-medium text-green-700">
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}