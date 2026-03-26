// app/mobile/attendance/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, Timestamp } from "firebase/firestore";

export default function MobileAttendancePage() {
  const { user } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [radiusInfo, setRadiusInfo] = useState<{ radius: number; distance: number } | null>(null);

  useEffect(() => {
    if (user) {
      checkLocation();
      loadTodayAttendance();
    }
  }, [user]);

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const currentLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(currentLoc);
          
          // Get office setting
          const settingDoc = await getDoc(doc(db, "settings", "office"));
          if (settingDoc.exists()) {
            const data = settingDoc.data();
            const distance = getDistance(
              currentLoc.lat,
              currentLoc.lng,
              data.lat,
              data.lng
            );
            setRadiusInfo({ radius: data.radius, distance });
            setIsWithinRadius(distance <= data.radius);
          } else {
            setIsWithinRadius(true);
          }
        },
        (error) => {
          console.error("Location error:", error);
          setIsWithinRadius(true);
        }
      );
    } else {
      setIsWithinRadius(true);
    }
  };

  const loadTodayAttendance = async () => {
    if (!user) return;
    const today = new Date();
    const docId = `${user.uid}_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    const docRef = doc(db, "attendance", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setTodayAttendance(docSnap.data());
    }
  };

  const handleCheckIn = async () => {
    if (!isWithinRadius) {
      alert("Anda berada di luar radius absensi!");
      return;
    }
    if (!location) {
      alert("Lokasi tidak ditemukan!");
      return;
    }

    setIsLoading(true);
    try {
      const today = new Date();
      const docId = `${user?.uid}_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
      const docRef = doc(db, "attendance", docId);
      const docSnap = await getDoc(docRef);
      
      const checkInData = {
        checkIn: {
          time: Timestamp.now(),
          lat: location.lat,
          lng: location.lng,
        },
      };
      
      if (!docSnap.exists()) {
        // Jika dokumen belum ada, buat baru dengan setDoc
        await setDoc(docRef, {
          uid: user?.uid,
          name: user?.name,
          date: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate())),
          ...checkInData,
          createdAt: Timestamp.now(),
        });
      } else {
        // Jika sudah ada, update saja
        await updateDoc(docRef, checkInData);
      }
      
      alert("✅ Check-in berhasil!");
      loadTodayAttendance();
    } catch (error: any) {
      console.error("Check-in error:", error);
      alert("❌ Gagal check-in: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const docId = `${user?.uid}_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
      const docRef = doc(db, "attendance", docId);
      
      await updateDoc(docRef, {
        checkOut: {
          time: Timestamp.now(),
          lat: location?.lat,
          lng: location?.lng,
        },
      });
      
      alert("✅ Check-out berhasil!");
      loadTodayAttendance();
    } catch (error: any) {
      alert("❌ Gagal check-out: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isCheckedIn = todayAttendance?.checkIn;
  const isCheckedOut = todayAttendance?.checkOut;

  return (
    <div className="space-y-5">
      {/* Location Status */}
      <div className={`rounded-2xl p-4 ${isWithinRadius ? "bg-green-500/20" : "bg-red-500/20"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isWithinRadius ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <p className="text-white text-sm">
            {isWithinRadius ? "✓ Dalam radius absensi" : "✗ Di luar radius absensi"}
          </p>
        </div>
        {radiusInfo && (
          <p className="text-white/60 text-xs mt-2">
            📍 Jarak: {radiusInfo.distance.toFixed(0)}m / {radiusInfo.radius}m
          </p>
        )}
        {location && (
          <p className="text-white/40 text-[10px] mt-1">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
        <button 
          onClick={checkLocation}
          className="mt-3 text-xs text-white/60 underline"
        >
          ↻ Refresh lokasi
        </button>
      </div>

      {/* Attendance Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <p className="text-gray-500 text-sm">Hari ini</p>
          <p className="text-2xl font-bold text-gray-800">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <div className="flex justify-between items-center gap-4">
          <div className="flex-1 text-center p-4 bg-gray-50 rounded-2xl">
            <span className="text-3xl mb-2 block">📥</span>
            <p className="text-sm text-gray-500">Check-in</p>
            <p className="text-xl font-bold text-gray-800">
              {todayAttendance?.checkIn?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || "--:--"}
            </p>
          </div>
          <div className="flex-1 text-center p-4 bg-gray-50 rounded-2xl">
            <span className="text-3xl mb-2 block">📤</span>
            <p className="text-sm text-gray-500">Check-out</p>
            <p className="text-xl font-bold text-gray-800">
              {todayAttendance?.checkOut?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || "--:--"}
            </p>
          </div>
        </div>

        {!isCheckedOut && (
          <button
            onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
            disabled={isLoading || (!isWithinRadius && !isCheckedIn)}
            className={`
              w-full mt-6 py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-95
              ${isCheckedIn 
                ? "bg-orange-500 active:bg-orange-600" 
                : "bg-green-600 active:bg-green-700"}
              ${(!isWithinRadius && !isCheckedIn) && "opacity-50 active:scale-100"}
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              isCheckedIn ? "Check-out" : "Check-in"
            )}
          </button>
        )}

        {isCheckedOut && (
          <div className="mt-6 p-4 bg-green-50 rounded-2xl text-center">
            <p className="text-green-600 font-medium">✓ Anda sudah menyelesaikan absensi hari ini</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-white/10 rounded-2xl p-4">
        <p className="text-white/70 text-xs text-center">
          Pastikan GPS aktif dan berada di lokasi kantor untuk melakukan absensi
        </p>
      </div>
    </div>
  );
}