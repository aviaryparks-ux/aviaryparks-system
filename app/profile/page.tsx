// app/profile/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useNotification } from "@/components/ToastNotification";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Redirect jika tidak login
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setDepartment(user.department || "");
      setJabatan(user.jabatan || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setPhotoUrl(user.photoUrl || "");
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      showNotification("Nama tidak boleh kosong", "error");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", user!.uid);
      await updateDoc(userRef, {
        name: name.trim(),
        department: department.trim(),
        jabatan: jabatan.trim(),
        phone: phone.trim(),
        address: address.trim(),
        updatedAt: new Date(),
      });
      
      showNotification("✅ Profil berhasil diperbarui", "success");
    } catch (error: any) {
      showNotification(`❌ Gagal update profil: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotification("File harus berupa gambar", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showNotification("Ukuran file maksimal 2MB", "error");
      return;
    }

    setPhotoLoading(true);
    try {
      const storageRef = ref(storage, `profile/${user!.uid}.jpg`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const userRef = doc(db, "users", user!.uid);
      await updateDoc(userRef, { photoUrl: downloadUrl });
      
      setPhotoUrl(downloadUrl);
      showNotification("✅ Foto profil berhasil diupdate", "success");
    } catch (error: any) {
      showNotification(`❌ Gagal upload foto: ${error.message}`, "error");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showNotification("Password saat ini wajib diisi", "error");
      return;
    }
    if (newPassword.length < 6) {
      showNotification("Password baru minimal 6 karakter", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification("Konfirmasi password tidak sesuai", "error");
      return;
    }

    setPasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await updatePassword(auth.currentUser!, newPassword);
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      
      showNotification("✅ Password berhasil diubah", "success");
    } catch (error: any) {
      if (error.code === "auth/wrong-password") {
        showNotification("Password saat ini salah", "error");
      } else {
        showNotification(`❌ Gagal ubah password: ${error.message}`, "error");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "hr": return "HR";
      case "manager": return "Manager";
      case "spv": return "Supervisor";
      case "training": return "Training";
      case "intern": return "Intern / Magang";
      default: return "Employee";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header dengan tombol back ke dashboard */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              My Profile
            </h1>
            <p className="text-gray-500 mt-1">Manage your personal information and account settings</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white rounded-lg shadow-sm border border-gray-200"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photo & Role */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              {/* Photo */}
              <div className="relative inline-block">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-green-500 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center border-4 border-green-500 shadow-lg mx-auto">
                    <span className="text-white text-3xl font-bold">
                      {getInitials(name || user?.name || "U")}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoLoading}
                  className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white p-2 rounded-full shadow-lg transition-colors"
                >
                  {photoLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              <h2 className="mt-4 text-xl font-semibold text-gray-800">{name || user?.name}</h2>
              <p className="text-sm text-gray-500">{email}</p>
              <div className="mt-2">
                <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                  {getRoleLabel(user?.role || "employee")}
                </span>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="w-full text-left text-sm text-blue-600 hover:text-blue-700"
                >
                  {showPasswordForm ? "Cancel" : "Change Password →"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>👤</span>
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email tidak dapat diubah</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position / Jabatan
                  </label>
                  <input
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+62 xxx xxx xxx"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Alamat lengkap"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className={`px-6 py-2 rounded-lg text-white font-medium transition-all ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Change Password Form */}
            {showPasswordForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🔐</span>
                  Change Password
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password (min. 6 karakter)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    className={`px-6 py-2 rounded-lg text-white font-medium transition-all ${
                      passwordLoading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {passwordLoading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}