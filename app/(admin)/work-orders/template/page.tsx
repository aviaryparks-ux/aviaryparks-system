// app/(admin)/work-orders/template/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WOInventoryTemplate, WOArea, WOInventoryItem } from "@/types/work-order";

const defaultTemplate: WOInventoryTemplate = {
  id: "default",
  name: "Work Order Inventory Template",
  areas: [
    {
      id: "area-1",
      name: "Kamar",
      items: [
        { id: "item-1-1", name: "AC" },
        { id: "item-1-2", name: "Kran Air" },
        { id: "item-1-3", name: "Lampu" },
      ]
    }
  ]
};

export default function WOTemplatePage() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<WOInventoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, "wo_inventory_templates", "default");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setTemplate({
          id: docSnap.id,
          name: data.name || "Work Order Inventory Template",
          areas: data.areas || [],
        });
      } else {
        await setDoc(docRef, defaultTemplate);
        setTemplate(defaultTemplate);
      }
    } catch (err: any) {
      console.error("Error loading WO template:", err);
      setError(err.message);
      setTemplate(defaultTemplate);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!template) return;

    // Validate
    const emptyAreas = template.areas.filter(a => !a.name || a.name.trim() === "");
    if (emptyAreas.length > 0) {
      alert("Nama area tidak boleh kosong!");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        name: template.name,
        areas: template.areas,
        updatedAt: new Date(),
        updatedBy: user?.name || "admin"
      };
      await setDoc(doc(db, "wo_inventory_templates", "default"), dataToSave);
      alert("✅ Template Inventory WO berhasil disimpan!");
    } catch (err: any) {
      console.error("Error saving template:", err);
      alert("❌ Gagal menyimpan template: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handlers
  const addArea = () => {
    if (!template) return;
    const newArea: WOArea = {
      id: Math.random().toString(36).substr(2, 9),
      name: "Area Baru",
      items: [{ id: Math.random().toString(36).substr(2, 9), name: "Barang Baru" }]
    };
    setTemplate({ ...template, areas: [...template.areas, newArea] });
  };

  const updateAreaName = (index: number, name: string) => {
    if (!template) return;
    const updatedAreas = template.areas.map((area, i) => {
      if (i !== index) return area;
      return { ...area, name };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  const deleteArea = (index: number) => {
    if (!template) return;
    if (!confirm("Yakin ingin menghapus area ini?")) return;
    const updatedAreas = template.areas.filter((_, i) => i !== index);
    setTemplate({ ...template, areas: updatedAreas });
  };

  const addItem = (areaIndex: number) => {
    if (!template) return;
    const newItem: WOInventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: "Barang Baru",
    };
    const updatedAreas = template.areas.map((area, i) => {
      if (i !== areaIndex) return area;
      return { ...area, items: [...area.items, newItem] };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  const updateItemName = (areaIndex: number, itemIndex: number, name: string) => {
    if (!template) return;
    const updatedAreas = template.areas.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        items: area.items.map((item, ii) => {
          if (ii !== itemIndex) return item;
          return { ...item, name };
        })
      };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  const deleteItem = (areaIndex: number, itemIndex: number) => {
    if (!template) return;
    const updatedAreas = template.areas.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        items: area.items.filter((_, ii) => ii !== itemIndex)
      };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "manager"]}>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!template) return null;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager"]}>
      <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Template Inventory WO</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola daftar area dan barang untuk kemudahan pengisian form Work Order.
            </p>
          </div>
          <button
            onClick={addArea}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Tambah Area
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm font-medium">
            ⚠️ Error: {error}
          </div>
        )}

        {/* Areas */}
        <div className="space-y-6">
          {template.areas.map((area, areaIndex) => (
            <div key={area.id} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden group/area">
              <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-6 h-6 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {areaIndex + 1}
                  </span>
                  <input
                    type="text"
                    value={area.name}
                    onChange={(e) => updateAreaName(areaIndex, e.target.value)}
                    className="flex-1 text-base font-bold text-slate-800 bg-transparent border-0 focus:ring-1 focus:ring-orange-500 rounded-md px-2 py-1 placeholder-slate-400 hover:bg-white/50 focus:bg-white transition-colors"
                    placeholder="Nama Area (misal: Lobby, Kamar Mandi)"
                  />
                </div>
                <button
                  onClick={() => deleteArea(areaIndex)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover/area:opacity-100 ml-4 shrink-0"
                  title="Hapus Area"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {area.items.map((item, itemIndex) => (
                  <div key={item.id} className="p-4 flex items-center gap-3 group/item hover:bg-slate-50/30 transition-colors pl-12">
                    <span className="text-slate-300">↳</span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItemName(areaIndex, itemIndex, e.target.value)}
                      className="flex-1 border-0 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 text-slate-800 placeholder-slate-400 hover:bg-slate-100 focus:bg-white transition-colors"
                      placeholder="Nama Barang / Inventory (misal: AC, Kran Air)"
                    />
                    <button
                      onClick={() => deleteItem(areaIndex, itemIndex)}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover/item:opacity-100 shrink-0"
                      title="Hapus Barang"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
                <div className="p-3 bg-slate-50/50 pl-12">
                  <button
                    onClick={() => addItem(areaIndex)}
                    className="text-[13px] font-medium text-slate-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Tambah Barang
                  </button>
                </div>
              </div>
            </div>
          ))}

          {template.areas.length === 0 && (
            <div className="rounded-xl border-2 border-slate-200 border-dashed bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-5 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-2">Belum Ada Area/Inventory</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm leading-relaxed">
                Tambahkan area lokasi dan daftar barang untuk mempermudah pelaporan Work Order.
              </p>
              <button
                onClick={addArea}
                className="px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors shadow-sm"
              >
                + Tambah Area Pertama
              </button>
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-40 md:pl-64">
          <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Akan muncul di dropdown form Work Order
            </div>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              )}
              {saving ? "Menyimpan Template..." : "Simpan Template"}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
