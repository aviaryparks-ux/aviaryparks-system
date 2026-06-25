// app/(admin)/manager-on-duty/report/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useParams } from "next/navigation";
import { formatDate, getDayName, getRoleLabel } from "@/types/mod";

type QuestionPhoto = {
  id: string;
  url: string;
  caption: string;
  rating: "pass" | "need_improvement" | null;
};

type QuestionAnswer = {
  text: string;
  needPhoto: boolean;
  needNote: boolean;
  actionRequired: boolean;
  isChecked: boolean;
  note: string;
  photos: QuestionPhoto[];
};

type AreaAnswer = {
  name: string;
  order: number;
  questions: QuestionAnswer[];
};

type ProblemFound = {
  id: string;
  description: string;
  priority: string;
  assignedTo: string;
};

type Report = {
  id: string;
  scheduleId: string;
  date: string;
  dayOfWeek: string;
  templateName: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: any;
  status: string;
  generalNotes?: string;
  areaAnswers?: AreaAnswer[];
  areas?: AreaAnswer[];
  problems?: ProblemFound[];
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: any;
  reviewNotes?: string;
};

export default function MODReportDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      const docRef = doc(db, "mod_reports", reportId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert("Laporan tidak ditemukan!");
        router.push("/manager-on-duty/report");
        return;
      }

      const data = { id: docSnap.id, ...docSnap.data() } as Report;
      setReport(data);
      setReviewNotes(data.reviewNotes || "");
    } catch (err) {
      console.error("Error loading report:", err);
      alert("Gagal memuat laporan!");
      router.push("/manager-on-duty/report");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!report) return;

    if (newStatus === "reviewed" && !reviewNotes.trim()) {
      alert("Mohon isi catatan review!");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "mod_reports", reportId), {
        status: newStatus,
        reviewedBy: user?.uid,
        reviewedByName: user?.name,
        reviewedAt: new Date(),
        reviewNotes
      });
      alert("✅ Status berhasil diupdate!");
      router.push("/manager-on-duty/report");
    } catch (err) {
      console.error("Error updating:", err);
      alert("❌ Gagal mengupdate status");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="view_mod">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!report) return null;

  // Stats
  let total = 0, checked = 0, needsAction = 0;
  const areaData = report.areaAnswers || report.areas || [];
  areaData.forEach(area => {
    area.questions?.forEach(q => {
      if (q.actionRequired || q.needNote || q.needPhoto) {
        total++;
        if (q.isChecked) checked++;
        else needsAction++;
      }
    });
  });

  return (
    <ProtectedRoute requiredFeature="view_mod">
      <div className="space-y-6 p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white shadow-xl">
          <button onClick={() => router.back()} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-lg hover:bg-white/30">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative z-10 text-center">
            <h1 className="text-2xl font-bold">📝 Detail Laporan MOD</h1>
            <p className="text-purple-100 mt-1">{getDayName(report.dayOfWeek as any)} - {formatDate(report.date)}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl bg-white p-5 shadow-md border">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500">Tanggal</p>
              <p className="font-bold text-lg">{formatDate(report.date)}</p>
              <p className="text-sm text-gray-500">{getDayName(report.dayOfWeek as any)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              report.status === "reviewed" ? "bg-green-100 text-green-600" :
              report.status === "submitted" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
            }`}>
              {report.status === "draft" ? "⏳ Draft" : report.status === "submitted" ? "📤 Submitted" : "✅ Reviewed"}
            </span>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500">Di-submit oleh</p>
              <p className="font-semibold">{report.submittedByName || (report as any).userName}</p>
              <p className="text-xs text-gray-400">
                {(report.submittedAt || (report as any).createdAt || (report as any).updatedAt)?.toDate()?.toLocaleString("id-ID") || "-"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{checked}/{total}</p>
              <p className="text-xs text-gray-500">Checked</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{needsAction}</p>
              <p className="text-xs text-gray-500">Needs Action</p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        {(report.areaAnswers || report.areas)?.map((area, ai) => (
          <div key={ai} className="rounded-xl bg-white shadow-md border overflow-hidden">
            <div className="bg-emerald-50 p-4 border-b flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold">{ai + 1}</span>
              <h2 className="font-bold text-lg">{area.name}</h2>
            </div>
            <div className="p-4 space-y-4">
              {area.questions?.map((q, qi) => (
                <div key={qi} className={`rounded-xl p-4 ${q.isChecked ? (q.actionRequired ? "bg-red-50" : "bg-emerald-50") : "bg-gray-50"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{q.isChecked ? "✅" : "⬜"}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${q.isChecked ? "" : "line-through text-gray-400"}`}>{q.text}</p>
                      {q.actionRequired && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs">⚠️ Action</span>}

                      {/* Note */}
                      {q.note && (
                        <div className="mt-2 p-2 bg-white rounded-lg">
                          <p className="text-sm text-gray-600">📝 {q.note}</p>
                        </div>
                      )}

                      {/* Photos with Rating */}
                      {q.photos && q.photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {q.photos.map((photo) => (
                            <div key={photo.id} className="rounded-lg border overflow-hidden bg-white">
                              <img src={photo.url} alt="" className="w-full h-32 object-cover" />
                              <div className="p-2">
                                <div className="flex justify-between items-center">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    photo.rating === "pass" ? "bg-green-100 text-green-700" :
                                    photo.rating === "need_improvement" ? "bg-red-100 text-red-700" :
                                    "bg-gray-100 text-gray-500"
                                  }`}>
                                    {photo.rating === "pass" ? "✅ Memenuhi Standar" : photo.rating === "need_improvement" ? "⚠️ Perlu Perbaikan" : "Belum ada rating"}
                                  </span>
                                </div>
                                {photo.caption && (
                                  <p className="text-xs text-gray-500 mt-1">{photo.caption}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Problems */}
        {report.problems && report.problems.length > 0 && (
          <div className="rounded-xl bg-white shadow-md border overflow-hidden">
            <div className="bg-red-50 p-4 border-b">
              <h2 className="font-bold text-lg">⚠️ Masalah ({report.problems.length})</h2>
            </div>
            <div className="p-4 space-y-3">
              {report.problems.map((p, i) => (
                <div key={p.id} className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-gray-800">{p.description || "-"}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          p.priority === "high" ? "bg-red-100 text-red-600" :
                          p.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>{p.priority}</span>
                        {p.assignedTo && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">→ {p.assignedTo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General Notes */}
        {report.generalNotes && (
          <div className="rounded-xl bg-white shadow-md border overflow-hidden">
            <div className="bg-gray-50 p-4 border-b"><h2 className="font-bold text-lg">📝 Catatan Umum</h2></div>
            <div className="p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{report.generalNotes}</p>
            </div>
          </div>
        )}

        {/* Review Section */}
        {(user?.role === "super_admin" || user?.role === "admin" || user?.role === "hr") && (
          <div className="rounded-xl bg-white shadow-md border overflow-hidden">
            <div className="bg-gray-50 p-4 border-b"><h2 className="font-bold text-lg">👁️ Review</h2></div>

            {report.status === "reviewed" && report.reviewNotes && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 m-4">
                <p className="text-sm text-green-800">
                  <span className="font-medium">Catatan Review:</span> {report.reviewNotes}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Reviewed oleh {report.reviewedByName} pada {report.reviewedAt?.toDate()?.toLocaleString("id-ID") || "-"}
                </p>
              </div>
            )}

            {report.status !== "reviewed" && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Catatan Review *</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-4 py-3 text-sm"
                    placeholder="Tulis catatan review..."
                  />
                </div>
                <button
                  onClick={() => handleStatusChange("reviewed")}
                  disabled={saving || !reviewNotes.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "✅ Approve Laporan"}
                </button>
              </div>
            )}
          </div>
        )}

        <button onClick={() => router.push("/manager-on-duty/report")} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-xl">
          ← Kembali
        </button>
      </div>
    </ProtectedRoute>
  );
}