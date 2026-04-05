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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "app_settings", "attendance"), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as AttendanceSettings);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "app_settings", "attendance"), settings);
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
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">⚙️ Pengaturan Absensi</h1>
          <p className="text-gray-500">Atur parameter keterlambatan dan aturan absensi</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          {/* Toleransi Keterlambatan */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">⏰ Keterlambatan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Toleransi Default (menit)
                </label>
                <input
                  type="number"
                  value={settings.defaultLateTolerance}
                  onChange={(e) => setSettings({ ...settings, defaultLateTolerance: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">Keterlambatan di atas batas ini akan dianggap terlambat</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batas Maksimal Terlambat (menit)
                </label>
                <input
                  type="number"
                  value={settings.maxLateMinutes}
                  onChange={(e) => setSettings({ ...settings, maxLateMinutes: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">Di atas batas ini dianggap tidak hadir</p>
              </div>
            </div>
          </div>

          {/* Jam Kerja Default */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">🕐 Jam Kerja Default</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Mulai Default
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={settings.defaultStartHour}
                    onChange={(e) => setSettings({ ...settings, defaultStartHour: parseInt(e.target.value) })}
                    className="w-20 border rounded-lg px-3 py-2"
                    min="0"
                    max="23"
                  />
                  <span className="self-center">:</span>
                  <input
                    type="number"
                    value={settings.defaultStartMinute}
                    onChange={(e) => setSettings({ ...settings, defaultStartMinute: parseInt(e.target.value) })}
                    className="w-20 border rounded-lg px-3 py-2"
                    min="0"
                    max="59"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Digunakan jika karyawan tidak memiliki shift</p>
              </div>
            </div>
          </div>

          {/* NSP (Tidak Absen Pulang) */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-4">⚠️ NSP (Tidak Absen Pulang)</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enableNSPWarning}
                  onChange={(e) => setSettings({ ...settings, enableNSPWarning: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Aktifkan peringatan NSP</span>
              </label>
              {settings.enableNSPWarning && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam Peringatan NSP
                  </label>
                  <input
                    type="number"
                    value={settings.nspWarningHours}
                    onChange={(e) => setSettings({ ...settings, nspWarningHours: parseInt(e.target.value) })}
                    className="w-32 border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-400 mt-1">Jika sudah lewat jam ini dan belum check-out, akan dianggap NSP</p>
                </div>
              )}
            </div>
          </div>

          {/* Lainnya */}
          <div>
            <h2 className="text-lg font-semibold mb-4">📅 Lainnya</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.allowOvertime}
                  onChange={(e) => setSettings({ ...settings, allowOvertime: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Izinkan lembur (menghitung jam kerja lebih dari shift)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.weekendIsHoliday}
                  onChange={(e) => setSettings({ ...settings, weekendIsHoliday: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Weekend (Sabtu/Minggu) dianggap hari libur</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              {saving ? "Menyimpan..." : "💾 Simpan Pengaturan"}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}