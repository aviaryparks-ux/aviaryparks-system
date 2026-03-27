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

  // Load data
  useEffect(() => {
    loadOffice();
    if (user) {
      loadTodayAttendance();
    }
  }, [user]);

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

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "--:--";
    return timestamp.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const isCheckedIn = todayAttendance?.checkIn;
  const isCheckedOut = todayAttendance?.checkOut;

  // 🔥 UPLOAD FOTO KE FIREBASE STORAGE
  const uploadPhotoToStorage = async (base64Data: string): Promise<string> => {
    if (!user) throw new Error("User not found");
    
    const timestamp = Date.now();
    const fileName = `${user.uid}_${timestamp}.jpg`;
    const storageRef = ref(storage, `attendance/${fileName}`);
    
    // Remove base64 header if present
    let imageData = base64Data;
    if (base64Data.includes("base64,")) {
      imageData = base64Data.split("base64,")[1];
    }
    
    // Upload dengan progress tracking
    await uploadString(storageRef, imageData, "base64");
    
    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  // Camera functions
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

    const image = canvas.toDataURL("image/jpeg", 0.7); // Quality 70%

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

  // 🔥 SAVE DENGAN UPLOAD FOTO KE STORAGE
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

    setIsSaving(true);
    setUploadProgress(0);

    try {
      // Upload foto ke Firebase Storage
      const photoUrl = await uploadPhotoToStorage(photoUri);
      
      const today = new Date();
      const docId = user.uid + "_" + today.toISOString().slice(0, 10);
      const ref = doc(db, "attendance", docId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // Check-in
        await setDoc(ref, {
          uid: user.uid,
          name: user.name,
          date: Timestamp.fromDate(today),
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
        // Check-out
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
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 max-w-md mx-auto border border-white/20">
        {/* Header */}
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
              <img src={isCheckedIn.photo} className="w-10 h-10 rounded-full object-cover" />
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
              <img src={isCheckedOut.photo} className="w-10 h-10 rounded-full object-cover" />
            )}
          </div>
        </div>

        {/* Tombol Absen */}
        {!isCheckedOut ? (
          <button
            onClick={startCamera}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            {isCheckedIn ? "📤 Ambil Foto Check-out" : "📸 Ambil Foto Check-in"}
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

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative h-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            <button
              onClick={switchCamera}
              className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm text-white p-3 rounded-full shadow-lg active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={takePhoto}
                className="w-full py-4 bg-white text-green-700 font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                📸 Ambil Foto
              </button>
              <button
                onClick={() => {
                  if (stream) stream.getTracks().forEach(t => t.stop());
                  setShowCamera(false);
                }}
                className="w-full mt-3 py-3 bg-gray-500/80 text-white font-bold rounded-2xl"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && photoUri && location && matchedLocation && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-center flex-1">
                {isCheckedIn ? "Check-out" : "Check-in"}
              </h2>
              <button
                onClick={refreshLocation}
                disabled={isLoadingLocation}
                className="bg-white/20 rounded-full p-2 hover:bg-white/30 transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 ${isLoadingLocation ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Foto Absensi</p>
              <div className="relative rounded-xl overflow-hidden">
                <img src={photoUri} alt="Preview" className="w-full rounded-xl" />
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Lokasi Kantor: {matchedLocation.name}
                </p>
              </div>
              <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
                <MapContainer
                  bounds={[
                    [location.lat, location.lng],
                    [matchedLocation.lat, matchedLocation.lng],
                  ]}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle
                    center={[matchedLocation.lat, matchedLocation.lng]}
                    radius={matchedLocation.radius}
                    pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.2, weight: 2 }}
                  />
                  <Marker
                    position={[matchedLocation.lat, matchedLocation.lng]}
                    icon={L.divIcon({
                      html: '<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white;"></div>',
                      className: "custom-marker",
                      iconSize: [16, 16],
                    })}
                  />
                  <Marker
                    position={[location.lat, location.lng]}
                    icon={L.divIcon({
                      html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white;"></div>',
                      className: "custom-marker",
                      iconSize: [16, 16],
                    })}
                  />
                  <Polyline
                    positions={[[location.lat, location.lng], [matchedLocation.lat, matchedLocation.lng]]}
                    pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "5, 5" }}
                  />
                </MapContainer>
              </div>

              <div className="flex justify-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Radius Kantor</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Jarak</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Lokasi Anda</span>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0 space-y-3">
              <div className={`p-3 rounded-xl text-center ${isWithinRadius ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                <div className="font-bold text-lg">
                  {isWithinRadius ? "✓ Dalam Radius Kantor" : "✗ Di Luar Radius Kantor"}
                </div>
                <div className="text-sm mt-1">
                  Jarak: {distance.toFixed(0)}m {matchedLocation && `(Maks: ${matchedLocation.radius}m)`}
                </div>
              </div>

              <button
                onClick={saveAttendance}
                disabled={!isWithinRadius || isSaving}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  isWithinRadius && !isSaving
                    ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg hover:shadow-xl active:scale-95"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengupload foto...</span>
                  </>
                ) : (
                  isCheckedIn ? "✅ Simpan Check-out" : "✅ Simpan Check-in"
                )}
              </button>

              <button
                onClick={() => {
                  setShowMap(false);
                  setPhotoUri(null);
                  setLocation(null);
                  setMatchedLocation(null);
                }}
                className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all hover:bg-gray-300"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}