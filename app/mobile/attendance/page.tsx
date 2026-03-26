// app/mobile/attendance/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
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
  const [officeLocation, setOfficeLocation] = useState<any>(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [radiusInfo, setRadiusInfo] = useState<any>(null);

  // load data
  useEffect(() => {
    if (user) {
      loadTodayAttendance();
      loadOfficeLocation();
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

  // ================= LOAD =================

  const loadOfficeLocation = async () => {
    const docSnap = await getDoc(doc(db, "settings", "office"));

    if (docSnap.exists()) {
      setOfficeLocation(docSnap.data());
    } else {
      setOfficeLocation({
        lat: -6.2,
        lng: 106.816,
        radius: 100,
        name: "Office",
      });
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

      // coba kamera belakang dulu
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        // fallback kamera default
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

  const getLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setLocation(loc);

        if (officeLocation) {
          const d = getDistance(
            loc.lat,
            loc.lng,
            officeLocation.lat,
            officeLocation.lng
          );

          setIsWithinRadius(d <= officeLocation.radius);
          setRadiusInfo({
            distance: d,
            radius: officeLocation.radius,
          });
        }

        setShowMap(true);
      },
      () => alert("GPS tidak aktif")
    );
  };

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

  // ================= SAVE =================

  const handleSave = async () => {
    if (!photoUri || !location) {
      alert("foto / lokasi kosong");
      return;
    }

    if (!isWithinRadius) {
      alert("diluar radius kantor");
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
            },
          }
        : {
            checkOut: {
              time: Timestamp.now(),
              lat: location.lat,
              lng: location.lng,
              photo: photoUri,
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

    alert("absensi berhasil");
    setShowMap(false);
    loadTodayAttendance();
    setIsLoading(false);
  };

  const isCheckedIn = todayAttendance?.checkIn;
  const isCheckedOut = todayAttendance?.checkOut;

  // ================= UI =================

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
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-md shadow-xl">
          <div className="text-6xl mb-4">📤</div>
          <h2 className="text-xl font-bold text-gray-800">Anda sudah check-in</h2>
          <p className="text-gray-500 mt-2">
            Waktu check-in: {todayAttendance?.checkIn?.time?.toDate?.()?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={() => startCamera("checkout")}
            disabled={isLoading}
            className="mt-6 w-full py-4 bg-orange-500 text-white font-bold rounded-2xl active:scale-95 transition-all"
          >
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
        <button
          onClick={() => startCamera("checkin")}
          className="mt-6 w-full py-4 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
        >
          Ambil Foto untuk Check-in
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
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
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
                  <button
                    onClick={() => {
                      setShowCamera(false);
                      setCameraError(null);
                      setActionType(null);
                    }}
                    className="mt-4 px-6 py-2 bg-white text-black rounded-xl"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={takePhoto}
                disabled={!cameraReady || !!cameraError}
                className={`w-full py-4 font-bold rounded-2xl active:scale-95 transition-all ${
                  cameraReady && !cameraError
                    ? "bg-white text-green-700" 
                    : "bg-gray-500 text-gray-300 cursor-not-allowed"
                }`}
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
                  setActionType(null);
                  setCameraReady(false);
                  setCameraError(null);
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
            <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              {/* Photo Preview */}
              <div>
                <p className="text-gray-500 text-sm mb-2">
                  {actionType === "checkin" ? "Foto Check-in" : "Foto Check-out"}
                </p>
                <img src={photoUri} alt="Preview" className="w-full rounded-2xl border border-gray-200" />
                <button
                  onClick={() => startCamera(actionType!)}
                  className="mt-2 text-sm text-green-600 underline"
                >
                  ↻ Ambil ulang foto
                </button>
              </div>

              {/* Map */}
              <div>
                <p className="text-gray-500 text-sm mb-2">Lokasi Anda</p>
                <div className="h-64 rounded-2xl overflow-hidden border border-gray-200">
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
                onClick={handleSave}
                disabled={!isWithinRadius || isLoading}
                className={`
                  w-full py-4 rounded-2xl text-white font-bold text-lg transition-all
                  ${isWithinRadius && !isLoading
                    ? "bg-green-600 hover:bg-green-700 active:scale-95"
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
                  actionType === "checkin" ? "Simpan Check-in" : "Simpan Check-out"
                )}
              </button>

              <button
                onClick={() => {
                  setShowMap(false);
                  setPhotoUri(null);
                  setLocation(null);
                  setActionType(null);
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