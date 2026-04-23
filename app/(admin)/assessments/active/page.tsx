// app/(admin)/assessments/active/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Assessment {
  id: string;
  employeeId: string;
  employeeName: string;
  periodId: string;
  periodName: string;
  selfAssessment?: { totalScore: number; submittedAt: any };
  managerAssessment?: { totalScore: number; submittedAt: any };
  status: string;
}

interface Period {
  id: string;
  name: string;
  status: string;
}

export default function ActiveAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 🔥 Untuk loading per tombol
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null); // 🔥 Notifikasi sukses

  useEffect(() => {
    fetchActiveAssessments();
  }, []);

  const fetchActiveAssessments = async () => {
    setLoading(true);
    try {
      // Ambil periode yang aktif
      const periodsSnap = await getDocs(query(collection(db, "assessmentPeriods"), where("status", "==", "active")));
      const activePeriods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Period));
      setPeriods(activePeriods);
      
      const activePeriodIds = activePeriods.map(p => p.id);
      
      if (activePeriodIds.length === 0) {
        setAssessments([]);
        setLoading(false);
        return;
      }

      // Ambil assessments yang periodId-nya masuk dalam activePeriodIds
      const assessmentsSnap = await getDocs(query(collection(db, "assessments"), where("periodId", "in", activePeriodIds)));
      const data = assessmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment));
      setAssessments(data);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      alert("Gagal memuat data penilaian");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FUNGSI APPROVE DENGAN FEEDBACK
  const handleApprove = async (id: string, employeeName: string) => {
    if (!confirm(`Setujui penilaian untuk ${employeeName}?`)) return;
    
    setActionLoading(id);
    try {
      await updateDoc(doc(db, "assessments", id), { 
        status: "approved", 
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      // Tampilkan notifikasi sukses
      setShowSuccess(`✅ Penilaian ${employeeName} berhasil disetujui`);
      setTimeout(() => setShowSuccess(null), 3000);
      
      // Refresh data
      await fetchActiveAssessments();
    } catch (error) {
      console.error("Error approving assessment:", error);
      alert("❌ Gagal menyetujui penilaian");
    } finally {
      setActionLoading(null);
    }
  };

  // 🔥 FUNGSI REJECT DENGAN FEEDBACK
  const handleReject = async (id: string, employeeName: string) => {
    const reason = prompt("Alasan penolakan:");
    if (!reason) return;
    
    setActionLoading(id);
    try {
      await updateDoc(doc(db, "assessments", id), { 
        status: "rejected", 
        rejectionReason: reason, 
        rejectedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      // Tampilkan notifikasi sukses
      setShowSuccess(`❌ Penilaian ${employeeName} ditolak`);
      setTimeout(() => setShowSuccess(null), 3000);
      
      // Refresh data
      await fetchActiveAssessments();
    } catch (error) {
      console.error("Error rejecting assessment:", error);
      alert("❌ Gagal menolak penilaian");
    } finally {
      setActionLoading(null);
    }
  };

  const getProgress = (assessment: Assessment) => {
    let progress = 0;
    if (assessment.selfAssessment) progress += 50;
    if (assessment.managerAssessment) progress += 50;
    return progress;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    try {
      return timestamp.toDate().toLocaleDateString("id-ID");
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifikasi Sukses */}
      {showSuccess && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {showSuccess}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dalam Masa Penilaian</h1>
        <p className="text-sm text-gray-500 mt-1">Penilaian yang sedang berlangsung</p>
      </div>

      {periods.length === 0 ? (
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-800">Tidak ada periode penilaian yang aktif. Silakan aktifkan periode terlebih dahulu di menu Periode Penilaian.</p>
          </div>
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">
          <div className="text-5xl mb-4">📋</div>
          <p>Belum ada penilaian untuk periode aktif</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assessments.map((assessment) => {
            const isActionLoading = actionLoading === assessment.id;
            const isCompleted = assessment.selfAssessment && assessment.managerAssessment;
            
            return (
              <div key={assessment.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{assessment.employeeName}</h3>
                      <p className="text-sm text-gray-500">{assessment.periodName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Progress</div>
                      <div className="text-xl font-bold text-green-600">{getProgress(assessment)}%</div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${getProgress(assessment)}%` }} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={`p-3 rounded-lg ${assessment.selfAssessment ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                      <div className="text-sm text-gray-500">Self Assessment</div>
                      <div className="font-semibold">
                        {assessment.selfAssessment ? `${assessment.selfAssessment.totalScore} poin` : "Belum diisi"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {assessment.selfAssessment ? formatDate(assessment.selfAssessment.submittedAt) : "-"}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${assessment.managerAssessment ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
                      <div className="text-sm text-gray-500">Manager Assessment</div>
                      <div className="font-semibold">
                        {assessment.managerAssessment ? `${assessment.managerAssessment.totalScore} poin` : "Belum diisi"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {assessment.managerAssessment ? formatDate(assessment.managerAssessment.submittedAt) : "-"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    {isCompleted && assessment.status !== "approved" && assessment.status !== "rejected" && (
                      <>
                        <button 
                          onClick={() => handleApprove(assessment.id, assessment.employeeName)} 
                          disabled={isActionLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isActionLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Setujui
                        </button>
                        <button 
                          onClick={() => handleReject(assessment.id, assessment.employeeName)} 
                          disabled={isActionLoading}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                        >
                          Tolak
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => setSelectedAssessment(assessment)} 
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Detail
                    </button>
                  </div>
                  
                  {/* Status badge jika sudah diproses */}
                  {assessment.status === "approved" && (
                    <div className="mt-3 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Sudah Disetujui
                      </span>
                    </div>
                  )}
                  {assessment.status === "rejected" && (
                    <div className="mt-3 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-red-100 text-red-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Ditolak
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Detail Penilaian</h2>
              <button onClick={() => setSelectedAssessment(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Karyawan</p>
                <p className="font-medium">{selectedAssessment.employeeName}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Periode</p>
                <p className="font-medium">{selectedAssessment.periodName}</p>
              </div>
              {selectedAssessment.selfAssessment && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600 font-medium">Self Assessment</p>
                  <p className="text-2xl font-bold text-green-700">{selectedAssessment.selfAssessment.totalScore} poin</p>
                  <p className="text-xs text-gray-500 mt-1">Dikirim: {formatDate(selectedAssessment.selfAssessment.submittedAt)}</p>
                </div>
              )}
              {selectedAssessment.managerAssessment && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium">Manager Assessment</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedAssessment.managerAssessment.totalScore} poin</p>
                  <p className="text-xs text-gray-500 mt-1">Dikirim: {formatDate(selectedAssessment.managerAssessment.submittedAt)}</p>
                </div>
              )}
              {selectedAssessment.status === "rejected" && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600 font-medium">Alasan Penolakan</p>
                  <p className="text-gray-700">{(selectedAssessment as any).rejectionReason || "-"}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setSelectedAssessment(null)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}