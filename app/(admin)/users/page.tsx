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
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ProtectedRoute from "@/components/ProtectedRoute";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

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
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Helper function to normalize department to UPPERCASE
const normalizeDepartment = (dept: string): string => {
  if (!dept) return "";
  return dept.trim().toUpperCase();
};

// Helper function to normalize all text fields that should be consistent
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text.trim().toUpperCase();
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [autoLoginAfterAdd, setAutoLoginAfterAdd] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  const bankOptions = [
    "BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Danamon", "Permata",
    "Maybank", "OCBC NISP", "UOB", "Panin Bank", "Bank Mega",
    "Bank Syariah Indonesia", "Bank Jago", "Bank Neo Commerce", "SeaBank", "Lainnya",
  ];

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
      toast.error("Gagal memuat data users");
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

  const autoLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Auto login successful");
    } catch (error: any) {
      console.error("Auto login failed:", error.message);
    }
  };

  const saveUser = async () => {
    if (!name || !email) {
      toast.error("Nama dan email wajib diisi");
      return;
    }

    setFormLoading(true);
    try {
      const normalizedDepartment = normalizeDepartment(department);
      const normalizedCompany = normalizeText(company);
      const normalizedLocation = normalizeText(location);
      const normalizedBankName = normalizeText(bankName);
      
      if (editingId) {
        const updateData: any = {
          name, email, role, 
          department: normalizedDepartment,
          jabatan,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          company: normalizedCompany,
          location: normalizedLocation,
          joinDate, isActive,
          bankName: normalizedBankName,
          bankAccountNumber,
          bankAccountName,
          updatedAt: Timestamp.now(),
        };
        await updateDoc(doc(db, "users", editingId), updateData);
        toast.success("✅ User berhasil diupdate");
      } else {
        if (!password) {
          toast.error("Password wajib diisi untuk user baru");
          setFormLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const photoUrl = await uploadPhoto(uid);

        await setDoc(doc(db, "users", uid), {
          name, email, role, 
          department: normalizedDepartment,
          jabatan,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          company: normalizedCompany,
          location: normalizedLocation,
          joinDate, photoUrl,
          isActive: true,
          bankName: normalizedBankName,
          bankAccountNumber,
          bankAccountName,
          createdAt: Timestamp.now(),
        });
        toast.success("✅ User berhasil ditambahkan");
        
        if (autoLoginAfterAdd) {
          await autoLogin(email, password);
          toast.success("Auto login berhasil");
        }
      }
      resetForm();
      loadUsers();
      setShowForm(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const confirmed = window.confirm(`Kirim reset password ke ${email}?`);
    if (!confirmed) return;
    
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("✅ Email reset password terkirim");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        isActive: !user.isActive,
      });
      loadUsers();
      toast.success(`Status user berhasil diubah menjadi ${!user.isActive ? "aktif" : "nonaktif"}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteUser = async (user: User) => {
    const confirmed = window.confirm(`Hapus user "${user.name}"? Data tidak bisa dikembalikan!`);
    if (!confirmed) return;
    
    try {
      await deleteDoc(doc(db, "users", user.id));
      loadUsers();
      toast.success("✅ User berhasil dihapus");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
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
    setBankName(user.bankName || "");
    setBankAccountNumber(user.bankAccountNumber || "");
    setBankAccountName(user.bankAccountName || "");
    setEditingId(user.id);
    setShowForm(true);
    setShowDetailModal(false);
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
    setBankName("");
    setBankAccountNumber("");
    setBankAccountName("");
    setEditingId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      setImportData(rows);
      setShowImportModal(true);
    };
    reader.readAsBinaryString(file);
  };

  const triggerFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = (e) => {
      const event = e as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(event);
    };
    input.click();
  };

  const importFromGoogleSheets = () => {
    const url = prompt("Enter Google Sheets shareable link or ID:");
    if (!url) return;
    
    let sheetId = url;
    if (url.includes("/d/")) {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) sheetId = match[1];
    }
    
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    
    fetch(exportUrl)
      .then(response => response.arrayBuffer())
      .then(data => {
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        setImportData(rows);
        setShowImportModal(true);
      })
      .catch(error => {
        toast.error("Failed to fetch Google Sheet. Make sure it's public or accessible.");
        console.error(error);
      });
  };

  const downloadTemplate = () => {
    const template = [
      {
        Nama: "John Doe",
        Email: "john@example.com",
        Password: "password123",
        Role: "employee",
        Department: "IT",
        Jabatan: "Staff",
        DailyRate: 0,
        Company: "AVIARYPARKS",
        Location: "JAKARTA",
        JoinDate: "2024-01-01",
        BankName: "BCA",
        BankAccountNumber: "1234567890",
        BankAccountName: "John Doe",
      },
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users Template");
    XLSX.writeFile(wb, "user_import_template.xlsx");
    toast.success("Template downloaded");
  };

  const importUsers = async () => {
    if (importData.length === 0) return;
    
    setImporting(true);
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      setImportProgress({ current: i + 1, total: importData.length, success, failed });
      
      try {
        const name = row.Nama || row.name;
        const email = row.Email || row.email;
        const password = row.Password || row.password;
        const role = (row.Role || row.role || "employee").toLowerCase();
        const department = normalizeDepartment(row.Department || row.department || "");
        const jabatan = row.Jabatan || row.jabatan || "";
        const dailyRate = row.DailyRate || row.dailyRate || 0;
        const company = normalizeText(row.Company || row.company || "");
        const location = normalizeText(row.Location || row.location || "");
        const joinDate = row.JoinDate || row.joinDate || "";
        const bankName = normalizeText(row.BankName || row.bankName || "");
        const bankAccountNumber = row.BankAccountNumber || row.bankAccountNumber || "";
        const bankAccountName = row.BankAccountName || row.bankAccountName || "";
        
        if (!name || !email || !password) {
          failed++;
          continue;
        }
        
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        
        await setDoc(doc(db, "users", uid), {
          name, email, role, department, jabatan,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          company, location, joinDate,
          isActive: true,
          bankName, bankAccountNumber, bankAccountName,
          createdAt: Timestamp.now(),
        });
        
        success++;
      } catch (error: any) {
        console.error("Import error:", error);
        failed++;
      }
    }
    
    setImportProgress({ current: importData.length, total: importData.length, success, failed });
    toast.success(`✅ Import selesai!\nBerhasil: ${success}\nGagal: ${failed}`);
    
    setImportData([]);
    setShowImportModal(false);
    setImporting(false);
    loadUsers();
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-700",
      admin: "bg-red-100 text-red-700",
      hr: "bg-blue-100 text-blue-700",
      spv: "bg-yellow-100 text-yellow-700",
      employee: "bg-gray-100 text-gray-700",
      training: "bg-indigo-100 text-indigo-700",
      intern: "bg-cyan-100 text-cyan-700",
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
      training: "Training",
      intern: "Intern / Magang",
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

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return "-";
    return timestamp.toDate().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    { value: "training", label: "Training" },
    { value: "intern", label: "Intern / Magang" },
  ];

  const jabatanOptions = [
    "Casual", "Daily Worker", "Staff", "Supervisor", "Manager", "Training", "Intern / Magang",
  ];

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
      <div className="space-y-6 p-6">
        {/* Header dengan Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold">Users Management</h1>
            <p className="text-green-100 mt-1">Manage employee accounts and permissions</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{users.length}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{users.filter((u) => u.isActive).length}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-red-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Inactive</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{users.filter((u) => !u.isActive).length}</p>
              </div>
              <div className="rounded-xl bg-red-100 p-3">
                <span className="text-2xl">⛔</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Departments</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{new Set(users.map((u) => u.department).filter(Boolean)).size}</p>
              </div>
              <div className="rounded-xl bg-purple-100 p-3">
                <span className="text-2xl">🏢</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterRole("ALL");
              }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">+</span>
            {showForm ? "Close Form" : "Add User"}
          </button>
          <button
            onClick={triggerFileUpload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📁</span>
            Upload Excel
          </button>
          <button
            onClick={importFromGoogleSheets}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📊</span>
            Google Sheets
          </button>
          <button
            onClick={downloadTemplate}
            className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📄</span>
            Template
          </button>
        </div>

        {/* Auto Login Toggle in Form */}
        {showForm && !editingId && (
          <div className="rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLoginAfterAdd}
                  onChange={(e) => setAutoLoginAfterAdd(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  🔐 Auto login setelah menambahkan user (langsung login ke akun baru)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Import Modal - tetap sama karena sudah pakai toast untuk feedback */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-scale-in">
              <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200 p-5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Import Users from Excel</h2>
                  <p className="text-xs text-gray-500 mt-1">Upload file Excel untuk import data user</p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-auto max-h-[60vh]">
                {importing ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">
                      Importing... ({importProgress.current} / {importProgress.total})
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      ✅ Success: {importProgress.success} | ❌ Failed: {importProgress.failed}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        Found <strong>{importData.length}</strong> records to import
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                        <strong>⚠️ Note:</strong> Email must be unique. Password will be used for initial login.
                        Department akan otomatis diubah menjadi HURUF BESAR semua.
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Email</th>
                            <th className="px-3 py-2 text-left">Role</th>
                            <th className="px-3 py-2 text-left">Department (auto UPPERCASE)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="px-3 py-2">{row.Nama || row.name || "-"}</td>
                              <td className="px-3 py-2">{row.Email || row.email || "-"}</td>
                              <td className="px-3 py-2">{row.Role || row.role || "employee"}</td>
                              <td className="px-3 py-2 font-mono text-green-700">
                                {normalizeDepartment(row.Department || row.department || "-")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              
              <div className="sticky bottom-0 bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  disabled={importing}
                >
                  Cancel
                </button>
                {!importing && (
                  <button
                    onClick={importUsers}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Import {importData.length} Users
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Form - kontennya sama, hanya alert yang sudah diganti */}
        {showForm && (
          <div className="rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingId ? "✏️ Edit User" : "➕ Add New User"}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {editingId ? "Edit data user yang sudah ada" : "Isi form untuk menambahkan user baru"}
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  placeholder="Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <input
                  placeholder="Email *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                {!editingId && (
                  <input
                    type="password"
                    placeholder="Password *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                )}
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="employee">Employee</option>
                  <option value="spv">Supervisor (SPV)</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="training">Training</option>
                  <option value="intern">Intern / Magang</option>
                </select>
                <div>
                  <input
                    placeholder="Department (akan otomatis HURUF BESAR)"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {department && (
                    <p className="text-xs text-green-600 mt-1">
                      → Akan disimpan sebagai: <span className="font-mono font-bold">{normalizeDepartment(department)}</span>
                    </p>
                  )}
                </div>
                <select
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="">Select Position</option>
                  {jabatanOptions.map((j) => (<option key={j} value={j}>{j}</option>))}
                </select>
                {(jabatan === "Casual" || jabatan === "Daily Worker") && (
                  <input
                    placeholder="Daily Rate (Rp)"
                    type="number"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                )}
                <div>
                  <input
                    placeholder="Company (otomatis HURUF BESAR)"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {company && (
                    <p className="text-xs text-green-600 mt-1">→ {normalizeText(company)}</p>
                  )}
                </div>
                <div>
                  <input
                    placeholder="Work Location (otomatis HURUF BESAR)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  {location && (
                    <p className="text-xs text-green-600 mt-1">→ {normalizeText(location)}</p>
                  )}
                </div>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100"
                />
                
                <div className="col-span-full">
                  <div className="border-t border-gray-200 my-2 pt-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">🏦 Informasi Bank</p>
                  </div>
                </div>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="">Pilih Bank</option>
                  {bankOptions.map((bank) => (<option key={bank} value={bank}>{bank}</option>))}
                </select>
                <input
                  placeholder="Nomor Rekening"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <input
                  placeholder="Nama Pemilik Rekening"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                
                {editingId && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveUser}
                  disabled={formLoading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
        <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <span>📋</span>
                User List
              </h2>
              <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Department</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Position</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Rate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    onClick={() => openDetailModal(user)}
                    className={`border-b cursor-pointer transition-all duration-150 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-green-50 hover:shadow-inner`}
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
                    <td className="px-4 py-3">
                      <span className="font-mono text-green-700 font-medium">{user.department || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.jabatan || "-"}</td>
                    <td className="px-4 py-3">
                      {user.jabatan === "Training" || user.jabatan === "Intern / Magang" ? (
                        <span className="text-gray-400">-</span>
                      ) : user.dailyRate ? (
                        `Rp ${user.dailyRate.toLocaleString()}`
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 flex-wrap">
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
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETAIL USER - konten sama */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 flex justify-between items-center">
              <div className="flex items-center gap-4">
                {selectedUser.photoUrl ? (
                  <img 
                    src={selectedUser.photoUrl} 
                    alt={selectedUser.name} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">{getInitials(selectedUser.name)}</span>
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                  <p className="text-green-100 text-sm">{selectedUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)} 
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>👤</span> Informasi Pribadi
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Nama Lengkap</span>
                      <span className="font-medium text-gray-800">{selectedUser.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Email</span>
                      <span className="font-medium text-gray-800">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Role</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(selectedUser.role)}`}>
                        {getRoleLabel(selectedUser.role)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedUser.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {selectedUser.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>💼</span> Informasi Pekerjaan
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Department</span>
                      <span className="font-mono font-bold text-green-700">{selectedUser.department || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Jabatan</span>
                      <span className="font-medium text-gray-800">{selectedUser.jabatan || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Daily Rate</span>
                      <span className="font-medium text-gray-800">
                        {selectedUser.jabatan === "Training" || selectedUser.jabatan === "Intern / Magang" 
                          ? "-" 
                          : selectedUser.dailyRate 
                            ? `Rp ${selectedUser.dailyRate.toLocaleString()}` 
                            : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Bergabung Sejak</span>
                      <span className="font-medium text-gray-800">{selectedUser.joinDate || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🏢</span> Perusahaan & Lokasi
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Company</span>
                      <span className="font-mono font-bold text-green-700">{selectedUser.company || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Work Location</span>
                      <span className="font-mono font-bold text-green-700">{selectedUser.location || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🏦</span> Informasi Bank
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Bank</span>
                      <span className="font-medium text-gray-800">{selectedUser.bankName || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Nomor Rekening</span>
                      <span className="font-mono font-medium text-gray-800">{selectedUser.bankAccountNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Nama Pemilik</span>
                      <span className="font-medium text-gray-800">{selectedUser.bankAccountName || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>⏱️</span> Metadata
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Akun dibuat</span>
                      <span className="text-sm text-gray-600">{formatDate(selectedUser.createdAt)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Terakhir diupdate</span>
                      <span className="text-sm text-gray-600">{formatDate(selectedUser.updatedAt) || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  editUser(selectedUser);
                }}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>✏️</span> Edit User
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  resetPassword(selectedUser.email);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🔑</span> Reset Password
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </ProtectedRoute>
  );
}