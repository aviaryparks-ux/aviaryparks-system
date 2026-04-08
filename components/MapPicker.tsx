// components/MapPicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type MapPickerProps = {
  setLat: (lat: string) => void;
  setLng: (lng: string) => void;
  radius: number;
  initialLat?: number;
  initialLng?: number;
};

export default function MapPicker({ setLat, setLng, radius, initialLat, initialLng }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentLat, setCurrentLat] = useState(initialLat || -6.200000);
  const [currentLng, setCurrentLng] = useState(initialLng || 106.816666);

  // Initialize map
  useEffect(() => {
    // Tunggu hingga DOM benar-benar siap
    if (!mapRef.current || mapInstanceRef.current) return;

    // Delay initialization untuk memastikan container siap
    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      try {
        const mapInstance = L.map(mapRef.current).setView([currentLat, currentLng], 15);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapInstance);

        mapInstanceRef.current = mapInstance;
        setIsMapReady(true);
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Update marker and circle when map is ready
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.remove();
    }
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Add marker
    const marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Add circle
    const circle = L.circle([currentLat, currentLng], {
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 0.15,
      radius: radius,
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    // Set view to marker position
    map.setView([currentLat, currentLng], 15);

    // Handle marker drag
    marker.on("dragend", () => {
      const latLng = marker.getLatLng();
      const newLat = latLng.lat;
      const newLng = latLng.lng;
      
      setCurrentLat(newLat);
      setCurrentLng(newLng);
      setLat(newLat.toFixed(6));
      setLng(newLng.toFixed(6));

      // Update circle position
      if (circleRef.current) {
        circleRef.current.setLatLng([newLat, newLng]);
      }
    });

    // Handle map click
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      setCurrentLat(lat);
      setCurrentLng(lng);
      setLat(lat.toFixed(6));
      setLng(lng.toFixed(6));

      // Update marker position
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      }
    });
  }, [isMapReady, currentLat, currentLng, radius, setLat, setLng]);

  // Update circle radius when radius changes
  useEffect(() => {
    if (circleRef.current && radius) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: "300px" }} />
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Memuat peta...</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs shadow-md">
        <span className="text-gray-600">
          📍 {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </span>
      </div>
    </div>
  );
}