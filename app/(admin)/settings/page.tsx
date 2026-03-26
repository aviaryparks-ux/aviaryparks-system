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
  createdAt?: string;
  updatedAt?: string;
};

export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
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
      alert("Semua field wajib diisi");
      return;
    }

    setFormLoading(true);
    try {
      const data = {
        name: name.trim(),
        company: company.trim(),
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius),
        address: address.trim(),
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, "settings", editingId), data);
        alert("✅ Lokasi berhasil diupdate");
      } else {
        await addDoc(collection(db, "settings"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        alert("✅ Lokasi berhasil ditambahkan");
      }
      resetForm();
      loadLocations();
      setShowForm(false);
    } catch (error) {
      console.error("Save error:", error);
      alert("❌ Gagal menyimpan lokasi");
    } finally {
      setFormLoading(false);
    }
  };

  const deleteLocation = async (id: string, name: string) => {
    if (!confirm(`Hapus lokasi "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "settings", id));
      alert("✅ Lokasi berhasil dihapus");
      loadLocations();
    } catch (error) {
      alert("❌ Gagal menghapus lokasi");
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

  // Wrapper functions untuk MapPicker
  const handleSetLat = (value: string) => {
    setLat(value);
  };

  const handleSetLng = (value: string) => {
    setLng(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat lokasi...</p>
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
              Pengaturan Lokasi Absensi
            </h1>
            <p className="text-gray-500 mt-1">
              Atur lokasi dan radius absensi karyawan
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="text-xl">📍</span>
            {showForm ? "Tutup Form" : "Tambah Lokasi"}
          </button>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Total Lokasi</p>
                <p className="text-2xl font-bold text-blue-800">{locations.length}</p>
              </div>
              <span className="text-3xl">📍</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Lokasi Aktif</p>
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
                <p className="text-sm text-purple-600">Perusahaan</p>
                <p className="text-2xl font-bold text-purple-800">
                  {new Set(locations.map((l) => l.company)).size}
                </p>
              </div>
              <span className="text-3xl">🏢</span>
            </div>
          </div>
        </div>

        {/* Form Tambah/Edit Lokasi */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>{editingId ? "✏️" : "➕"}</span>
                {editingId ? "Edit Lokasi" : "Tambah Lokasi Baru"}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lokasi *
                  </label>
                  <input
                    placeholder="Contoh: Kantor Pusat"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perusahaan *
                  </label>
                  <input
                    placeholder="Nama Perusahaan"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Radius (meter) *
                  </label>
                  <input
                    placeholder="Contoh: 100"
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude *
                    </label>
                    <input
                      placeholder="Contoh: -6.200000"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude *
                    </label>
                    <input
                      placeholder="Contoh: 106.816666"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat Lengkap
                  </label>
                  <textarea
                    placeholder="Alamat lengkap lokasi absensi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Map Picker */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Lokasi di Peta
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden h-80">
                  <MapPicker
                    setLat={handleSetLat}
                    setLng={handleSetLng}
                    radius={Number(radius) || 100}
                    initialLat={lat ? parseFloat(lat) : undefined}
                    initialLng={lng ? parseFloat(lng) : undefined}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <span className="text-green-500">●</span> Lingkaran hijau = area absensi
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveLocation}
                  disabled={formLoading}
                  className={`px-6 py-2 rounded-lg text-white font-medium transition-all ${
                    formLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {formLoading ? "Menyimpan..." : editingId ? "Update" : "Simpan"}
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabel Lokasi */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🗺️</span>
              Daftar Lokasi Absensi
              <span className="text-sm text-gray-500 ml-2">({locations.length} lokasi)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Lokasi</th>
                  <th className="px-4 py-3 text-left">Perusahaan</th>
                  <th className="px-4 py-3 text-left">Radius</th>
                  <th className="px-4 py-3 text-left">Koordinat</th>
                  <th className="px-4 py-3 text-left">Alamat</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Aksi</th>
                 </tr>
              </thead>
              <tbody>
                {locations.map((loc, idx) => (
                  <tr
                    key={loc.id}
                    className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}
                  >
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
                      <span className="font-mono text-blue-600 font-medium">{loc.radius} m</span>
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
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          loc.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {loc.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editLocation(loc)}
                          className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLocation(loc.id, loc.name)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                        >
                          Hapus
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
                <p className="text-lg font-medium">Belum ada lokasi absensi</p>
                <p className="text-sm mt-1">Klik "Tambah Lokasi" untuk membuat lokasi baru</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Cara Kerja Lokasi Absensi</h4>
              <p className="text-sm text-blue-700">
                Karyawan hanya dapat melakukan absensi jika berada dalam radius yang ditentukan dari titik koordinat GPS.
                Pastikan koordinat yang dimasukkan akurat. Radius default: 100 meter.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}