// app/(admin)/assessments/active/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
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
  const [periods, setPeriods] = useState<Period[]>([]); // 🔥 TAMBAHKAN STATE PERIODS
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  useEffect(() => {
    fetchActiveAssessments();
  }, []);

  const fetchActiveAssessments = async () => {
    try {
      // 🔥 AMBIL DULU PERIODE YANG AKTIF
      const periodsSnap = await getDocs(query(collection(db, "assessmentPeriods"), where("status", "==", "active")));
      const activePeriods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Period));
      setPeriods(activePeriods);
      
      const activePeriodIds = activePeriods.map(p => p.id);
      
      if (activePeriodIds.length === 0) {
        setAssessments([]);
        setLoading(false);
        return;
      }

      const assessmentsSnap = await getDocs(query(collection(db, "assessments"), where("periodId", "in", activePeriodIds)));
      const data = assessmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment));
      setAssessments(data);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (confirm("Setujui penilaian ini?")) {
      await updateDoc(doc(db, "assessments", id), { status: "approved", approvedAt: new Date() });
      fetchActiveAssessments();
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Alasan penolakan:");
    if (reason) {
      await updateDoc(doc(db, "assessments", id), { status: "rejected", rejectionReason: reason, rejectedAt: new Date() });
      fetchActiveAssessments();
    }
  };

  const getProgress = (assessment: Assessment) => {
    let progress = 0;
    if (assessment.selfAssessment) progress += 50;
    if (assessment.managerAssessment) progress += 50;
    return progress;
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dalam Masa Penilaian</h1>
        <p className="text-sm text-gray-500 mt-1">Penilaian yang sedang berlangsung</p>
      </div>

      {periods.length === 0 ? (
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-yellow-800">Tidak ada periode penilaian yang aktif. Silakan aktifkan periode terlebih dahulu di menu Periode Penilaian.</p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">Belum ada penilaian untuk periode aktif</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assessments.map((assessment) => (
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
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${getProgress(assessment)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Self Assessment</div>
                    <div className="font-semibold">{assessment.selfAssessment ? `${assessment.selfAssessment.totalScore} poin` : "Belum diisi"}</div>
                    <div className="text-xs text-gray-400">{assessment.selfAssessment?.submittedAt?.toDate().toLocaleDateString()}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Manager Assessment</div>
                    <div className="font-semibold">{assessment.managerAssessment ? `${assessment.managerAssessment.totalScore} poin` : "Belum diisi"}</div>
                    <div className="text-xs text-gray-400">{assessment.managerAssessment?.submittedAt?.toDate().toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => handleApprove(assessment.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Setujui</button>
                  <button onClick={() => handleReject(assessment.id)} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Tolak</button>
                  <button onClick={() => setSelectedAssessment(assessment)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Detail</button>
                </div>
              </div>
            </div>
          ))}
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
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Self Assessment</p>
                  <p className="font-medium text-green-600">{selectedAssessment.selfAssessment.totalScore} poin</p>
                  <p className="text-xs text-gray-400">Dikirim: {selectedAssessment.selfAssessment.submittedAt?.toDate().toLocaleString()}</p>
                </div>
              )}
              {selectedAssessment.managerAssessment && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Manager Assessment</p>
                  <p className="font-medium text-green-600">{selectedAssessment.managerAssessment.totalScore} poin</p>
                  <p className="text-xs text-gray-400">Dikirim: {selectedAssessment.managerAssessment.submittedAt?.toDate().toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}