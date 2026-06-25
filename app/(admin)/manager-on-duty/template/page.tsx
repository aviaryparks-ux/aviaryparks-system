// app/(admin)/manager-on-duty/template/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { MODTemplate, MODArea, MODQuestion, defaultMODTemplate } from "@/types/mod";

type MODTemplateLocal = Omit<MODTemplate, 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>;

export default function MODTemplatePage() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<MODTemplateLocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, "mod_templates", "daily_checklist");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure areas structure is correct
        const tmpl: MODTemplate = {
          id: docSnap.id,
          name: data.name || 'Daily MOD Inspection Checklist',
          description: data.description || '',
          isActive: data.isActive ?? true,
          areas: data.areas || defaultMODTemplate.areas,
          createdBy: data.createdBy || '',
          createdByName: data.createdByName || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
        setTemplate(tmpl);
      } else {
        // Create default template in Firestore
        const defaultData = {
          name: defaultMODTemplate.name,
          description: defaultMODTemplate.description,
          isActive: defaultMODTemplate.isActive,
          areas: defaultMODTemplate.areas,
          createdAt: new Date(),
          createdBy: user?.uid || 'system',
          createdByName: user?.name || 'System',
          lastUpdated: new Date()
        };
        await setDoc(docRef, defaultData);
        setTemplate({ id: "daily_checklist", name: defaultMODTemplate.name, description: defaultMODTemplate.description, isActive: defaultMODTemplate.isActive, areas: defaultMODTemplate.areas });
      }
      setInitialized(true);
    } catch (err: any) {
      console.error("Error loading template:", err);
      setError(err.message);
      // Use default template if error
      setTemplate({ id: "daily_checklist", name: defaultMODTemplate.name, description: defaultMODTemplate.description, isActive: defaultMODTemplate.isActive, areas: defaultMODTemplate.areas });
      setInitialized(true);
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

    const emptyQuestions = template.areas.some(a =>
      !a.questions || a.questions.length === 0 || a.questions.some(q => !q.text || q.text.trim() === "")
    );
    if (emptyQuestions) {
      alert("Semua pertanyaan harus memiliki teks!");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        name: template.name || 'Daily MOD Inspection Checklist',
        description: template.description || '',
        isActive: template.isActive !== false,
        areas: template.areas || defaultMODTemplate.areas,
        lastUpdated: new Date(),
        lastUpdatedBy: user?.name || "admin"
      };
      await setDoc(doc(db, "mod_templates", "daily_checklist"), dataToSave);

      alert("✅ Template berhasil disimpan!");
    } catch (err: any) {
      console.error("Error saving template:", err);
      alert("❌ Gagal menyimpan template: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Area handlers
  const addArea = () => {
    if (!template) return;
    const newArea: MODArea = {
      name: "Area Baru",
      order: template.areas.length + 1,
      questions: [
        { text: "Pertanyaan baru", needPhoto: false, needNote: false, actionRequired: false }
      ]
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

  // Question handlers
  const addQuestion = (areaIndex: number) => {
    if (!template) return;
    const newQuestion = {
      text: "Pertanyaan baru",
      needPhoto: false,
      needNote: false,
      actionRequired: false
    };
    const updatedAreas = template.areas.map((area, i) => {
      if (i !== areaIndex) return area;
      return {
        ...area,
        questions: [...area.questions, newQuestion]
      };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  const updateQuestion = (areaIndex: number, qIndex: number, field: keyof MODQuestion, value: any) => {
    if (!template) return;
    const updatedAreas = template.areas.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        questions: area.questions.map((q, qi) => {
          if (qi !== qIndex) return q;
          return { ...q, [field]: value };
        })
      };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  const deleteQuestion = (areaIndex: number, qIndex: number) => {
    if (!template) return;
    if (!confirm("Yakin ingin menghapus pertanyaan ini?")) return;
    const updatedAreas = template.areas.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        questions: area.questions.filter((_, qi) => qi !== qIndex)
      };
    });
    setTemplate({ ...template, areas: updatedAreas });
  };

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="manage_mod_templates">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!template) return null;

  return (
    <ProtectedRoute requiredFeature="manage_mod_templates">
      <div className="space-y-6 pb-32">
        {/* Header Clean */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Template Checklist MOD</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola daftar pertanyaan inspeksi harian untuk laporan MOD. Total: <span className="font-medium text-slate-700">{template.areas.length}</span> area, <span className="font-medium text-slate-700">{template.areas.reduce((sum, a) => sum + a.questions.length, 0)}</span> pertanyaan.
            </p>
          </div>
          <button
            onClick={addArea}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center gap-2 shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Tambah Area
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm font-medium">
            ⚠️ Error: {error}
          </div>
        )}

        {/* Area Cards */}
        <div className="space-y-6">
          {template.areas.map((area, areaIndex) => (
            <div key={areaIndex} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden group/area">
              {/* Area Header */}
              <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {areaIndex + 1}
                  </span>
                  <input
                    type="text"
                    value={area.name}
                    onChange={(e) => updateAreaName(areaIndex, e.target.value)}
                    className="flex-1 text-base font-bold text-slate-800 bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded-md px-2 py-1 placeholder-slate-400 hover:bg-white/50 focus:bg-white transition-colors"
                    placeholder="Ketik Nama Area (misal: Area Restoran)"
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

              {/* Questions */}
              <div className="divide-y divide-slate-100">
                {area.questions.map((question, qIndex) => (
                  <div key={qIndex} className="p-4 flex items-start gap-3 group/question hover:bg-slate-50/30 transition-colors">
                    <span className="mt-2.5 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {qIndex + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={question.text}
                        onChange={(e) => updateQuestion(areaIndex, qIndex, 'text', e.target.value)}
                        className="w-full border-0 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 hover:bg-slate-100 focus:bg-white transition-colors"
                        placeholder="Ketik rincian pertanyaan checklist..."
                      />
                      <div className="flex flex-wrap gap-x-6 gap-y-2 px-1">
                        <label className="flex items-center gap-2 text-[12px] cursor-pointer group/cb">
                          <input
                            type="checkbox"
                            checked={question.needPhoto}
                            onChange={(e) => updateQuestion(areaIndex, qIndex, 'needPhoto', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className={`${question.needPhoto ? "text-emerald-700 font-medium" : "text-slate-500"} group-hover/cb:text-slate-800 transition-colors select-none`}>
                            Wajib Lampirkan Foto
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-[12px] cursor-pointer group/cb">
                          <input
                            type="checkbox"
                            checked={question.needNote}
                            onChange={(e) => updateQuestion(areaIndex, qIndex, 'needNote', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className={`${question.needNote ? "text-emerald-700 font-medium" : "text-slate-500"} group-hover/cb:text-slate-800 transition-colors select-none`}>
                            Izinkan Isi Catatan
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-[12px] cursor-pointer group/cb">
                          <input
                            type="checkbox"
                            checked={question.actionRequired}
                            onChange={(e) => updateQuestion(areaIndex, qIndex, 'actionRequired', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className={`${question.actionRequired ? "text-red-600 font-semibold" : "text-slate-500"} group-hover/cb:text-slate-800 transition-colors select-none`}>
                            Tandai Sebagai Isu Kritis
                          </span>
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteQuestion(areaIndex, qIndex)}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover/question:opacity-100 shrink-0 mt-1"
                      title="Hapus Pertanyaan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}

                <div className="p-3 bg-slate-50/50">
                  <button
                    onClick={() => addQuestion(areaIndex)}
                    className="text-[13px] font-medium text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Tambah Pertanyaan Baru
                  </button>
                </div>
              </div>
            </div>
          ))}

          {template.areas.length === 0 && (
            <div className="rounded-xl border-2 border-slate-200 border-dashed bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-5 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-2">Checklist Masih Kosong</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm leading-relaxed">
                Mulai bangun standar inspeksi dengan menambahkan area pertama Anda, misalnya Area Lobby, Kamar, atau Dapur.
              </p>
              <button
                onClick={addArea}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm"
              >
                + Tambah Area Pertama
              </button>
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-40 md:pl-64">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Otomatis diterapkan pada semua laporan MOD baru
            </div>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
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