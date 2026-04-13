// app/(admin)/attendance-settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";

type AttendanceSettings = {
  defaultLateTolerance: number;      // toleransi default (menit)
  defaultStartHour: number;           // jam mulai default
  defaultStartMinute: number;         // menit mulai default
  allowOvertime: boolean;              // izinkan lembur
  maxLateMinutes: number;              // batas maksimal terlambat (menit)
  weekendIsHoliday: boolean;           // weekend dianggap libur
  enableNSPWarning: boolean;           // aktifkan peringatan NSP
  nspWarningHours: number;             // jam peringatan NSP (misal: setelah jam 20:00)
  updatedAt?: string;                  // waktu pembaruan terakhir
};

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AttendanceSettings>({
    defaultLateTolerance: 15,
    defaultStartHour: 8,
    defaultStartMinute: 0,
    allowOvertime: true,
    maxLateMinutes: 120,
    weekendIsHoliday: false,
    enableNSPWarning: true,
    nspWarningHours: 20,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "app_settings", "attendance"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AttendanceSettings;
        setSettings(data);
        if (data.updatedAt) {
          setLastUpdated(new Date(data.updatedAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }));
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "app_settings", "attendance"), {
        ...settings,
        updatedAt: new Date().toISOString(),
      });
      alert("✅ Pengaturan berhasil disimpan");
    } catch (error) {
      console.error(error);
      alert("❌ Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr"]}>
      <div className="space-y-6 p-6">
        {/* Header dengan Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold">⚙️ Pengaturan Absensi</h1>
            <p className="text-green-100 mt-1">Atur parameter keterlambatan dan aturan absensi</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Parameter Absensi</h2>
              <p className="text-xs text-gray-500 mt-1">Atur nilai default untuk perhitungan absensi</p>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Toleransi Keterlambatan */}
            <div className="group rounded-xl bg-gradient-to-r from-gray-50 to-white p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <span className="text-lg">⏰</span>
                </div>
                <h2 className="text-md font-semibold text-gray-800">Keterlambatan</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toleransi Default
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.defaultLateTolerance}
                      onChange={(e) => setSettings({ ...settings, defaultLateTolerance: parseInt(e.target.value) || 0 })}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-500">menit</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Keterlambatan di atas batas ini akan dianggap terlambat
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batas Maksimal Terlambat
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.maxLateMinutes}
                      onChange={(e) => setSettings({ ...settings, maxLateMinutes: parseInt(e.target.value) || 0 })}
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-500">menit</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Di atas batas ini dianggap tidak hadir (Alpha)
                  </p>
                </div>
              </div>
            </div>

            {/* Jam Kerja Default */}
            <div className="group rounded-xl bg-gradient-to-r from-gray-50 to-white p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-lg">🕐</span>
                </div>
                <h2 className="text-md font-semibold text-gray-800">Jam Kerja Default</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Mulai Default
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.defaultStartHour}
                    onChange={(e) => setSettings({ ...settings, defaultStartHour: parseInt(e.target.value) || 0 })}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    min="0"
                    max="23"
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    type="number"
                    value={settings.defaultStartMinute}
                    onChange={(e) => setSettings({ ...settings, defaultStartMinute: parseInt(e.target.value) || 0 })}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    min="0"
                    max="59"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Digunakan jika karyawan tidak memiliki shift
                </p>
              </div>
            </div>

            {/* NSP (Tidak Absen Pulang) */}
            <div className="group rounded-xl bg-gradient-to-r from-gray-50 to-white p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <span className="text-lg">⚠️</span>
                </div>
                <h2 className="text-md font-semibold text-gray-800">NSP (Tidak Absen Pulang)</h2>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableNSPWarning}
                    onChange={(e) => setSettings({ ...settings, enableNSPWarning: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Aktifkan peringatan NSP</span>
                </label>
                {settings.enableNSPWarning && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jam Peringatan NSP
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={settings.nspWarningHours}
                        onChange={(e) => setSettings({ ...settings, nspWarningHours: parseInt(e.target.value) || 0 })}
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        min="0"
                        max="23"
                      />
                      <span className="text-sm text-gray-500">:00</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Jika sudah lewat jam ini dan belum check-out, akan dianggap NSP
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Lainnya */}
            <div className="group rounded-xl bg-gradient-to-r from-gray-50 to-white p-5 border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-lg">📅</span>
                </div>
                <h2 className="text-md font-semibold text-gray-800">Lainnya</h2>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowOvertime}
                    onChange={(e) => setSettings({ ...settings, allowOvertime: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    Izinkan lembur (menghitung jam kerja lebih dari shift)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.weekendIsHoliday}
                    onChange={(e) => setSettings({ ...settings, weekendIsHoliday: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    Weekend (Sabtu/Minggu) dianggap hari libur
                  </span>
                </label>
              </div>
            </div>

            {/* Last Updated Info */}
            {lastUpdated && (
              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-4">
                <span>📅 Terakhir diperbarui</span>
                <span>{lastUpdated}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </span>
                ) : (
                  "💾 Simpan Pengaturan"
                )}
              </button>
              <button
                onClick={() => {
                  setSettings({
                    defaultLateTolerance: 15,
                    defaultStartHour: 8,
                    defaultStartMinute: 0,
                    allowOvertime: true,
                    maxLateMinutes: 120,
                    weekendIsHoliday: false,
                    enableNSPWarning: true,
                    nspWarningHours: 20,
                  });
                }}
                className="px-6 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
              >
                ↺ Reset ke Default
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 p-5">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Informasi</h4>
              <p className="text-sm text-blue-700">
                Pengaturan ini akan mempengaruhi perhitungan status absensi (Hadir, Terlambat, Tidak Hadir, NSP) 
                untuk seluruh karyawan. Perubahan akan langsung berlaku.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-blue-600">
                <span>✅ Hadir: Check-in sesuai jam shift</span>
                <span>⏰ Terlambat: Melebihi toleransi</span>
                <span>❌ Alpha: Tidak ada check-in</span>
                <span>⚠️ NSP: Check-in tapi tidak check-out</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}