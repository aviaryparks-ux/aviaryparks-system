// app/mobile/attendance/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import("react-leaflet").then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });

export default function Page() {
  const { user } = useAuth();
  
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [location, setLocation] = useState<any>(null);
  const [officeLocations, setOfficeLocations] = useState<any[]>([]);
  const [matchedLocation, setMatchedLocation] = useState<any>(null);
  const [distance, setDistance] = useState(0);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [uploadProgress, setUploadProgress] = useState(0);

  // 🔥 STATE UNTUK SHIFT DARI JADWAL
  const [scheduledShift, setScheduledShift] = useState<any>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadOffice();
    if (user) {
      loadTodayAttendance();
      loadHistory();
      loadScheduledShift(); // 🔥 Load shift dari jadwal
    }
  }, [user]);

  // 🔥 FUNGSI UNTUK MENGAMBIL SHIFT DARI shift_schedules
  // 🔥 FUNGSI UNTUK MENGAMBIL SHIFT DARI shift_schedules
// app/mobile/attendance/page.tsx

const loadScheduledShift = async () => {
  if (!user) return;
  
  setIsLoadingShift(true);
  setShiftError(null);
  
  try {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const scheduleId = `${user.uid}_${dateStr}`;
    
    console.log("🔍 Mencari jadwal shift:", scheduleId);
    
    const scheduleDoc = await getDoc(doc(db, "shift_schedules", scheduleId));
    
    if (scheduleDoc.exists()) {
      const scheduleData = scheduleDoc.data();
      console.log("📄 Data schedule:", scheduleData);
      
      let shiftData = null;
      let shiftDocId = null;
      
      // 🔥 CARI BERDASARKAN NAMA SHIFT (bukan ID)
      if (scheduleData.shiftName) {
        console.log("🔍 Mencari shift berdasarkan nama:", scheduleData.shiftName);
        
        const shiftsQuery = query(
          collection(db, "shifts"), 
          where("name", "==", scheduleData.shiftName),
          where("isActive", "==", true)
        );
        
        const shiftsSnap = await getDocs(shiftsQuery);
        
        if (!shiftsSnap.empty) {
          const shiftDoc = shiftsSnap.docs[0];
          shiftData = shiftDoc.data();
          shiftDocId = shiftDoc.id;
          console.log("✅ Shift ditemukan berdasarkan nama:", shiftData.name, "dengan ID:", shiftDocId);
        } else {
          console.log("❌ Shift tidak ditemukan dengan nama:", scheduleData.shiftName);
        }
      }
      
      // Jika masih tidak ditemukan, coba berdasarkan shiftId (fallback)
      if (!shiftData && scheduleData.shiftId) {
        console.log("🔍 Mencoba mencari berdasarkan shiftId:", scheduleData.shiftId);
        const shiftDoc = await getDoc(doc(db, "shifts", scheduleData.shiftId));
        if (shiftDoc.exists()) {
          shiftData = shiftDoc.data();
          shiftDocId = shiftDoc.id;
          console.log("✅ Shift ditemukan berdasarkan ID:", shiftData.name);
        }
      }
      
      if (shiftData) {
        setScheduledShift({
          id: shiftDocId,
          name: shiftData.name,
          code: shiftData.code,
          startTime: shiftData.startTime,
          endTime: shiftData.endTime,
          color: shiftData.color,
          lateTolerance: shiftData.lateTolerance || 15,
        });
        console.log("✅ Shift berhasil dimuat:", shiftData.name);
      } else {
        setShiftError(`Shift "${scheduleData.shiftName}" tidak ditemukan di database`);
      }
    } else {
      console.log("❌ Tidak ada jadwal shift untuk ID:", scheduleId);
      setShiftError(`Tidak ada jadwal shift untuk tanggal ${dateStr}`);
    }
  } catch (error) {
    console.error("❌ Error loading shift:", error);
    setShiftError("Gagal memuat jadwal shift");
  } finally {
    setIsLoadingShift(false);
  }
};

  const loadOffice = async () => {
    const q = query(collection(db, "settings"), where("isActive", "==", true));
    const snap = await getDocs(q);
    setOfficeLocations(snap.docs.map(d => d.data()));
  };

  const loadTodayAttendance = async () => {
    if (!user) return;
    const today = new Date();
    const docId = user.uid + "_" + today.toISOString().slice(0, 10);
    const snap = await getDoc(doc(db, "attendance", docId));
    if (snap.exists()) {
      setTodayAttendance(snap.data());
    } else {
      setTodayAttendance(null);
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    
    try {
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        orderBy("date", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      const historyData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(historyData);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "--:--";
    return timestamp.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "--";
    return timestamp.toDate().toLocaleDateString("id-ID", { 
      weekday: "long", 
      day: "numeric", 
      month: "long",
      year: "numeric"
    });
  };

  const formatShortDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "--";
    return timestamp.toDate().toLocaleDateString("id-ID", { 
      day: "numeric", 
      month: "short" 
    });
  };

  const calculateWorkHours = (checkIn: any, checkOut: any) => {
    if (!checkIn?.time || !checkOut?.time) return "-";
    const masuk = checkIn.time.toDate();
    const pulang = checkOut.time.toDate();
    const diffMs = pulang.getTime() - masuk.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0 && minutes === 0) return "-";
    if (hours === 0) return `${minutes} menit`;
    if (minutes === 0) return `${hours} jam`;
    return `${hours} jam ${minutes} menit`;
  };

  const isCheckedIn = todayAttendance?.checkIn;
  const isCheckedOut = todayAttendance?.checkOut;

  const uploadPhotoToStorage = async (base64Data: string): Promise<string> => {
    if (!user) throw new Error("User not found");
    
    const timestamp = Date.now();
    const fileName = `${user.uid}_${timestamp}.jpg`;
    const storageRef = ref(storage, `attendance/${fileName}`);
    
    let imageData = base64Data;
    if (base64Data.includes("base64,")) {
      imageData = base64Data.split("base64,")[1];
    }
    
    await uploadString(storageRef, imageData, "base64");
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  const switchCamera = async () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);
    
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Switch camera error:", err);
    }
  };

  const startCamera = async () => {
    if (!scheduledShift && !isCheckedIn) {
      alert(shiftError || "Tidak ada jadwal shift untuk hari ini. Silakan hubungi admin.");
      return;
    }

    if (stream) stream.getTracks().forEach(t => t.stop());

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
      });

      setStream(s);
      setShowCamera(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      alert("Izin kamera diperlukan");
    }
  };

  const takePhoto = () => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    const maxWidth = 720;
    const scale = maxWidth / video.videoWidth;

    canvas.width = maxWidth;
    canvas.height = video.videoHeight * scale;

    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.7);

    setPhotoUri(image);

    stream?.getTracks().forEach(t => t.stop());
    setShowCamera(false);

    getLocation();
  };

  const getDistance = (a: any, b: any) => {
    const R = 6371e3;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) *
      Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const getLocation = () => {
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setLocation(userLoc);

        let nearest = null;
        let min = Infinity;

        for (const loc of officeLocations) {
          const d = getDistance(userLoc, loc);
          if (d < min) {
            min = d;
            nearest = loc;
          }
        }

        setMatchedLocation(nearest);
        setDistance(min);
        setIsWithinRadius(min <= nearest?.radius);
        setShowMap(true);
        setIsLoadingLocation(false);
      },
      (err) => {
        console.error("GPS Error:", err);
        alert("GPS tidak aktif, nyalakan GPS untuk absensi");
        setIsLoadingLocation(false);
      }
    );
  };

  const refreshLocation = () => {
    getLocation();
  };

  // 🔥 SAVE ATTENDANCE - SEKARANG MENYIMPAN SHIFT!
  const saveAttendance = async () => {
    if (!user) {
      alert("User tidak ditemukan, silakan login ulang");
      return;
    }

    if (!isWithinRadius) {
      alert("Anda berada di luar radius kantor!");
      return;
    }

    if (!photoUri) {
      alert("Foto belum diambil!");
      return;
    }

    if (!location) {
      alert("Lokasi tidak ditemukan!");
      return;
    }

    // 🔥 Validasi shift untuk check-in
    if (!isCheckedIn && !scheduledShift) {
      alert(shiftError || "Tidak ada jadwal shift untuk hari ini. Silakan hubungi admin.");
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);

    try {
      const photoUrl = await uploadPhotoToStorage(photoUri);
      
      const today = new Date();
      const docId = user.uid + "_" + today.toISOString().slice(0, 10);
      const ref = doc(db, "attendance", docId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // 🔥 CHECK-IN: SIMPAN SHIFT KE DATABASE
        await setDoc(ref, {
          uid: user.uid,
          name: user.name,
          date: Timestamp.fromDate(today),
          shift: {  // 🔥 INI YANG PALING PENTING!
            id: scheduledShift.id,
            name: scheduledShift.name,
            code: scheduledShift.code,
            startTime: scheduledShift.startTime,
            endTime: scheduledShift.endTime,
            color: scheduledShift.color,
            lateTolerance: scheduledShift.lateTolerance || 15,
          },
          checkIn: {
            time: Timestamp.now(),
            photo: photoUrl,
            lat: location.lat,
            lng: location.lng,
          },
          officeLocation: matchedLocation ? {
            name: matchedLocation.name,
            lat: matchedLocation.lat,
            lng: matchedLocation.lng,
            radius: matchedLocation.radius,
          } : null,
          distance: distance,
          isWithinRadius: isWithinRadius,
          createdAt: Timestamp.now(),
        });
        alert("✅ Check-in berhasil!");
      } else if (!snap.data()?.checkOut) {
        // 🔥 CHECK-OUT: UPDATE TANPA MENGUBAH SHIFT
        await updateDoc(ref, {
          checkOut: {
            time: Timestamp.now(),
            photo: photoUrl,
            lat: location.lat,
            lng: location.lng,
          },
          updatedAt: Timestamp.now(),
        });
        alert("✅ Check-out berhasil!");
      } else {
        alert("Anda sudah melakukan absensi lengkap hari ini");
      }

      await loadTodayAttendance();
      await loadHistory();
      setShowMap(false);
      setPhotoUri(null);
      setLocation(null);
      setMatchedLocation(null);
    } catch (error) {
      console.error("Save error:", error);
      alert("❌ Gagal menyimpan absensi: " + error);
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 p-4">
      {/* Main Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 max-w-md mx-auto border border-white/20 mb-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-3xl">📸</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Absensi Lokasi</h1>
          <p className="text-gray-500 text-sm mt-1">{formattedDate}</p>
        </div>

        {/* Status Absensi */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCheckedIn ? "bg-green-100" : "bg-gray-200"}`}>
                <span className="text-xl">📥</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check-in</p>
                <p className="font-semibold text-gray-800">
                  {isCheckedIn ? formatTime(isCheckedIn.time) : "Belum absen"}
                </p>
              </div>
            </div>
            {isCheckedIn?.photo && (
              <img src={isCheckedIn.photo} className="w-10 h-10 rounded-full object-cover ring-2 ring-green-300" />
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCheckedOut ? "bg-blue-100" : "bg-gray-200"}`}>
                <span className="text-xl">📤</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check-out</p>
                <p className="font-semibold text-gray-800">
                  {isCheckedOut ? formatTime(isCheckedOut.time) : "Belum absen"}
                </p>
              </div>
            </div>
            {isCheckedOut?.photo && (
              <img src={isCheckedOut.photo} className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-300" />
            )}
          </div>
        </div>

        {/* 🔥 TAMPILKAN SHIFT YANG DIJADWALKAN */}
        {!isCheckedIn && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">📋</span>
              <span className="text-sm font-medium text-blue-700">Shift Hari Ini (dari jadwal)</span>
            </div>
            {isLoadingShift ? (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scheduledShift ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{scheduledShift.name}</p>
                  <p className="text-xs text-gray-600">
                    {scheduledShift.startTime} - {scheduledShift.endTime}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Toleransi: {scheduledShift.lateTolerance} menit
                  </p>
                </div>
                <div 
                  className="w-8 h-8 rounded-full" 
                  style={{ backgroundColor: scheduledShift.color }}
                />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-red-600">{shiftError || "Tidak ada jadwal shift"}</p>
                <p className="text-xs text-gray-500 mt-1">Silakan hubungi admin untuk penjadwalan</p>
              </div>
            )}
          </div>
        )}

        {/* Tombol Absen */}
        {!isCheckedOut ? (
          <button
            onClick={startCamera}
            disabled={(!scheduledShift && !isCheckedIn) || isLoadingShift}
            className={`w-full py-4 font-bold rounded-2xl shadow-lg transition-all ${
              (scheduledShift || isCheckedIn)
                ? "bg-gradient-to-r from-green-600 to-green-700 text-white hover:shadow-xl active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isLoadingShift ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Memuat jadwal...</span>
              </div>
            ) : isCheckedIn ? (
              "📤 Ambil Foto Check-out"
            ) : (
              "📸 Ambil Foto Check-in"
            )}
          </button>
        ) : (
          <div className="text-center p-4 bg-green-100 rounded-2xl">
            <p className="text-green-700 font-medium">✅ Absensi selesai hari ini</p>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Pastikan GPS aktif dan berada di lokasi kantor
        </p>
      </div>

      {/* HISTORY SECTION */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 max-w-md mx-auto border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="text-xl">📋</span>
            Riwayat Absensi
          </h2>
          <button onClick={loadHistory} className="text-green-600 text-sm hover:text-green-700">
            Refresh
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-4">
                <div className="h-12 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500">Belum ada riwayat absensi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => {
              const date = item.date?.toDate();
              const checkIn = item.checkIn;
              const checkOut = item.checkOut;
              const workHours = calculateWorkHours(checkIn, checkOut);
              const isComplete = checkIn && checkOut;
              const shift = item.shift;
              
              return (
                <div key={item.id || index} className={`p-3 rounded-xl ${isComplete ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">
                        {date?.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      {shift && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }} />
                          <span className="text-xs text-gray-500">Shift: {shift.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono">
                        {checkIn ? formatTime(checkIn.time) : "--:--"} - {checkOut ? formatTime(checkOut.time) : "--:--"}
                      </p>
                      {workHours !== "-" && <p className="text-xs text-gray-500">{workHours}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative h-full">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            <button onClick={switchCamera} className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm text-white p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <button onClick={takePhoto} className="w-full py-4 bg-white text-green-700 font-bold rounded-2xl">
                📸 Ambil Foto
              </button>
              <button onClick={() => { if (stream) stream.getTracks().forEach(t => t.stop()); setShowCamera(false); }} className="w-full mt-3 py-3 bg-gray-500/80 text-white font-bold rounded-2xl">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && photoUri && location && matchedLocation && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-center flex-1">{isCheckedIn ? "Check-out" : "Check-in"}</h2>
              <button onClick={refreshLocation} className="bg-white/20 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <img src={photoUri} alt="Preview" className="w-full rounded-xl" />
              {scheduledShift && !isCheckedIn && (
                <div className="mt-3 text-center">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                    Shift: {scheduledShift.name} ({scheduledShift.startTime} - {scheduledShift.endTime})
                  </span>
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="h-64 rounded-xl overflow-hidden">
                <MapContainer bounds={[[location.lat, location.lng], [matchedLocation.lat, matchedLocation.lng]]} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle center={[matchedLocation.lat, matchedLocation.lng]} radius={matchedLocation.radius} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.2 }} />
                  <Marker position={[matchedLocation.lat, matchedLocation.lng]} icon={L.divIcon({ html: '<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white;"></div>', iconSize: [16, 16] })} />
                  <Marker position={[location.lat, location.lng]} icon={L.divIcon({ html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white;"></div>', iconSize: [16, 16] })} />
                  <Polyline positions={[[location.lat, location.lng], [matchedLocation.lat, matchedLocation.lng]]} pathOptions={{ color: "#3b82f6", dashArray: "5, 5" }} />
                </MapContainer>
              </div>
            </div>

            <div className="p-4 pt-0 space-y-3">
              <div className={`p-3 rounded-xl text-center ${isWithinRadius ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                <div className="font-bold">{isWithinRadius ? "✓ Dalam Radius Kantor" : "✗ Di Luar Radius Kantor"}</div>
                <div className="text-sm">Jarak: {distance.toFixed(0)}m (Maks: {matchedLocation.radius}m)</div>
              </div>

              <button onClick={saveAttendance} disabled={!isWithinRadius || isSaving} className={`w-full py-4 rounded-2xl font-bold ${isWithinRadius && !isSaving ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                {isSaving ? "Mengupload..." : (isCheckedIn ? "✅ Simpan Check-out" : "✅ Simpan Check-in")}
              </button>

              <button onClick={() => { setShowMap(false); setPhotoUri(null); setLocation(null); }} className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl">
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}