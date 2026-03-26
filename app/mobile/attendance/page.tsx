// app/mobile/attendance/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import dynamic from "next/dynamic";

// Import Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MobileAttendancePage() {
  const { user } = useAuth();
  
  // States
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Location states
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [radiusInfo, setRadiusInfo] = useState<{ radius: number; distance: number } | null>(null);
  const [officeLocation, setOfficeLocation] = useState<{ lat: number; lng: number; name: string; radius: number } | null>(null);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadTodayAttendance();
      loadOfficeLocation();
    }
  }, [user]);

  const loadOfficeLocation = async () => {
    const settingDoc = await getDoc(doc(db, "settings", "office"));
    if (settingDoc.exists()) {
      const data = settingDoc.data();
      setOfficeLocation({
        lat: data.lat,
        lng: data.lng,
        name: data.name || "Kantor",
        radius: data.radius || 100,
      });
    } else {
      // Default office location (ubah sesuai kantor Anda)
      setOfficeLocation({
        lat: -6.200000,
        lng: 106.816666,
        name: "Kantor Pusat",
        radius: 100,
      });
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

  // ================= CAMERA =================
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error("Camera error:", error);
      alert("Tidak dapat mengakses kamera");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL("image/jpeg");
      setPhotoUri(photoDataUrl);
      
      // Stop camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setShowCamera(false);
      
      // Get location after photo
      getLocation();
    }
  };

  const retakePhoto = () => {
    setPhotoUri(null);
    setShowMap(false);
    setLocation(null);
    startCamera();
  };

  // ================= LOCATION =================
  const getLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const currentLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(currentLoc);
          
          // Check radius
          if (officeLocation) {
            const distance = getDistance(
              currentLoc.lat,
              currentLoc.lng,
              officeLocation.lat,
              officeLocation.lng
            );
            setRadiusInfo({ radius: officeLocation.radius, distance });
            setIsWithinRadius(distance <= officeLocation.radius);
          }
          
          setShowMap(true);
        },
        (error) => {
          console.error("Location error:", error);
          alert("Gagal mendapatkan lokasi. Pastikan GPS aktif.");
          // Jika gagal, tetap tampilkan map dengan koordinat default
          setShowMap(true);
        }
      );
    } else {
      alert("Perangkat tidak mendukung GPS");
    }
  };

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

  // ================= CHECK IN =================
  const handleCheckIn = async () => {
    if (!isWithinRadius) {
      alert("Anda berada di luar radius absensi! Silakan mendekat ke lokasi kantor.");
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
          photo: photoUri,
        },
      };
      
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user?.uid,
          name: user?.name,
          date: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate())),
          ...checkInData,
          createdAt: Timestamp.now(),
        });
      } else {
        await updateDoc(docRef, checkInData);
      }
      
      alert("✅ Check-in berhasil!");
      // Reset states
      setPhotoUri(null);
      setShowMap(false);
      setLocation(null);
      loadTodayAttendance();
    } catch (error: any) {
      console.error("Check-in error:", error);
      alert("❌ Gagal check-in: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= CHECK OUT =================
  const handleCheckOut = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const docId = `${user?.uid}_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
      const docRef = doc(db, "attendance", docId);
      
      await updateDoc(docRef, {
        checkOut: {
          time: Timestamp.now(),
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

  // ================= RENDER =================

  // Jika sudah check-out
  if (isCheckedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-5 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Absensi Selesai</h2>
          <p className="text-gray-500 mb-6">Anda sudah menyelesaikan absensi hari ini</p>
          <div className="bg-gray-100 rounded-2xl p-4 mb-6">
            <p className="text-sm text-gray-500">Check-in</p>
            <p className="text-xl font-bold text-gray-800">
              {todayAttendance?.checkIn?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-sm text-gray-500 mt-2">Check-out</p>
            <p className="text-xl font-bold text-gray-800">
              {todayAttendance?.checkOut?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-2xl"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Jika sudah check-in (belum check-out)
  if (isCheckedIn && !isCheckedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-5 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md">
          <div className="text-6xl mb-4">📤</div>
          <h2 className="text-xl font-bold text-gray-800">Anda sudah check-in</h2>
          <p className="text-gray-500 mt-2">
            Waktu check-in: {todayAttendance?.checkIn?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={handleCheckOut}
            disabled={isLoading}
            className="mt-6 w-full py-4 bg-orange-500 text-white font-bold rounded-2xl active:scale-95"
          >
            {isLoading ? "Processing..." : "Check-out"}
          </button>
        </div>
      </div>
    );
  }

  // Halaman utama (belum check-in)
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-5 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md">
        <div className="text-6xl mb-4">📸</div>
        <h2 className="text-2xl font-bold text-gray-800">Absensi Hari Ini</h2>
        <p className="text-gray-500 mt-2">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <button
          onClick={startCamera}
          className="mt-6 w-full py-4 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-all"
        >
          Check-in
        </button>
        <div className="mt-6 text-xs text-gray-400">
          Pastikan GPS aktif dan Anda berada di lokasi kantor
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={takePhoto}
                className="w-full py-4 bg-white text-green-700 font-bold rounded-2xl active:scale-95 transition-all"
              >
                Ambil Foto
              </button>
              <button
                onClick={() => {
                  if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    setStream(null);
                  }
                  setShowCamera(false);
                }}
                className="w-full mt-3 py-3 bg-gray-500 text-white font-bold rounded-2xl"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map & Photo Preview Modal */}
      {showMap && photoUri && location && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4">
              {/* Photo Preview */}
              <div>
                <p className="text-gray-500 text-sm mb-2">Foto Absensi</p>
                <img src={photoUri} alt="Preview" className="w-full rounded-2xl" />
                <button
                  onClick={retakePhoto}
                  className="mt-2 text-sm text-green-600 underline"
                >
                  ↻ Ambil ulang foto
                </button>
              </div>

              {/* Map */}
              <div>
                <p className="text-gray-500 text-sm mb-2">Lokasi Anda</p>
                <div className="h-64 rounded-2xl overflow-hidden">
                  {officeLocation && location ? (
                    <MapContainer
                      center={[location.lat, location.lng]}
                      zoom={17}
                      style={{ height: "100%", width: "100%" }}
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Circle
                        center={[officeLocation.lat, officeLocation.lng]}
                        radius={officeLocation.radius}
                        pathOptions={{ color: "#00C853", fillColor: "#00C853", fillOpacity: 0.2 }}
                      />
                      <Marker position={[officeLocation.lat, officeLocation.lng]} />
                      <Marker position={[location.lat, location.lng]} />
                    </MapContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-100">
                      <p className="text-gray-500">Memuat peta...</p>
                    </div>
                  )}
                </div>
                <div className={`mt-3 p-3 rounded-xl text-center ${isWithinRadius ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {isWithinRadius ? (
                    <div>✓ Dalam radius absensi ({radiusInfo?.distance?.toFixed(0)}m / {radiusInfo?.radius}m)</div>
                  ) : (
                    <div>✗ Di luar radius absensi ({radiusInfo?.distance?.toFixed(0)}m / {radiusInfo?.radius}m)</div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleCheckIn}
                disabled={!isWithinRadius || isLoading}
                className={`
                  w-full py-4 rounded-2xl text-white font-bold text-lg transition-all
                  ${isWithinRadius && !isLoading
                    ? "bg-green-600 active:bg-green-700"
                    : "bg-gray-400 cursor-not-allowed"
                  }
                `}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </div>
                ) : (
                  "Simpan Absensi"
                )}
              </button>

              <button
                onClick={() => {
                  setShowMap(false);
                  setPhotoUri(null);
                  setLocation(null);
                }}
                className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}