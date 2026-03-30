// app/mobile/layout.tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (user) {
      loadUserData();
    }
  }, [user, loading, router]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setPhotoUrl(data.photoUrl || null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-800">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { name: "Absensi", path: "/mobile/attendance", icon: "📸" },
    { name: "Koreksi", path: "/mobile/correction", icon: "✏️" },
    { name: "Riwayat", path: "/mobile/history", icon: "📋" },
    { name: "Profil", path: "/mobile/profile", icon: "👤" },
  ];

  // Ambil nama depan untuk display
  const displayName = userData?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 pb-20">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-white text-xl font-bold">AviaryPark</h1>
            <p className="text-green-200 text-xs">Managemant System</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/70 text-xs">{displayName}</span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center overflow-hidden">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-sm">
                  {userData?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">{children}</div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 safe-bottom">
        <div className="flex justify-around py-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  flex flex-col items-center py-2 px-4 rounded-xl transition-all
                  ${isActive 
                    ? "text-green-600 bg-green-50" 
                    : "text-gray-500 hover:text-green-600"
                  }
                `}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs mt-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
}