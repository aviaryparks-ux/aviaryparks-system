// components/MapPicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapPickerProps {
  setLat: (lat: string) => void;
  setLng: (lng: string) => void;
  radius?: number;
  initialLat?: number;
  initialLng?: number;
}

export default function MapPicker({ 
  setLat, 
  setLng, 
  radius = 100, 
  initialLat, 
  initialLng 
}: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [marker, setMarker] = useState<L.Marker | null>(null);
  const [circle, setCircle] = useState<L.Circle | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Default center (Indonesia) - ini hanya fallback
  const defaultLat = initialLat || -6.2;
  const defaultLng = initialLng || 106.816;

  useEffect(() => {
    if (typeof setLat !== "function" || typeof setLng !== "function") {
      console.error("MapPicker: setLat or setLng is not a function");
      return;
    }

    if (!mapRef.current || map) return;

    try {
      const mapInstance = L.map(mapRef.current).setView([defaultLat, defaultLng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance);

      // Create marker di posisi awal
      const markerInstance = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(mapInstance);
      
      // Create circle
      const circleInstance = L.circle([defaultLat, defaultLng], {
        radius: radius,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.2,
      }).addTo(mapInstance);

      // Event ketika marker di-drag
      markerInstance.on("dragend", () => {
        const position = markerInstance.getLatLng();
        console.log("Marker dragged to:", position);
        setLat(position.lat.toFixed(6));
        setLng(position.lng.toFixed(6));
        circleInstance.setLatLng(position);
      });

      // Event ketika map diklik
      mapInstance.on("click", (e) => {
        const { lat, lng } = e.latlng;
        console.log("Map clicked at:", { lat, lng });
        markerInstance.setLatLng([lat, lng]);
        setLat(lat.toFixed(6));
        setLng(lng.toFixed(6));
        circleInstance.setLatLng([lat, lng]);
      });

      // Set initial coordinates ke parent
      console.log("Initial coordinates:", { defaultLat, defaultLng });
      setLat(defaultLat.toFixed(6));
      setLng(defaultLng.toFixed(6));

      setMap(mapInstance);
      setMarker(markerInstance);
      setCircle(circleInstance);
      setIsInitialized(true);
    } catch (error) {
      console.error("MapPicker error:", error);
    }
  }, [map, defaultLat, defaultLng, radius, setLat, setLng]);

  // Update circle radius when radius prop changes
  useEffect(() => {
    if (circle) {
      circle.setRadius(radius);
    }
  }, [circle, radius]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      )}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow text-xs text-gray-600">
        📍 Klik peta atau drag marker
      </div>
    </div>
  );
}