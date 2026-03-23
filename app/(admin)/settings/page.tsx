// app/(admin)/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import dynamic from "next/dynamic";
import ProtectedRoute from "@/components/ProtectedRoute";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });

type Location = {
  id: string;
  name: string;
  company: string;
  lat: number;
  lng: number;
  radius: number;
  address: string;
  isActive: boolean;
};

export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const snap = await getDocs(collection(db, "settings"));
      const arr: Location[] = [];
      snap.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() } as Location);
      });
      setLocations(arr);
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async () => {
    if (!name || !company || !lat || !lng || !radius) {
      alert("All fields are required");
      return;
    }

    setFormLoading(true);
    try {
      const data = {
        name,
        company,
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius),
        address,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, "settings", editingId), data);
        alert("✅ Location updated");
      } else {
        await addDoc(collection(db, "settings"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        alert("✅ Location added");
      }
      resetForm();
      loadLocations();
      setShowForm(false);
    } catch (error) {
      alert("❌ Error saving location");
    } finally {
      setFormLoading(false);
    }
  };

  const deleteLocation = async (id: string, name: string) => {
    if (!confirm(`Delete location "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "settings", id));
      alert("✅ Location deleted");
      loadLocations();
    } catch (error) {
      alert("❌ Error deleting location");
    }
  };

  const editLocation = (loc: Location) => {
    setName(loc.name);
    setCompany(loc.company);
    setLat(loc.lat.toString());
    setLng(loc.lng.toString());
    setRadius(loc.radius.toString());
    setAddress(loc.address || "");
    setEditingId(loc.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setName("");
    setCompany("");
    setLat("");
    setLng("");
    setRadius("");
    setAddress("");
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Location Settings
            </h1>
            <p className="text-gray-500 mt-1">Configure attendance locations with GPS and radius</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">📍</span>
            {showForm ? "Close Form" : "Add Location"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Total Locations</p>
                <p className="text-2xl font-bold text-blue-800">{locations.length}</p>
              </div>
              <span className="text-3xl">📍</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Active Locations</p>
                <p className="text-2xl font-bold text-green-800">
                  {locations.filter((l) => l.isActive).length}
                </p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-purple-600">Companies</p>
                <p className="text-2xl font-bold text-purple-800">
                  {new Set(locations.map((l) => l.company)).size}
                </p>
              </div>
              <span className="text-3xl">🏢</span>
            </div>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>{editingId ? "✏️" : "📍"}</span>
                {editingId ? "Edit Location" : "Add New Location"}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Location Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  placeholder="Company *"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  placeholder="Radius (meters) *"
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Latitude *"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    placeholder="Longitude *"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <textarea
                    placeholder="Full Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Location on Map
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden h-64">
                  <MapPicker setLat={setLat} setLng={setLng} radius={Number(radius) || 100} />
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <span className="text-green-500">●</span> Green circle = attendance area
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveLocation}
                  disabled={formLoading}
                  className={`px-6 py-2 rounded-lg text-white font-medium ${
                    formLoading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {formLoading ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Locations Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🗺️</span>
              Location List
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Radius</th>
                  <th className="px-4 py-3 text-left">Coordinates</th>
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc, idx) => (
                  <tr key={loc.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <span className="font-medium">{loc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {loc.company}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{loc.radius} m</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono">
                        <div>Lat: {loc.lat}</div>
                        <div>Lng: {loc.lng}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate text-gray-600" title={loc.address}>
                        {loc.address || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editLocation(loc)}
                          className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLocation(loc.id, loc.name)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {locations.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">🗺️</div>
                <p className="text-lg font-medium">No locations found</p>
                <p className="text-sm mt-1">Click "Add Location" to create one</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-semibold text-yellow-800 mb-1">How Location Works</h4>
              <p className="text-sm text-yellow-700">
                Employees can only clock in/out when within the specified radius from the GPS coordinates.
                Make sure the coordinates are accurate. Default radius: 100 meters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}