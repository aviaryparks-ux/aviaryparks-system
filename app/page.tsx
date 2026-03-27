"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loadingText, setLoadingText] = useState("Checking login...");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const messages = [
      "Checking login...",
      "Verifying credentials...",
      "Loading dashboard...",
      "Redirecting..."
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingText(messages[index]);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setIsReady(true);

      if (user) {
        try {
          // Ambil data user dari Firestore untuk mengetahui role
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const userData = userDoc.data();
          const role = userData?.role || "employee";
          
          // Role yang diizinkan untuk web admin
          const adminRoles = ["super_admin", "admin", "hr", "spv"];
          
          if (adminRoles.includes(role)) {
            router.replace("/dashboard");
          } else {
            // Employee, Training, Intern langsung ke mobile PWA
            router.replace("/mobile/attendance");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          // Fallback: jika error, arahkan ke login
          router.replace("/login");
        }
      } else {
        router.replace("/login");
      }
    });

    return () => unsub();
  }, [router]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{loadingText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Redirecting...</p>
      </div>
    </div>
  );
}