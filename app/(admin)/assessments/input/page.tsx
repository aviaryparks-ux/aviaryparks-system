// app/(admin)/assessments/input/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface Aspect {
  id: string;
  name: string;
  indicators: string[];
  weight: number;
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
  const [aspects, setAspects] = useState<Aspect[]>([]);
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
        getDocs(collection(db, "assessmentAspects")),
        getDocs(query(collection(db, "assessmentPeriods"), where("status", "==", "active"))),
      ]);
      
      setEmployees(employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setAspects(aspectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aspect)));
      setPeriods(periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Period)));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employeeId: string) => {
    setSelectedEmployee(employeeId);
    // Initialize scores for all aspects
    setScores(aspects.map(aspect => ({ aspectId: aspect.id, score: 0, notes: "" })));
  };

  const updateScore = (aspectId: string, field: keyof Score, value: any) => {
    setScores(scores.map(s => s.aspectId === aspectId ? { ...s, [field]: value } : s));
  };

  const calculateTotalScore = () => {
    let total = 0;
    scores.forEach(score => {
      const aspect = aspects.find(a => a.id === score.aspectId);
      if (aspect) {
        total += (score.score / 100) * aspect.weight;
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

  if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

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
            {aspects.map((aspect) => (
              <div key={aspect.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex justify-between items-start mb-2"><h3 className="font-medium text-gray-800">{aspect.name}</h3><span className="text-sm text-gray-500">Bobot: {aspect.weight}%</span></div>
                <ul className="mb-3 text-sm text-gray-500 list-disc list-inside">{aspect.indicators?.map((ind, i) => <li key={i}>{ind}</li>)}</ul>
                <div className="flex gap-4 items-start">
                  <div className="flex-1"><label className="block text-sm text-gray-600 mb-1">Nilai (0-100)</label><input type="range" min="0" max="100" value={scores.find(s => s.aspectId === aspect.id)?.score || 0} onChange={(e) => updateScore(aspect.id, "score", parseInt(e.target.value))} className="w-full" /><div className="text-right text-sm font-semibold mt-1">{scores.find(s => s.aspectId === aspect.id)?.score || 0}</div></div>
                  <div className="flex-1"><label className="block text-sm text-gray-600 mb-1">Catatan</label><textarea rows={2} value={scores.find(s => s.aspectId === aspect.id)?.notes || ""} onChange={(e) => updateScore(aspect.id, "notes", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Catatan untuk aspek ini..." /></div>
                </div>
              </div>
            ))}
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