// app/(admin)/assessments/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AssessmentHistory {
  id: string;
  employeeName: string;
  periodName: string;
  selfScore?: number;
  managerScore?: number;
  finalScore: number;
  rating: string;
  status: string;
  approvedAt?: any;
}

export default function AssessmentHistoryPage() {
  const [assessments, setAssessments] = useState<AssessmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "assessments"), orderBy("updatedAt", "desc")));
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        const selfScore = d.selfAssessment?.totalScore;
        const managerScore = d.managerAssessment?.totalScore;
        const finalScore = managerScore || selfScore || 0;
        const rating = getRating(finalScore);
        return { 
          id: doc.id, 
          employeeName: d.employeeName, 
          periodName: d.periodName, 
          selfScore, 
          managerScore, 
          finalScore, 
          rating, 
          status: d.status, 
          approvedAt: d.approvedAt 
        } as AssessmentHistory;
      });
      setAssessments(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRating = (score: number) => {
    if (score >= 90) return "Sangat Baik";
    if (score >= 75) return "Baik";
    if (score >= 60) return "Cukup";
    if (score >= 50) return "Kurang";
    return "Sangat Kurang";
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "Sangat Baik": return "text-green-600 bg-green-100";
      case "Baik": return "text-blue-600 bg-blue-100";
      case "Cukup": return "text-yellow-600 bg-yellow-100";
      case "Kurang": return "text-orange-600 bg-orange-100";
      default: return "text-red-600 bg-red-100";
    }
  };

  const filteredAssessments = assessments.filter(a => a.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Riwayat Penilaian</h1>
        <p className="text-sm text-gray-500 mt-1">Riwayat penilaian kinerja karyawan</p>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Cari karyawan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Karyawan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Periode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Self Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Manager Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Final Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Belum ada riwayat penilaian</td>
                </tr>
              ) : (
                filteredAssessments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.employeeName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{a.periodName}</td>
                    <td className="px-6 py-4 text-sm">{a.selfScore ? `${a.selfScore} pts` : "-"}</td>
                    <td className="px-6 py-4 text-sm">{a.managerScore ? `${a.managerScore} pts` : "-"}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{a.finalScore} pts</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getRatingColor(a.rating)}`}>{a.rating}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${a.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}