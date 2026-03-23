// app/(admin)/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth, storage } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ProtectedRoute from "@/components/ProtectedRoute";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  jabatan?: string;
  dailyRate?: number;
  company?: string;
  location?: string;
  joinDate?: string;
  photoUrl?: string;
  isActive: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [department, setDepartment] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const arr: User[] = [];
      snap.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() } as User);
      });
      setUsers(arr);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (uid: string) => {
    if (!photo) return null;
    const storageRef = ref(storage, `profile/${uid}.jpg`);
    await uploadBytes(storageRef, photo);
    return await getDownloadURL(storageRef);
  };

  const saveUser = async () => {
    if (!name || !email) {
      alert("Nama dan email wajib diisi");
      return;
    }

    setFormLoading(true);
    try {
      if (editingId) {
        // Update existing user
        const updateData: any = {
          name,
          email,
          role,
          department,
          jabatan,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          company,
          location,
          joinDate,
          isActive,
          updatedAt: Timestamp.now(),
        };
        await updateDoc(doc(db, "users", editingId), updateData);
        alert("✅ User berhasil diupdate");
      } else {
        // Create new user
        if (!password) {
          alert("Password wajib diisi untuk user baru");
          setFormLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const photoUrl = await uploadPhoto(uid);

        await setDoc(doc(db, "users", uid), {
          name,
          email,
          role,
          department,
          jabatan,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          company,
          location,
          joinDate,
          photoUrl,
          isActive: true,
          createdAt: Timestamp.now(),
        });
        alert("✅ User berhasil ditambahkan");
      }
      resetForm();
      loadUsers();
      setShowForm(false);
    } catch (error: any) {
      alert("❌ Error: " + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!confirm(`Kirim reset password ke ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("✅ Email reset password terkirim");
    } catch (error: any) {
      alert("❌ Error: " + error.message);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        isActive: !user.isActive,
      });
      loadUsers();
      alert(`✅ Status user berhasil diubah menjadi ${!user.isActive ? "aktif" : "nonaktif"}`);
    } catch (error: any) {
      alert("❌ Error: " + error.message);
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Hapus user "${user.name}"? Data tidak bisa dikembalikan!`)) return;
    try {
      await deleteDoc(doc(db, "users", user.id));
      loadUsers();
      alert("✅ User berhasil dihapus");
    } catch (error: any) {
      alert("❌ Error: " + error.message);
    }
  };

  const editUser = (user: User) => {
    setName(user.name || "");
    setEmail(user.email || "");
    setRole(user.role || "employee");
    setDepartment(user.department || "");
    setJabatan(user.jabatan || "");
    setDailyRate(user.dailyRate?.toString() || "");
    setCompany(user.company || "");
    setLocation(user.location || "");
    setJoinDate(user.joinDate || "");
    setIsActive(user.isActive ?? true);
    setEditingId(user.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setDepartment("");
    setJabatan("");
    setDailyRate("");
    setCompany("");
    setLocation("");
    setJoinDate("");
    setPhoto(null);
    setIsActive(true);
    setEditingId(null);
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-700",
      admin: "bg-red-100 text-red-700",
      hr: "bg-blue-100 text-blue-700",
      spv: "bg-yellow-100 text-yellow-700",
      employee: "bg-gray-100 text-gray-700",
    };
    return styles[role] || styles.employee;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR",
      spv: "Supervisor",
      employee: "Employee",
    };
    return labels[role] || role;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const roleOptions = [
    { value: "ALL", label: "All Roles" },
    { value: "super_admin", label: "Super Admin" },
    { value: "admin", label: "Admin" },
    { value: "hr", label: "HR" },
    { value: "spv", label: "Supervisor" },
    { value: "employee", label: "Employee" },
  ];

  const jabatanOptions = ["Casual", "Daily Worker", "Staff", "Supervisor", "Manager"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Users Management
            </h1>
            <p className="text-gray-500 mt-1">Manage employee accounts and permissions</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="text-xl">+</span>
            {showForm ? "Close Form" : "Add User"}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600">Total Users</p>
                <p className="text-2xl font-bold text-blue-800">{users.length}</p>
              </div>
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-600">Active</p>
                <p className="text-2xl font-bold text-green-800">
                  {users.filter((u) => u.isActive).length}
                </p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-red-600">Inactive</p>
                <p className="text-2xl font-bold text-red-800">
                  {users.filter((u) => !u.isActive).length}
                </p>
              </div>
              <span className="text-2xl">⛔</span>
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-purple-600">Departments</p>
                <p className="text-2xl font-bold text-purple-800">
                  {new Set(users.map((u) => u.department).filter(Boolean)).size}
                </p>
              </div>
              <span className="text-2xl">🏢</span>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* User Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>{editingId ? "✏️" : "➕"}</span>
                {editingId ? "Edit User" : "Add New User"}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  placeholder="Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  placeholder="Email *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                {!editingId && (
                  <input
                    type="password"
                    placeholder="Password *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  />
                )}
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="employee">Employee</option>
                  <option value="spv">Supervisor (SPV)</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <input
                  placeholder="Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <select
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Position</option>
                  {jabatanOptions.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Daily Rate (Rp)"
                  type="number"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  placeholder="Company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  placeholder="Work Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100"
                />
                {editingId && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveUser}
                  disabled={formLoading}
                  className={`px-6 py-2 rounded-lg text-white font-medium transition-all ${
                    formLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {formLoading ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>📋</span>
              User List
              <span className="text-sm text-gray-500 ml-2">({filteredUsers.length} users)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Position</th>
                  <th className="px-4 py-3 text-left">Rate</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.photoUrl ? (
                          <img
                            src={user.photoUrl}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {getInitials(user.name)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{user.department || "-"}</td>
                    <td className="px-4 py-3">{user.jabatan || "-"}</td>
                    <td className="px-4 py-3">
                      {user.dailyRate ? `Rp ${user.dailyRate.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editUser(user)}
                          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => resetPassword(user.email)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                            user.isActive
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl block mb-2">👥</span>
                No users found
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}