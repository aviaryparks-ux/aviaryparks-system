// app/(admin)/manager-on-duty/schedule/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useSearchParams } from "next/navigation";
import { MODSchedule, getDayOfWeek, getDayName, formatDate, getRoleLabel } from "@/types/mod";

type UserOption = {
  uid: string;
  name: string;
  department: string;
  role: string;
};

export default function MODSchedulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const prefillDate = searchParams.get("date");

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [managers, setManagers] = useState<UserOption[]>([]);
  const [spvSales, setSpvSales] = useState<UserOption[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserOption[]>([]);
  const [existingSchedule, setExistingSchedule] = useState<MODSchedule | null>(null);

  // Get today's date or prefill date
  const getDefaultDate = () => {
    if (prefillDate) return prefillDate;
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    date: getDefaultDate(),
    userType: 'manager' as 'manager' | 'spv' | 'user',
    user: null as UserOption | null,
    notes: ""
  });

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const userList: UserOption[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        userList.push({
          uid: doc.id,
          name: data.name || "",
          department: data.department || "",
          role: data.role || ""
        });
      });
      setUsers(userList);

      // Filter managers
      const mgrs = userList.filter(u =>
        u.role === "manager" || u.role === "admin" || u.role === "super_admin"
      );
      setManagers(mgrs);

      // Filter SPV Sales
      const spvs = userList.filter(u =>
        u.role === "spv" || u.department?.toLowerCase().includes("sales")
      );
      setSpvSales(spvs);

      // Filter Users
      const staffs = userList.filter(u => 
        u.role === "user" || !u.role
      );
      setStaffUsers(staffs);
    };
    loadUsers();
  }, []);

  // Load existing schedule if editing
  useEffect(() => {
    if (editId) {
      const loadSchedule = async () => {
        const docSnap = await getDoc(doc(db, "mod_schedules", editId));
        if (docSnap.exists()) {
          const data = docSnap.data() as MODSchedule;
          setExistingSchedule(data);
          setForm({
            date: data.date,
            userType: (data.role as any) || 'manager',
            user: {
              uid: data.userId,
              name: data.userName,
              department: data.department,
              role: data.role
            },
            notes: data.notes || ""
          });
        }
      };
      loadSchedule();
    }
  }, [editId]);

  // Filter options based on userType
  let userOptions = managers;
  if (form.userType === 'spv') userOptions = spvSales;
  if (form.userType === 'user') userOptions = staffUsers;

  // Check if selected date is valid (Fri/Sat/Sun)
  const selectedDateDayOfWeek = getDayOfWeek(form.date);
  const isValidDay = selectedDateDayOfWeek !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.date) {
      alert("Mohon pilih tanggal!");
      return;
    }

    if (!isValidDay) {
      alert("MOD hanya bisa dijadwalkan untuk hari Jumat, Sabtu, atau Minggu!");
      return;
    }

    if (!form.user) {
      alert("Mohon pilih penanggung jawab MOD!");
      return;
    }

    setLoading(true);

    try {
      const data = {
        date: form.date,
        dayOfWeek: selectedDateDayOfWeek,
        userId: form.user.uid,
        userName: form.user.name,
        department: form.user.department,
        role: form.userType,
        notes: form.notes,
        updatedAt: new Date()
      };

      if (editId && existingSchedule) {
        // Update existing
        await updateDoc(doc(db, "mod_schedules", editId), {
          ...data,
          createdAt: existingSchedule.createdAt,
          createdBy: existingSchedule.createdBy,
          createdByName: existingSchedule.createdByName,
          updatedBy: user?.uid,
          updatedByName: user?.name
        });
        alert("✅ Jadwal MOD berhasil diupdate!");
      } else {
        // Check if schedule already exists for this date
        const q = query(
          collection(db, "mod_schedules"),
          where("date", "==", form.date)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          alert("⚠️ Sudah ada jadwal MOD untuk tanggal ini. Gunakan edit untuk mengubah.");
          setLoading(false);
          return;
        }

        // Create new
        await addDoc(collection(db, "mod_schedules"), {
          ...data,
          createdAt: new Date(),
          createdBy: user?.uid,
          createdByName: user?.name,
          updatedBy: user?.uid,
          updatedByName: user?.name
        });
        alert("✅ Jadwal MOD berhasil dibuat!");
      }

      router.push("/manager-on-duty");
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("❌ Gagal menyimpan jadwal MOD");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm("Yakin ingin menghapus jadwal MOD ini?")) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "mod_schedules", editId));
      alert("✅ Jadwal MOD berhasil dihapus!");
      router.push("/manager-on-duty");
    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("❌ Gagal menghapus jadwal MOD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr"]}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-xl">
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative z-10 text-center">
            <h1 className="text-2xl font-bold">
              📅 {editId ? "Edit" : "Buat"} Jadwal MOD
            </h1>
            <p className="text-blue-100 mt-1">
              {editId ? `Mengubah jadwal MOD untuk ${formatDate(existingSchedule?.date || form.date)}` : "Tentukan siapa yang bertugas sebagai MOD"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date Selection */}
          <div className="rounded-xl bg-white p-6 shadow-md border border-gray-100">
            <h2 className="font-bold text-lg text-gray-800 mb-4">📆 Pilih Tanggal</h2>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
              {form.date && (
                <div className={`px-4 py-2 rounded-lg font-medium ${
                  isValidDay
                    ? selectedDateDayOfWeek === 'friday' ? 'bg-emerald-100 text-emerald-700'
                    : selectedDateDayOfWeek === 'saturday' ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {isValidDay
                    ? `${getDayName(selectedDateDayOfWeek!)} (${formatDate(form.date)})`
                    : '❌ Hanya Jumat, Sabtu, Minggu'
                  }
                </div>
              )}
            </div>
          </div>

          {/* User Type Selection */}
          <div className="rounded-xl bg-white p-6 shadow-md border border-gray-100">
            <h2 className="font-bold text-lg text-gray-800 mb-4">👤 Penanggung Jawab MOD</h2>

            {/* Type Toggle */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setForm({ ...form, userType: 'manager', user: null })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  form.userType === 'manager'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🕌 Manager (Jumat)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, userType: 'spv', user: null })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  form.userType === 'spv'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🌙 SPV Sales (Sabtu)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, userType: 'user', user: null })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  form.userType === 'user'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🌞 User/Staff (Minggu)
              </button>
            </div>

            <select
              value={form.user?.uid || ""}
              onChange={(e) => {
                const selected = userOptions.find(o => o.uid === e.target.value);
                setForm({ ...form, user: selected || null });
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            >
              <option value="">-- Pilih {form.userType === 'manager' ? 'Manager' : form.userType === 'spv' ? 'SPV Sales' : 'User/Staff'} --</option>
              {userOptions.map(opt => (
                <option key={opt.uid} value={opt.uid}>
                  {opt.name} ({opt.department || opt.role})
                </option>
              ))}
            </select>

            {/* Selected User Preview */}
            {form.user && (
              <div className={`mt-4 p-4 rounded-xl border-2 ${
                form.userType === 'manager' ? 'border-emerald-200 bg-emerald-50' : 
                form.userType === 'spv' ? 'border-blue-200 bg-blue-50' : 
                'border-amber-200 bg-amber-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    form.userType === 'manager' ? 'bg-emerald-200' : 
                    form.userType === 'spv' ? 'bg-blue-200' : 
                    'bg-amber-200'
                  }`}>
                    👤
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{form.user.name}</p>
                    <p className="text-sm text-gray-600">{form.user.department}</p>
                    <p className="text-xs text-gray-500">{getRoleLabel(form.userType)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl bg-white p-6 shadow-md border border-gray-100">
            <h2 className="font-bold text-lg text-gray-800 mb-4">📝 Catatan (Opsional)</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Tambahkan catatan jika diperlukan..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-xl transition-colors"
            >
              Batal
            </button>
            {editId && (user?.role === "super_admin") && (
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              >
                🗑️ Hapus
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !isValidDay || !form.user}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  💾 {editId ? "Update Jadwal" : "Simpan Jadwal"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}