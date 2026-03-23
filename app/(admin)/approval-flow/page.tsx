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

  const roles = [
    { value: "spv", label: "SPV", icon: "👔" },
    { value: "manager", label: "Manager", icon: "💼" },
    { value: "hrd", label: "HRD", icon: "📋" },
  ];

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
      alert("Department is required");
      return;
    }
    if (flow.length === 0) {
      alert("Add at least one approval level");
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
      alert("✅ Approval flow saved");
      setHasChanges(false);
    } catch (error) {
      alert("❌ Error saving flow");
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    if (confirm("Reset will delete all levels. Continue?")) {
      setFlow([]);
      setHasChanges(true);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "spv":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "manager":
        return "bg-blue-100 border-blue-300 text-blue-800";
      case "hrd":
        return "bg-purple-100 border-purple-300 text-purple-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  const getRoleIcon = (role: string) => {
    const found = roles.find((r) => r.value === role);
    return found?.icon || "👤";
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Approval Flow
            </h1>
            <p className="text-gray-500 mt-1">Configure approval hierarchy for attendance corrections</p>
          </div>
          {hasChanges && (
            <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
              ⚡ Unsaved changes
            </div>
          )}
        </div>

        {/* Department Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department / Division
              </label>
              <input
                placeholder="Example: IT, HR, Finance"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter department name to configure approval flow
              </p>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              {loading ? "Loading..." : flow.length > 0 ? `${flow.length} level(s)` : "No levels"}
            </div>
          </div>
        </div>

        {/* Approval Levels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-xl">📋</span>
                Approval Levels
              </h2>
              {flow.length > 0 && (
                <button
                  onClick={resetFlow}
                  className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
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
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Approval Levels</h3>
                <p className="text-gray-500 mb-4">Click "Add Level" to create approval flow</p>
              </div>
            ) : (
              <div className="space-y-3">
                {flow.map((level, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center font-bold text-gray-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 w-full">
                      <select
                        value={level.role}
                        onChange={(e) => updateRole(index, e.target.value)}
                        className={`w-full sm:w-auto px-4 py-2 rounded-lg border-2 font-medium focus:ring-2 focus:ring-green-500 ${getRoleColor(
                          level.role
                        )}`}
                      >
                        {roles.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.icon} {r.label}
                          </option>
                        ))}
                      </select>
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

            {/* Preview */}
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
                        className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 ${getRoleColor(
                          level.role
                        )}`}
                      >
                        <span>{getRoleIcon(level.role)}</span>
                        {level.label || level.role.toUpperCase()}
                      </div>
                      {i < flow.length - 1 && <span className="mx-1 text-gray-400">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={addLevel}
            className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add Level
          </button>
          <button
            onClick={saveFlow}
            disabled={saving || !department || flow.length === 0}
            className={`px-6 py-3 rounded-lg text-white font-medium transition-all flex items-center gap-2 ${
              saving || !department || flow.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">How Approval Flow Works</h4>
              <p className="text-sm text-blue-700">
                When an employee submits an attendance correction request, it will be processed
                sequentially through each approval level. Each level must approve before moving to the next.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}