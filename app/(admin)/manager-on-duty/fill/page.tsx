// app/(admin)/manager-on-duty/fill/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useSearchParams } from "next/navigation";
import { MODSchedule, MODTemplate, getDayOfWeek, getDayName, formatDate, getRoleLabel, defaultMODTemplate } from "@/types/mod";

type MODTemplateLocal = Omit<MODTemplate, 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>;
import PhotoUpload from "@/components/mod/PhotoUpload";

type QuestionAnswer = {
  text: string;
  needPhoto: boolean;
  needNote: boolean;
  actionRequired: boolean;
  isChecked: boolean;
  note: string;
  photos: {
    id: string;
    url: string;
    caption: string;
    rating: "pass" | "need_improvement" | null;
    fileName?: string;
  }[];
};

type AreaAnswer = {
  name: string;
  order: number;
  questions: QuestionAnswer[];
};

type ProblemFound = {
  id: string;
  description: string;
  priority: "low" | "medium" | "high";
  assignedTo: string;
  linkedWO?: { id: string; woNumber: string; title: string };
};

type WorkOrder = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  department: string;
};

export default function FillMODReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isTestMode = searchParams.get("test") === "true";
  const testDateParam = searchParams.get("date");

  const getDefaultDate = () => {
    if (testDateParam) return testDateParam;
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getDefaultDate();
  const todayDayOfWeek = getDayOfWeek(todayStr);

  const [schedule, setSchedule] = useState<MODSchedule | null>(null);
  const [template, setTemplate] = useState<MODTemplateLocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingReport, setExistingReport] = useState<any | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const [areaAnswers, setAreaAnswers] = useState<AreaAnswer[]>([]);
  const [problems, setProblems] = useState<ProblemFound[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const generateId = () => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    loadTemplate();
  }, []);

  useEffect(() => {
    if (template) {
      loadScheduleAndReport();
    }
  }, [template]);

  // Load work orders for dropdown
  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      // Load open/active work orders for linking
      const q = query(
        collection(db, "work_orders"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const woList: WorkOrder[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        woList.push({
          id: doc.id,
          woNumber: data.woNumber || doc.id,
          title: data.title || "No Title",
          status: data.status || "open",
          department: data.assignedToDept || data.createdByDept || "Unknown"
        });
      });
      setWorkOrders(woList);
    } catch (err) {
      console.log("No work orders found or error loading WO:", err);
    }
  };

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const docRef = doc(db, "mod_templates", "daily_checklist");
      const docSnap = await getDoc(docRef);

      let tmpl: MODTemplateLocal;
      if (docSnap.exists()) {
        const data = docSnap.data();
        tmpl = {
          id: docSnap.id,
          name: data.name || 'Daily MOD Inspection Checklist',
          description: data.description || '',
          isActive: data.isActive ?? true,
          areas: data.areas || defaultMODTemplate.areas,
        };
      } else {
        tmpl = { id: "daily_checklist", name: defaultMODTemplate.name, description: defaultMODTemplate.description, isActive: defaultMODTemplate.isActive, areas: defaultMODTemplate.areas };
      }
      setTemplate(tmpl);
    } catch (err) {
      console.error("Error loading template:", err);
      setTemplate({ id: "daily_checklist", name: defaultMODTemplate.name, description: defaultMODTemplate.description, isActive: defaultMODTemplate.isActive, areas: defaultMODTemplate.areas });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const loadScheduleAndReport = async () => {
    setLoading(true);
    setError(null);

    if (isTestMode) {
      const mockSchedule: MODSchedule = {
        id: "test-schedule",
        date: todayStr,
        dayOfWeek: todayDayOfWeek || "saturday",
        userId: user?.uid || 'test-user',
        userName: user?.name || 'Test User',
        department: user?.department || "Test Dept",
        role: user?.role === "spv" ? "spv" : "manager",
        notes: "Test MOD",
        createdAt: new Date(),
        createdBy: user?.uid || 'test-user',
        createdByName: user?.name || 'Test User',
        updatedAt: new Date(),
        updatedBy: user?.uid || 'test-user',
        updatedByName: user?.name || 'Test User'
      };
      setSchedule(mockSchedule);
      initAnswersFromTemplate();
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const scheduleQuery = query(
        collection(db, "mod_schedules"),
        where("date", "==", todayStr)
      );
      const scheduleSnap = await getDocs(scheduleQuery);

      if (scheduleSnap.empty) {
        setError("Belum ada jadwal MOD yang ditugaskan untuk hari ini.");
        setLoading(false);
        return;
      }

      const scheduleData = { id: scheduleSnap.docs[0].id, ...scheduleSnap.docs[0].data() } as MODSchedule;
      setSchedule(scheduleData);

      if (scheduleData.userId !== user.uid) {
        setError(`Anda tidak ditugaskan sebagai MOD hari ini. MOD yang bertugas adalah: ${scheduleData.userName}`);
        setLoading(false);
        return;
      }

      const reportQuery = query(
        collection(db, "mod_reports"),
        where("scheduleId", "==", scheduleSnap.docs[0].id)
      );
      const reportSnap = await getDocs(reportQuery);

      if (!reportSnap.empty) {
        const reportData = reportSnap.docs[0].data();
        setExistingReport({ id: reportSnap.docs[0].id, ...reportData });

        if (reportData.areaAnswers) setAreaAnswers(reportData.areaAnswers);
        if (reportData.problems) setProblems(reportData.problems);
        if (reportData.generalNotes) setGeneralNotes(reportData.generalNotes);
      } else {
        initAnswersFromTemplate();
      }
    } catch (err) {
      console.error("Error loading schedule:", err);
      setError("Error: " + (err as Error).message);
    }

    setLoading(false);
  };

  const initAnswersFromTemplate = () => {
    if (!template) return;

    const answers: AreaAnswer[] = template.areas.map((area: MODTemplate['areas'][0]) => ({
      name: area.name || '',
      order: area.order || 0,
      questions: (area.questions || []).map((q: any) => ({
        text: q.text || '',
        needPhoto: q.needPhoto || false,
        needNote: q.needNote || false,
        actionRequired: q.actionRequired || false,
        isChecked: false,
        note: "",
        photos: []
      }))
    }));
    setAreaAnswers(answers);
  };

  const toggleQuestion = (areaIndex: number, qIndex: number) => {
    setAreaAnswers(prev => prev.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        questions: area.questions.map((q, qi) => {
          if (qi !== qIndex) return q;
          return { ...q, isChecked: !q.isChecked };
        })
      };
    }));
  };

  const updateNote = (areaIndex: number, qIndex: number, note: string) => {
    setAreaAnswers(prev => prev.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        questions: area.questions.map((q, qi) => {
          if (qi !== qIndex) return q;
          return { ...q, note };
        })
      };
    }));
  };

  const updatePhotos = (areaIndex: number, qIndex: number, photos: QuestionAnswer["photos"]) => {
    setAreaAnswers(prev => prev.map((area, ai) => {
      if (ai !== areaIndex) return area;
      return {
        ...area,
        questions: area.questions.map((q, qi) => {
          if (qi !== qIndex) return q;
          return { ...q, photos };
        })
      };
    }));
  };

  const addProblem = () => {
    setProblems(prev => [...prev, {
      id: generateId(),
      description: "",
      priority: "medium",
      assignedTo: ""
    }]);
  };

  const updateProblem = (id: string, field: keyof ProblemFound, value: any) => {
    setProblems(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProblem = (id: string) => {
    setProblems(prev => prev.filter(p => p.id !== id));
  };

  const getStats = () => {
    let total = 0, checked = 0, needsAction = 0;
    areaAnswers.forEach(area => {
      area.questions.forEach(q => {
        if (q.actionRequired) {
          total++;
          if (q.isChecked) checked++;
          else needsAction++;
        }
      });
    });
    return { total, checked, needsAction };
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!schedule || !user) return;

    setSaving(true);
    try {
      const data = {
        scheduleId: schedule.id,
        date: todayStr,
        dayOfWeek: todayDayOfWeek,
        templateId: template?.id || "daily_checklist",
        templateName: template?.name || "Daily MOD Inspection Checklist",
        areaAnswers,
        problems,
        generalNotes,
        submittedBy: user.uid,
        submittedByName: user.name,
        submittedAt: new Date(),
        status,
        createdAt: existingReport?.createdAt || new Date()
      };

      let reportId = existingReport?.id;
      if (existingReport) {
        await updateDoc(doc(db, "mod_reports", existingReport.id), data);
      } else {
        const docRef = await addDoc(collection(db, "mod_reports"), data);
        reportId = docRef.id;
      }

      // Two-way sync: update linked Work Orders
      if (status === "submitted" && reportId) {
        for (const p of problems) {
          if (p.linkedWO?.id) {
            try {
              await updateDoc(doc(db, "work_orders", p.linkedWO.id), {
                source: "mod",
                sourceReportId: reportId,
                sourceProblemId: p.id,
                updatedAt: new Date(),
                updatedBy: user.uid,
                updatedByName: user.name
              });
            } catch (e) {
              console.error("Failed to sync linked WO:", e);
            }
          }
        }
      }

      alert(status === "submitted" ? "✅ Laporan berhasil di-submit!" : "💾 Laporan disimpan sebagai draft!");
      router.push("/manager-on-duty/dashboard");
    } catch (err) {
      console.error("Error saving:", err);
      alert("❌ Gagal menyimpan: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingTemplate) {
    return (
      <ProtectedRoute requiredFeature="fill_mod">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Memuat...</p>
        </div>
      </ProtectedRoute>
    );
  }

  const stats = getStats();

  return (
    <ProtectedRoute requiredFeature="fill_mod">
      <div className="space-y-6 pb-32">
        {error && (
          <div className="mt-12 flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Jadwal Kosong</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
              <button onClick={() => router.push("/manager-on-duty")} className="w-full sm:w-auto px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                Lihat Jadwal
              </button>
              <button onClick={() => router.push("/manager-on-duty/schedule")} className="w-full sm:w-auto px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors shadow-sm">
                + Buat Jadwal
              </button>
            </div>
          </div>
        )}

        {isTestMode && !error && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="font-bold text-amber-800">🧪 Mode Testing Aktif</p>
            <p className="text-sm text-amber-600">Simulasi laporan untuk tanggal: {todayStr} ({getDayName(todayDayOfWeek!)})</p>
          </div>
        )}

        {schedule && !error && (
          <>
            {/* Header Clean */}
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inspeksi MOD Harian</h1>
                <p className="text-sm text-slate-500 mt-1">{getDayName(todayDayOfWeek!)} • {formatDate(todayStr)}</p>
              </div>
            </div>

            {/* User & Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-2 rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg">
                  {schedule.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{schedule.userName}</p>
                  <p className="text-[12px] text-slate-500">{schedule.department} • {getRoleLabel(schedule.role)}</p>
                </div>
                {existingReport && (
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${existingReport.status === 'draft' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                    {existingReport.status === "draft" ? "Draft" : "Submitted"}
                  </span>
                )}
              </div>
              <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-slate-800">{stats.checked}</p>
                  <p className="text-lg font-medium text-slate-400 mb-0.5">/ {stats.total}</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Selesai Dicek</p>
              </div>
              <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-red-600">{problems.length}</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Masalah Ditemukan</p>
              </div>
            </div>

            {/* Checklist Areas */}
            <div className="space-y-6">
              {areaAnswers.map((area, ai) => (
                <div key={ai} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">{ai + 1}</span>
                    <h2 className="font-bold text-slate-800">{area.name}</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {area.questions.map((q, qi) => (
                      <div key={qi} className={`p-5 transition-colors ${q.isChecked ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={q.isChecked} 
                              onChange={() => toggleQuestion(ai, qi)} 
                              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label className="font-medium text-slate-700 cursor-pointer text-sm select-none" onClick={() => toggleQuestion(ai, qi)}>{q.text}</label>
                              {q.actionRequired && <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] font-medium tracking-wide">WAJIB</span>}
                            </div>
                            
                            {q.isChecked && (
                              <div className="mt-4 space-y-4">
                                {q.needNote && (
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">📝 Catatan Pemeriksaan</label>
                                    <textarea 
                                      value={q.note} 
                                      onChange={(e) => updateNote(ai, qi, e.target.value)} 
                                      rows={2} 
                                      className="w-full border-0 bg-slate-50 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 placeholder-slate-400" 
                                      placeholder="Ketik detail temuan di sini..." 
                                    />
                                  </div>
                                )}
                                {q.needPhoto && (
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">📷 Foto Bukti</label>
                                    <PhotoUpload
                                      photos={q.photos}
                                      onChange={(photos) => updatePhotos(ai, qi, photos)}
                                      maxPhotos={3}
                                      disabled={!q.isChecked}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Daftar Masalah (Problems) */}
            <div className="mt-8 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-red-500 text-lg">⚠️</span> Daftar Masalah ({problems.length})
                </h2>
                <button onClick={addProblem} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                  + Tambah Masalah
                </button>
              </div>
              <div className="p-5 space-y-4 bg-slate-50/50">
                {problems.map((p, i) => (
                  <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm relative group">
                    <button onClick={() => removeProblem(p.id)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      🗑️
                    </button>
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Deskripsi Temuan</label>
                          <textarea value={p.description} onChange={(e) => updateProblem(p.id, "description", e.target.value)} rows={2} className="w-full border-0 bg-slate-50 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 placeholder-slate-400" placeholder="Jelaskan detail kerusakan atau masalah..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Prioritas</label>
                            <select value={p.priority} onChange={(e) => updateProblem(p.id, "priority", e.target.value)} className="w-full border-0 bg-slate-50 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 text-slate-700">
                              <option value="low">🟢 Rendah (Low)</option>
                              <option value="medium">🟡 Menengah (Medium)</option>
                              <option value="high">🔴 Tinggi (High)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Ditugaskan Kepada</label>
                            <input value={p.assignedTo} onChange={(e) => updateProblem(p.id, "assignedTo", e.target.value)} className="w-full border-0 bg-slate-50 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 placeholder-slate-400" placeholder="Contoh: Engineering / Pak Budi" />
                          </div>
                        </div>
                        {/* Work Order Section */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">🔗 Integrasi Work Order</label>
                            <button type="button" onClick={() => window.open(`/work-orders/create?desc=${encodeURIComponent(p.description)}&dept=${encodeURIComponent(user?.department || "")}`, "_blank")} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700">Buat Tiket WO Baru ↗</button>
                          </div>
                          <select value={p.linkedWO?.id || ""} onChange={(e) => {
                              const woId = e.target.value;
                              if (woId) {
                                const wo = workOrders.find(w => w.id === woId);
                                updateProblem(p.id, "linkedWO", wo ? { id: wo.id, woNumber: wo.woNumber, title: wo.title } : undefined);
                              } else {
                                updateProblem(p.id, "linkedWO", undefined);
                              }
                            }} className="w-full border-0 bg-slate-50 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 text-slate-700">
                            <option value="">-- Tidak Ditautkan ke WO --</option>
                            {workOrders.map(wo => (
                              <option key={wo.id} value={wo.id}>{wo.woNumber} - {wo.title} ({wo.status})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {problems.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-sm">Belum ada masalah yang dicatat.</p>
                  </div>
                )}
              </div>
            </div>

            {/* General Notes */}
            <div className="mt-6 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">📝 Catatan Umum Shift Ini</h2>
              </div>
              <div className="p-5">
                <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={3} className="w-full border-0 bg-slate-50 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500 placeholder-slate-400" placeholder="Ringkasan atau kejadian khusus yang perlu dilaporkan ke shift selanjutnya..." />
              </div>
            </div>

            {/* Sticky Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-40 md:pl-64">
              <div className="flex items-center justify-between w-full">
                <button onClick={() => router.back()} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleSubmit("draft")} disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">Simpan Draft</button>
                  <button onClick={() => handleSubmit("submitted")} disabled={saving} className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Submit Laporan
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}