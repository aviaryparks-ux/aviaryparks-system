// app/mobile/attendance/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
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
import dynamic from "next/dynamic";

// leaflet
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

// fix icon leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MobileAttendancePage() {
  const { user } = useAuth();

  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [actionType, setActionType] = useState<"checkin" | "checkout" | null>(
    null
  );

  // camera
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // location
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [officeLocations, setOfficeLocations] = useState<any[]>([]);
  const [matchedLocation, setMatchedLocation] = useState<any>(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [radiusInfo, setRadiusInfo] = useState<any>(null);
  const [officeLocationLoaded, setOfficeLocationLoaded] = useState(false);

  // load data
  useEffect(() => {
    if (user) {
      loadTodayAttendance();
      loadOfficeLocations();
    }
  }, [user]);

  // cleanup camera
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  // ================= LOAD SEMUA LOKASI AKTIF =================
  const loadOfficeLocations = async () => {
    try {
      const q = query(
        collection(db, "settings"),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);

      console.log("=== LOADED LOCATIONS FROM DB ===");
      console.log("Total locations:", snapshot.size);

      if (snapshot.empty) {
        console.log("No active locations found!");
        setOfficeLocations([]);
      } else {
        const locations = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log(`- ${doc.id}:`, {
            name: data.name,
            lat: data.lat,
            lng: data.lng,
            radius: data.radius,
          });
          return { id: doc.id, ...data };
        });
        setOfficeLocations(locations);
      }
      setOfficeLocationLoaded(true);
    } catch (error) {
      console.error("Error loading locations:", error);
      setOfficeLocations([]);
      setOfficeLocationLoaded(true);
    }
  };

  const loadTodayAttendance = async () => {
    if (!user) return;
    const today = new Date();
    const id = user.uid + "_" + today.toISOString().slice(0, 10);
    const snap = await getDoc(doc(db, "attendance", id));
    if (snap.exists()) {
      setTodayAttendance(snap.data());
    }
  };

  // ================= CAMERA =================
  const startCamera = async (type: "checkin" | "checkout") => {
    setActionType(type);
    setCameraError(null);
    setCameraReady(false);
    setPhotoUri(null);

    try {
      if (!navigator.mediaDevices) {
        setCameraError("browser tidak support kamera");
        return;
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setShowCamera(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraReady(true);
          };
        }
      }, 300);
    } catch (err: any) {
      setCameraError(err.message);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    const image = canvas.toDataURL("image/jpeg");
    setPhotoUri(image);

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    setShowCamera(false);
    getLocation();
  };

  // ================= GPS =================
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLocation(userLoc);

        console.log("=== USER LOCATION ===");
        console.log("Lat:", userLoc.lat);
        console.log("Lng:", userLoc.lng);

        // Cari lokasi terdekat dari semua lokasi yang aktif
        let nearestLocation = null;
        let minDistance = Infinity;

        for (const loc of officeLocations) {
          const distance = getDistance(
            userLoc.lat,
            userLoc.lng,
            loc.lat,
            loc.lng
          );
          console.log(`Distance to ${loc.name}: ${distance.toFixed(2)}m, Radius: ${loc.radius}m`);
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestLocation = loc;
          }
        }

        if (nearestLocation) {
          console.log("Nearest location:", nearestLocation.name);
          const isInRadius = minDistance <= nearestLocation.radius;
          setIsWithinRadius(isInRadius);
          setRadiusInfo({
            distance: minDistance,
            radius: nearestLocation.radius,
            name: nearestLocation.name,
            lat: nearestLocation.lat,
            lng: nearestLocation.lng,
          });
          setMatchedLocation(nearestLocation);
        } else {
          setIsWithinRadius(false);
          setMatchedLocation(null);
        }

        setShowMap(true);
      },
      (err) => {
        console.error("GPS Error:", err);
        alert("GPS tidak aktif, nyalakan GPS untuk absensi");
      }
    );
  };

  // ================= SAVE =================
  const handleSave = async () => {
    if (!user) {
      alert("User tidak ditemukan");
      return;
    }

    if (!photoUri || !location) {
      alert("foto / lokasi kosong");
      return;
    }

    if (!isWithinRadius) {
      alert(`Anda berada di luar radius ${matchedLocation?.name || "kantor"}!`);
      return;
    }

    setIsLoading(true);

    const today = new Date();
    const id = user.uid + "_" + today.toISOString().slice(0, 10);
    const ref = doc(db, "attendance", id);

    const data =
      actionType === "checkin"
        ? {
            checkIn: {
              time: Timestamp.now(),
              lat: location.lat,
              lng: location.lng,
              photo: photoUri,
              locationName: matchedLocation?.name || "Unknown",
            },
          }
        : {
            checkOut: {
              time: Timestamp.now(),
              lat: location.lat,
              lng: location.lng,
              photo: photoUri,
              locationName: matchedLocation?.name || "Unknown",
            },
          };

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        name: user.name,
        date: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate())),
        ...data,
      });
    } else {
      await updateDoc(ref, data);
    }

    alert("✅ Absensi berhasil!");
    setShowMap(false);
    loadTodayAttendance();
    setIsLoading(false);
  };

  const isCheckedIn = todayAttendance?.checkIn;
  const isCheckedOut = todayAttendance?.checkOut;

  // Loading state
  if (!officeLocationLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p>Memuat lokasi...</p>
        </div>
      </div>
    );
  }

  // Jika tidak ada lokasi aktif
  if (officeLocations.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md shadow-xl">
          <div className="text-6xl mb-4">📍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Belum Ada Lokasi Absensi
          </h2>
          <p className="text-gray-500 mb-6">
            Hubungi admin untuk mengatur lokasi absensi
          </p>
        </div>
      </div>
    );
  }

  // Jika sudah check-out
  if (isCheckedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-5 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md shadow-xl">
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
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-green-600 text-white font-bold rounded-2xl">
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
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md shadow-xl">
          <div className="text-6xl mb-4">📤</div>
          <h2 className="text-xl font-bold text-gray-800">Anda sudah check-in</h2>
          <p className="text-gray-500 mt-2">
            Waktu check-in:{" "}
            {todayAttendance?.checkIn?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={() => startCamera("checkout")} disabled={isLoading} className="mt-6 w-full py-4 bg-orange-500 text-white font-bold rounded-2xl active:scale-95 transition-all">
            Check-out
          </button>
        </div>
      </div>
    );
  }

  // Halaman utama (belum check-in)
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-5 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md shadow-xl">
        <div className="text-6xl mb-4">📸</div>
        <h2 className="text-2xl font-bold text-gray-800">Absensi Hari Ini</h2>
        <p className="text-gray-500 mt-2">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <button onClick={() => startCamera("checkin")} className="mt-6 w-full py-4 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg">
          Ambil Foto untuk Check-in
        </button>
        <div className="mt-6 text-xs text-gray-400">
          Anda bisa absen di lokasi yang sudah ditentukan oleh admin
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative h-full">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-white text-center">
                  <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                  <p>Mengaktifkan kamera...</p>
                  <p className="text-xs text-white/50 mt-2">Izinkan akses kamera jika diminta</p>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-white text-center p-6">
                  <div className="text-5xl mb-4">📷</div>
                  <p className="font-medium mb-2">Kamera Tidak Tersedia</p>
                  <p className="text-sm text-white/70">{cameraError}</p>
                  <button onClick={() => { setShowCamera(false); setCameraError(null); setActionType(null); }} className="mt-4 px-6 py-2 bg-white text-black rounded-xl">
                    Tutup
                  </button>
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <button onClick={takePhoto} disabled={!cameraReady || !!cameraError} className={`w-full py-4 font-bold rounded-2xl active:scale-95 transition-all ${cameraReady && !cameraError ? "bg-white text-green-700" : "bg-gray-500 text-gray-300 cursor-not-allowed"}`}>
                Ambil Foto
              </button>
              <button onClick={() => { if (stream) { stream.getTracks().forEach((track) => track.stop()); setStream(null); } setShowCamera(false); setActionType(null); setCameraReady(false); setCameraError(null); }} className="w-full mt-3 py-3 bg-gray-500 text-white font-bold rounded-2xl">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map & Photo Preview Modal */}
      {showMap && photoUri && location && matchedLocation && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              {/* Photo Preview */}
              <div>
                <p className="text-gray-500 text-sm mb-2">{actionType === "checkin" ? "Foto Check-in" : "Foto Check-out"}</p>
                <img src={photoUri} alt="Preview" className="w-full rounded-2xl border border-gray-200" />
                <button onClick={() => startCamera(actionType!)} className="mt-2 text-sm text-green-600 underline">↻ Ambil ulang foto</button>
              </div>

              {/* Map */}
              <div>
                <p className="text-gray-500 text-sm mb-2">Lokasi Kantor: {matchedLocation.name}</p>
                <div className="h-64 rounded-2xl overflow-hidden border border-gray-200">
                  <MapContainer center={[matchedLocation.lat, matchedLocation.lng]} zoom={17} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Circle center={[matchedLocation.lat, matchedLocation.lng]} radius={matchedLocation.radius} pathOptions={{ color: "#00C853", fillColor: "#00C853", fillOpacity: 0.2 }} />
                    <Marker position={[matchedLocation.lat, matchedLocation.lng]} />
                    <Marker position={[location.lat, location.lng]} />
                  </MapContainer>
                </div>
                <div className={`mt-3 p-3 rounded-xl text-center ${isWithinRadius ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {isWithinRadius ? (
                    <div>✓ Dalam radius {matchedLocation.name} ({radiusInfo?.distance?.toFixed(0)}m / {radiusInfo?.radius}m)</div>
                  ) : (
                    <div>✗ Di luar radius {matchedLocation.name} ({radiusInfo?.distance?.toFixed(0)}m / {radiusInfo?.radius}m)</div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <button onClick={handleSave} disabled={!isWithinRadius || isLoading} className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-all ${isWithinRadius && !isLoading ? "bg-green-600 hover:bg-green-700 active:scale-95" : "bg-gray-400 cursor-not-allowed"}`}>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </div>
                ) : actionType === "checkin" ? "Simpan Check-in" : "Simpan Check-out"}
              </button>

              <button onClick={() => { setShowMap(false); setPhotoUri(null); setLocation(null); setActionType(null); }} className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}