// app/mobile/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

export default function MobileProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // 🔥 STATE UNTUK GANTI PASSWORD
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [email, setEmail] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setDepartment(data.department || "-");
        setJabatan(data.jabatan || data.position || "-");
        setEmail(user.email || data.email || "-");
        
        if (data.joinDate) {
          setJoinDate(data.joinDate);
        } else if (data.createdAt?.toDate) {
          const date = data.createdAt.toDate();
          setJoinDate(date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));
        } else {
          setJoinDate("-");
        }
        
        setRole(data.role || "employee");
        setPhotoUrl(data.photoUrl || null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: name,
        phone: phone,
        address: address,
        updatedAt: new Date(),
      });
      setIsEditing(false);
      alert("✅ Profil berhasil diupdate");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("❌ Gagal update profil");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profile_photos/${user.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, "users", user.uid), {
        photoUrl: downloadUrl,
        updatedAt: new Date(),
      });
      
      setPhotoUrl(downloadUrl);
      alert("✅ Foto profil berhasil diperbarui");
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("❌ Gagal upload foto");
    } finally {
      setIsUploading(false);
    }
  };

  // 🔥 FUNGSI GANTI PASSWORD
  const handleChangePassword = async () => {
    setPasswordError("");
    
    // Validasi
    if (!currentPassword) {
      setPasswordError("Password saat ini wajib diisi");
      return;
    }
    
    if (!newPassword) {
      setPasswordError("Password baru wajib diisi");
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError("Password baru minimal 6 karakter");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password tidak cocok");
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("User tidak ditemukan");
      }
      
      // Re-authenticate user sebelum ganti password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      // Bersihkan form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
      
      alert("✅ Password berhasil diubah! Silakan login kembali dengan password baru.");
      
      // Logout user setelah ganti password
      await signOut(auth);
      router.push("/login");
      
    } catch (error: any) {
      console.error("Error changing password:", error);
      
      if (error.code === "auth/wrong-password") {
        setPasswordError("Password saat ini salah");
      } else if (error.code === "auth/weak-password") {
        setPasswordError("Password terlalu lemah, minimal 6 karakter");
      } else if (error.code === "auth/requires-recent-login") {
        setPasswordError("Sesi sudah lama, silakan login ulang");
      } else {
        setPasswordError(error.message || "Gagal mengubah password");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      alert("Gagal logout");
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "super_admin": return "Super Administrator";
      case "admin": return "Administrator";
      case "hr": return "HR";
      case "spv": return "Supervisor";
      case "manager": return "Manager";
      case "training": return "Training";
      case "intern": return "Intern / Magang";
      default: return "Employee";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-700";
      case "admin": return "bg-red-100 text-red-700";
      case "hr": return "bg-blue-100 text-blue-700";
      case "spv": return "bg-orange-100 text-orange-700";
      case "manager": return "bg-yellow-100 text-yellow-700";
      case "training": return "bg-cyan-100 text-cyan-700";
      case "intern": return "bg-teal-100 text-teal-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-green-900 to-green-800">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-white">Profil Saya</h1>
          <div className="flex-1"></div>
          {/* Tombol Ganti Password */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="text-yellow-400 p-2 hover:bg-yellow-500/20 rounded-full transition-colors"
            title="Ganti Password"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
          {/* Tombol Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="text-red-400 p-2 hover:bg-red-500/20 rounded-full transition-colors"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-green-300 text-sm hover:text-green-200"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-white/70 text-sm hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="text-green-300 text-sm hover:text-green-200 disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          )}
        </div>

        {/* Foto Profil */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-gradient-to-r from-green-500 to-green-600 p-0.5">
              <div className="w-full h-full rounded-full bg-green-800 overflow-hidden">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    {name?.charAt(0) || "U"}
                  </div>
                )}
              </div>
            </div>
            <label
              htmlFor="photo-upload"
              className="absolute bottom-0 right-0 bg-green-500 rounded-full p-2 cursor-pointer hover:bg-green-600 transition-colors shadow-lg"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        </div>

        {/* Nama dan Role */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">{name || "Pengguna"}</h2>
          <div className="inline-block mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(role)}`}>
              {getRoleDisplayName(role)}
            </span>
          </div>
        </div>

        {/* Informasi Detail */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-green-400">👤</span>
              <h3 className="text-white font-semibold">Informasi Pribadi</h3>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Department */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">🏢</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Departemen</p>
                <p className="text-white font-medium">{department}</p>
              </div>
            </div>
            
            {/* Jabatan */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">💼</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Jabatan</p>
                <p className="text-white font-medium">{jabatan}</p>
              </div>
            </div>
            
            {/* Email */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">📧</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Email</p>
                <p className="text-white font-medium">{email}</p>
              </div>
            </div>
            
            {/* Nama Lengkap (Editable) */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">✏️</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Nama Lengkap</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/20 text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-500"
                  />
                ) : (
                  <p className="text-white font-medium">{name || "-"}</p>
                )}
              </div>
            </div>
            
            {/* No Telepon (Editable) */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">📱</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">No. Telepon</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/20 text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-500"
                  />
                ) : (
                  <p className="text-white font-medium">{phone || "-"}</p>
                )}
              </div>
            </div>
            
            {/* Alamat (Editable) */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">📍</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Alamat</p>
                {isEditing ? (
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="w-full bg-white/20 text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-500"
                  />
                ) : (
                  <p className="text-white font-medium">{address || "-"}</p>
                )}
              </div>
            </div>
            
            {/* Bergabung Sejak */}
            <div className="flex items-start gap-3">
              <span className="text-white/50 w-8">📅</span>
              <div className="flex-1">
                <p className="text-white/50 text-xs">Bergabung Sejak</p>
                <p className="text-white font-medium">{joinDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Versi Aplikasi */}
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-white/50">📱</span>
            <div>
              <p className="text-white/50 text-xs">Versi Aplikasi</p>
              <p className="text-white text-sm">AviaryPark Indonesia v1.0.2</p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center mt-6">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} AviaryPark Indonesia
          </p>
        </div>
      </div>

      {/* 🔥 MODAL GANTI PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Ganti Password</h3>
                </div>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError("");
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Password Saat Ini */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Masukkan password saat ini"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                
                {/* Password Baru */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Minimal 6 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                
                {/* Konfirmasi Password Baru */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Ulangi password baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                
                {/* Error Message */}
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{passwordError}</p>
                  </div>
                )}
                
                {/* Info */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-700 text-xs">
                    ⚠️ Setelah mengganti password, Anda akan logout dan harus login kembali dengan password baru.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError("");
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Memproses...
                    </div>
                  ) : (
                    "Ganti Password"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Konfirmasi Logout</h3>
              <p className="text-gray-500 text-sm mb-6">Apakah Anda yakin ingin keluar dari aplikasi?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}