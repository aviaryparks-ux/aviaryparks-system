// app/(admin)/assessments/input/page.tsx
"use client";
import LoadingScreen from "@/components/ui/LoadingScreen";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface KPISetting {
  id: string;
  division: string;
  department: string;
  position: string;
  level: string;
  indicator: string;
  description: string;
  measurement: string;
  weight: number;
  isActive: boolean;
}

interface Period {
  id: string;
  name: string;
  status: string;
}

interface Score {
  aspectId: string;
  score: number;
  notes: string;
}

export default function InputAssessmentPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kpis, setKpis] = useState<KPISetting[]>([]);
  const [activeKpis, setActiveKpis] = useState<KPISetting[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assessmentType, setAssessmentType] = useState<"self" | "manager">("manager");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesSnap, aspectsSnap, periodsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "in", ["employee", "spv", "manager"]))),
        getDocs(collection(db, "kpiSettings")),
        getDocs(query(collection(db, "assessmentPeriods"), where("status", "==", "active"))),
      ]);
      
      setEmployees(employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setKpis(aspectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as KPISetting)));
      setPeriods(periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Period)));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employeeId: string) => {
    setSelectedEmployee(employeeId);
    
    const employee = employees.find(e => e.id === employeeId);
    let filtered = kpis.filter(kpi => kpi.isActive);
    if (employee) {
      filtered = filtered.filter(kpi => kpi.department === employee.department);
    }
    setActiveKpis(filtered);

    // Initialize scores for all aspects
    setScores(filtered.map(kpi => ({ aspectId: kpi.id, score: 0, notes: "" })));
  };

  const updateScore = (aspectId: string, field: keyof Score, value: any) => {
    setScores(scores.map(s => s.aspectId === aspectId ? { ...s, [field]: value } : s));
  };

  const calculateTotalScore = () => {
    let total = 0;
    scores.forEach(score => {
      const kpi = activeKpis.find(a => a.id === score.aspectId);
      if (kpi) {
        total += (score.score / 100) * kpi.weight;
      }
    });
    return total;
  };

  const getRating = (score: number) => {
    if (score >= 90) return "Sangat Baik";
    if (score >= 75) return "Baik";
    if (score >= 60) return "Cukup";
    if (score >= 50) return "Kurang";
    return "Sangat Kurang";
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedPeriod) {
      alert("Pilih karyawan dan periode penilaian terlebih dahulu");
      return;
    }

    const totalScore = calculateTotalScore();
    const rating = getRating(totalScore);

    setSubmitting(true);
    try {
      const assessmentData = {
        employeeId: selectedEmployee,
        employeeName: employees.find(e => e.id === selectedEmployee)?.name,
        periodId: selectedPeriod,
        periodName: periods.find(p => p.id === selectedPeriod)?.name,
        [assessmentType === "self" ? "selfAssessment" : "managerAssessment"]: {
          scores,
          totalScore,
          submittedAt: Timestamp.now(),
        },
        status: assessmentType === "self" ? "self_done" : "manager_done",
        updatedAt: Timestamp.now(),
      };

      // Check if assessment already exists
      const existingQuery = await getDocs(query(collection(db, "assessments"), where("employeeId", "==", selectedEmployee), where("periodId", "==", selectedPeriod)));
      
      if (!existingQuery.empty) {
        await updateDoc(doc(db, "assessments", existingQuery.docs[0].id), assessmentData);
      } else {
        await addDoc(collection(db, "assessments"), { ...assessmentData, createdAt: Timestamp.now() });
      }

      alert("Penilaian berhasil disimpan!");
      setSelectedEmployee("");
      setSelectedPeriod("");
      setScores([]);
    } catch (error) {
      console.error("Error saving assessment:", error);
      alert("Gagal menyimpan penilaian");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} size={150} />;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Input Penilaian</h1><p className="text-sm text-gray-500 mt-1">Input penilaian kinerja karyawan</p></div>

      {/* Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe Penilaian</label><select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value as any)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="manager">Manager Assessment</option><option value="self">Self Assessment</option></select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Karyawan</label><select value={selectedEmployee} onChange={(e) => handleEmployeeSelect(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">Pilih Karyawan</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Periode Penilaian</label><select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">Pilih Periode</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
      </div>

      {/* Assessment Form */}
      {selectedEmployee && selectedPeriod && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200"><h2 className="font-semibold text-gray-800">Form Penilaian</h2></div>
          <div className="p-6 space-y-6">
            {activeKpis.length === 0 ? (
               <div className="text-center text-gray-500 py-4">Tidak ada KPI yang ditemukan untuk Karyawan/Departemen ini. Pastikan KPI sudah di-set di Pengaturan KPI.</div>
            ) : (
              activeKpis.map((kpi) => (
                <div key={kpi.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-800">{kpi.indicator}</h3>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Bobot: {kpi.weight}%</span>
                  </div>
                  {kpi.description && <p className="text-sm text-gray-500 mb-2">{kpi.description}</p>}
                  {kpi.measurement && <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block mb-3">Cara Mengukur: {kpi.measurement}</p>}
                  
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nilai (0-100)</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min="0" max="100" value={scores.find(s => s.aspectId === kpi.id)?.score || 0} onChange={(e) => updateScore(kpi.id, "score", parseInt(e.target.value))} className="w-full accent-blue-600" />
                        <div className="text-sm font-semibold w-8 text-center">{scores.find(s => s.aspectId === kpi.id)?.score || 0}</div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
                      <textarea rows={2} value={scores.find(s => s.aspectId === kpi.id)?.notes || ""} onChange={(e) => updateScore(kpi.id, "notes", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="Catatan untuk KPI ini..." />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div><span className="text-sm text-gray-600">Total Skor: </span><span className="text-xl font-bold text-green-600">{calculateTotalScore().toFixed(1)}</span><span className="text-sm text-gray-500 ml-2">({getRating(calculateTotalScore())})</span></div>
            <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{submitting ? "Menyimpan..." : "Simpan Penilaian"}</button>
          </div>
        </div>
      )}
    </div>
  );
}