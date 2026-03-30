// app/(admin)/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
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
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      loadUserData();
    }
  }, [user, authLoading]);

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
        
        // Format join date
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

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Profil Saya</h1>
            <p className="text-gray-500 text-sm mt-1">Kelola informasi profil Anda</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Edit Profil
            </button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with Avatar */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white flex items-center justify-center overflow-hidden">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-white font-bold">
                      {name?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 bg-white rounded-full p-2 cursor-pointer hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{name || "Pengguna"}</h2>
                <div className="mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(role)}`}>
                    {getRoleDisplayName(role)}
                  </span>
                </div>
              </div>
              {isUploading && (
                <div className="text-white text-sm">Uploading...</div>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departemen
                </label>
                <div className="text-gray-900 font-medium bg-gray-50 px-4 py-2 rounded-lg">
                  {department}
                </div>
              </div>

              {/* Jabatan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jabatan
                </label>
                <div className="text-gray-900 font-medium bg-gray-50 px-4 py-2 rounded-lg">
                  {jabatan}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg">
                  {email}
                </div>
              </div>

              {/* Bergabung Sejak */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bergabung Sejak
                </label>
                <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg">
                  {joinDate}
                </div>
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg">
                    {name || "-"}
                  </div>
                )}
              </div>

              {/* No Telepon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. Telepon
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg">
                    {phone || "-"}
                  </div>
                )}
              </div>

              {/* Alamat */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat
                </label>
                {isEditing ? (
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg min-h-[80px]">
                    {address || "-"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-lg">📱</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Versi Web</p>
              <p className="font-medium text-gray-800">AviaryPark Indonesia v1.0.2</p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} AviaryPark Indonesia. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}