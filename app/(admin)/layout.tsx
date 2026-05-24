// app/(admin)/layout.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import Sidebar from "@/components/layout/Sidebar";
import LoadingScreen from "@/components/ui/LoadingScreen";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setSidebarCollapsed(saved === "true");
    }
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
    return <LoadingScreen message="Memuat sistem..." size={220} />;
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#f8fafc] print:bg-white overflow-hidden print:overflow-visible print:h-auto print:block">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block flex-shrink-0 z-20 print:hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Sidebar - Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 h-full bg-white shadow-2xl">
            <Sidebar collapsed={false} onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block">
        {/* Top Navigation */}
        <div className="print:hidden">
          <TopNav onMobileMenuClick={() => setMobileMenuOpen(true)} />
        </div>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto print:overflow-visible print:block bg-[#f8fafc] print:bg-white">
          <div className="p-4 sm:p-6 lg:p-8 print:p-0 print:m-0">
            <div className="max-w-[1600px] mx-auto print:max-w-none print:w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}