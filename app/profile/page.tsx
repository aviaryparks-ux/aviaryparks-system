// app/mobile/profile/page.tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function MobileProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-800">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      {/* Profile Card */}
      <div className="bg-white rounded-3xl p-6 text-center">
        <div className="w-24 h-24 mx-auto bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <span className="text-white text-4xl font-bold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
        <p className="text-gray-500 text-sm mt-1 break-all">{user?.email}</p>
        <div className="mt-3 inline-block px-3 py-1 bg-purple-100 rounded-full">
          <span className="text-purple-600 text-xs font-medium">
            {user?.role === "super_admin" ? "Super Admin" : 
             user?.role === "admin" ? "Admin" :
             user?.role === "hr" ? "HR" :
             user?.role === "manager" ? "Manager" :
             user?.role === "spv" ? "Supervisor" : "Employee"}
          </span>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white/10 rounded-2xl p-4">
        <div className="flex justify-between items-center py-2">
          <span className="text-white/70 text-sm">Department</span>
          <span className="text-white font-medium">{user?.department || "-"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-t border-white/20">
          <span className="text-white/70 text-sm">Position</span>
          <span className="text-white font-medium">{user?.jabatan || "-"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-t border-white/20">
          <span className="text-white/70 text-sm">Phone</span>
          <span className="text-white font-medium">{user?.phone || "-"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-t border-white/20">
          <span className="text-white/70 text-sm">Bergabung</span>
          <span className="text-white font-medium">{user?.joinDate || "-"}</span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full py-4 bg-red-500/20 text-red-400 font-bold rounded-2xl active:scale-95 transition-all"
      >
        Logout
      </button>

      {/* Version */}
      <p className="text-center text-white/40 text-xs pt-4">
        AviaryParks Attendance v2.0
      </p>
    </div>
  );
}