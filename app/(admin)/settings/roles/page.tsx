// app/(admin)/settings/roles/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { APP_FEATURES, AVAILABLE_ROLES } from "@/constants/features";

export default function RoleManagementPage() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "role_permissions"));
      const permData: Record<string, Record<string, boolean>> = {};
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        permData[docSnap.id] = data.features || {};
      });

      setPermissions(permData);
    } catch (err: any) {
      console.error("Error loading permissions:", err);
      setError("Gagal memuat data permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (roleId: string, featureId: string, currentValue: boolean) => {
    // Super admin is immutable
    if (roleId === "super_admin") return;

    setPermissions(prev => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || {}),
        [featureId]: !currentValue
      }
    }));
  };

  const handleToggleAllModule = (roleId: string, moduleFeatures: typeof APP_FEATURES, state: boolean) => {
    if (roleId === "super_admin") return;

    setPermissions(prev => {
      const newRolePerms = { ...(prev[roleId] || {}) };
      moduleFeatures.forEach(f => {
        newRolePerms[f.id] = state;
      });
      return {
        ...prev,
        [roleId]: newRolePerms
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const rolesToSave = AVAILABLE_ROLES.filter(r => r.id !== "super_admin");
      
      const promises = rolesToSave.map(role => {
        const roleData = {
          roleName: role.name,
          features: permissions[role.id] || {},
          updatedAt: new Date(),
          updatedBy: user?.uid || "admin"
        };
        return setDoc(doc(db, "role_permissions", role.id), roleData, { merge: true });
      });

      await Promise.all(promises);
      alert("✅ Pengaturan peran berhasil disimpan!");
    } catch (err: any) {
      console.error("Error saving permissions:", err);
      setError("Gagal menyimpan pengaturan.");
      alert("❌ Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  // Group features by module
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, typeof APP_FEATURES> = {};
    APP_FEATURES.forEach(feature => {
      if (!groups[feature.module]) groups[feature.module] = [];
      groups[feature.module].push(feature);
    });
    return groups;
  }, []);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="max-w-7xl mx-auto space-y-6 p-6 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Akses & Peran (RBAC)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Atur fitur apa saja yang dapat diakses oleh masing-masing jabatan.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            )}
            Simpan Pengaturan
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 font-medium text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-bold text-slate-700 min-w-[250px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-[4px_0_12px_rgb(0,0,0,0.02)]">
                    Modul / Fitur
                  </th>
                  {AVAILABLE_ROLES.map(role => (
                    <th key={role.id} className="p-4 text-center font-bold text-slate-700 min-w-[120px] border-r border-slate-100 last:border-r-0">
                      <div className="text-sm">{role.name}</div>
                      {role.id === "super_admin" && <div className="text-[10px] text-emerald-600 font-semibold mt-1">AKSES PENUH</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedFeatures).map(([moduleName, features]) => (
                  <React.Fragment key={moduleName}>
                    {/* Module Header Row */}
                    <tr className="bg-slate-50/50">
                      <td className="p-3 pl-4 font-bold text-slate-800 text-sm sticky left-0 bg-slate-50/90 backdrop-blur z-10 border-r border-slate-200 shadow-[4px_0_12px_rgb(0,0,0,0.02)]">
                        {moduleName}
                      </td>
                      {AVAILABLE_ROLES.map(role => {
                        if (role.id === "super_admin") {
                          return <td key={`${moduleName}-${role.id}`} className="p-3 border-r border-slate-100 last:border-r-0 bg-slate-50/50" />;
                        }
                        // Check if all features in module are checked for this role
                        const allChecked = features.every(f => permissions[role.id]?.[f.id]);
                        const someChecked = features.some(f => permissions[role.id]?.[f.id]);
                        return (
                          <td key={`${moduleName}-${role.id}`} className="p-2 text-center border-r border-slate-100 last:border-r-0 bg-slate-50/50">
                            <button
                              onClick={() => handleToggleAllModule(role.id, features, !allChecked)}
                              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                allChecked 
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                                  : someChecked
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                              title={`Pilih semua fitur di modul ${moduleName} untuk ${role.name}`}
                            >
                              {allChecked ? "ALL ON" : someChecked ? "PARTIAL" : "ALL OFF"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Features in Module */}
                    {features.map(feature => (
                      <tr key={feature.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="p-3 pl-8 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[4px_0_12px_rgb(0,0,0,0.02)]">
                          <div className="font-semibold text-slate-800 text-sm">{feature.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{feature.description}</div>
                        </td>
                        {AVAILABLE_ROLES.map(role => {
                          const isSuperAdmin = role.id === "super_admin";
                          const isAllowed = isSuperAdmin || !!permissions[role.id]?.[feature.id];
                          
                          return (
                            <td key={`${feature.id}-${role.id}`} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                              <label className={`relative inline-flex items-center cursor-pointer ${isSuperAdmin ? "opacity-50 grayscale cursor-not-allowed" : ""}`}>
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={isAllowed}
                                  onChange={() => handleToggle(role.id, feature.id, isAllowed)}
                                  disabled={isSuperAdmin}
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}
