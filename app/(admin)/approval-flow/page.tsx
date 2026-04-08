// app/(admin)/approval-flow/page.tsx
"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

type ApprovalLevel = {
  role: string;
  label: string;
  order: number;
};

export default function ApprovalFlowPage() {
  const [department, setDepartment] = useState("");
  const [flow, setFlow] = useState<ApprovalLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  const roles = [
    { value: "spv", label: "SPV", icon: "👔", description: "Supervisor" },
    { value: "manager", label: "Manager", icon: "💼", description: "Department Manager" },
    { value: "hrd", label: "HRD", icon: "📋", description: "Human Resources" },
    { value: "admin", label: "Admin", icon: "👨‍💼", description: "Administrator" },
  ];

  // Load all departments for dropdown
  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, "approval_settings", "departments"));
      if (settingsSnap.exists()) {
        setDepartments(settingsSnap.data().list || []);
      }
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  };

  useEffect(() => {
    if (department) {
      loadFlow();
    }
  }, [department]);

  const loadFlow = async () => {
    setLoading(true);
    try {
      const ref = doc(db, "approval_settings", department);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setFlow(snap.data().flow || []);
      } else {
        setFlow([]);
      }
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading flow:", error);
    } finally {
      setLoading(false);
    }
  };

  const addLevel = () => {
    setFlow([
      ...flow,
      { role: "spv", label: "SPV", order: flow.length + 1 },
    ]);
    setHasChanges(true);
  };

  const updateRole = (index: number, role: string) => {
    const arr = [...flow];
    const selectedRole = roles.find((r) => r.value === role);
    arr[index] = {
      ...arr[index],
      role,
      label: selectedRole?.label || role.toUpperCase(),
    };
    setFlow(arr);
    setHasChanges(true);
  };

  const removeLevel = (index: number) => {
    const arr = [...flow];
    arr.splice(index, 1);
    arr.forEach((item, idx) => {
      item.order = idx + 1;
    });
    setFlow(arr);
    setHasChanges(true);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...flow];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    arr.forEach((item, idx) => {
      item.order = idx + 1;
    });
    setFlow(arr);
    setHasChanges(true);
  };

  const moveDown = (index: number) => {
    if (index === flow.length - 1) return;
    const arr = [...flow];
    [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
    arr.forEach((item, idx) => {
      item.order = idx + 1;
    });
    setFlow(arr);
    setHasChanges(true);
  };

  const saveFlow = async () => {
    if (!department) {
      alert("Pilih department terlebih dahulu");
      return;
    }
    if (flow.length === 0) {
      alert("Minimal 1 level approval");
      return;
    }

    setSaving(true);
    try {
      const ref = doc(db, "approval_settings", department);
      await setDoc(ref, {
        department,
        flow,
        updatedAt: new Date().toISOString(),
      });
      
      // Update departments list
      if (!departments.includes(department)) {
        const newDepartments = [...departments, department];
        await setDoc(doc(db, "approval_settings", "departments"), {
          list: newDepartments,
        });
        setDepartments(newDepartments);
      }
      
      alert("✅ Approval flow berhasil disimpan");
      setHasChanges(false);
    } catch (error) {
      alert("❌ Gagal menyimpan approval flow");
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    if (confirm("Reset akan menghapus semua level. Lanjutkan?")) {
      setFlow([]);
      setHasChanges(true);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "spv":
        return "bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200";
      case "manager":
        return "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200";
      case "hrd":
        return "bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200";
      case "admin":
        return "bg-red-100 border-red-300 text-red-800 hover:bg-red-200";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200";
    }
  };

  const getRoleIcon = (role: string) => {
    const found = roles.find((r) => r.value === role);
    return found?.icon || "👤";
  };

  const getRoleDescription = (role: string) => {
    const found = roles.find((r) => r.value === role);
    return found?.description || "";
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="space-y-6 p-6">
        {/* Header dengan Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold">Approval Flow</h1>
            <p className="text-green-100 mt-1">
              Konfigurasi alur approval untuk koreksi absensi
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Department</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{departments.length}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3">
                <span className="text-2xl">🏢</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Level</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{flow.length}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-yellow-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Status</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {hasChanges ? "📝" : "✅"}
                </p>
              </div>
              <div className="rounded-xl bg-yellow-100 p-3">
                <span className="text-2xl">{hasChanges ? "✏️" : "✔️"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Department Selection */}
        <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 className="text-md font-semibold text-gray-800">Pilih Department</h2>
              <p className="text-xs text-gray-500 mt-1">Pilih department untuk konfigurasi approval flow</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department / Division
                </label>
                <div className="flex gap-2">
                  <input
                    list="departments-list"
                    placeholder="Contoh: IT, HR, Finance"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <datalist id="departments-list">
                    {departments.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                  <button
                    onClick={loadFlow}
                    disabled={!department}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Masukkan nama department atau pilih dari daftar yang sudah ada
                </p>
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                {loading ? "Loading..." : flow.length > 0 ? `${flow.length} level(s)` : "Belum ada level"}
              </div>
            </div>
          </div>
        </div>

        {/* Approval Levels */}
        <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  Approval Levels
                </h2>
                <p className="text-xs text-gray-500 mt-1">Atur urutan approval untuk department {department || "terpilih"}</p>
              </div>
              {flow.length > 0 && (
                <button
                  onClick={resetFlow}
                  className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <span>🗑️</span> Reset All
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {flow.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Belum Ada Approval Levels</h3>
                <p className="text-gray-500 mb-4">Klik "Add Level" untuk membuat alur approval</p>
                {department && (
                  <button
                    onClick={addLevel}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 mx-auto shadow-md hover:shadow-lg transition-all"
                  >
                    <span>➕</span>
                    Add First Level
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {flow.map((level, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center font-bold text-gray-700 shadow-inner">
                      {index + 1}
                    </div>
                    <div className="flex-1 w-full">
                      <select
                        value={level.role}
                        onChange={(e) => updateRole(index, e.target.value)}
                        className={`w-full sm:w-auto px-4 py-2 rounded-lg border-2 font-medium focus:ring-2 focus:ring-green-500 transition-all cursor-pointer ${getRoleColor(
                          level.role
                        )}`}
                      >
                        {roles.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.icon} {r.label} - {r.description}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1 sm:hidden">
                        {getRoleDescription(level.role)}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className={`p-2 rounded-lg transition-all ${
                          index === 0
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === flow.length - 1}
                        className={`p-2 rounded-lg transition-all ${
                          index === flow.length - 1
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeLevel(index)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                        title="Remove level"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Preview Flow */}
            {flow.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <span>🔍</span>
                  <span>Preview Approval Flow:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {flow.map((level, i) => (
                    <div key={i} className="flex items-center">
                      <div
                        className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm ${getRoleColor(
                          level.role
                        )}`}
                      >
                        <span>{getRoleIcon(level.role)}</span>
                        {level.label || level.role.toUpperCase()}
                      </div>
                      {i < flow.length - 1 && (
                        <span className="mx-1 text-gray-400 text-lg">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={addLevel}
            className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">➕</span>
            Add Level
          </button>
          <button
            onClick={saveFlow}
            disabled={saving || !department || flow.length === 0}
            className={`px-5 py-2.5 rounded-xl text-white font-medium transition-all flex items-center gap-2 shadow-md ${
              saving || !department || flow.length === 0
                ? "bg-gray-400 cursor-not-allowed shadow-none"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg"
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <span>💾</span>
                Save Approval Flow
              </>
            )}
          </button>
        </div>

        {/* Info Card */}
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 p-5">
          <div className="flex gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Cara Kerja Approval Flow</h4>
              <p className="text-sm text-blue-700">
                Ketika karyawan mengajukan koreksi absensi, request akan diproses secara berurutan
                sesuai level approval yang telah ditentukan. Setiap level harus approve sebelum 
                melanjutkan ke level berikutnya.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-blue-600">
                <span>👔 SPV: Approve level 1</span>
                <span>💼 Manager: Approve level 2</span>
                <span>📋 HRD: Approve level 3 (final)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}