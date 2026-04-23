// app/(admin)/reports/export/page.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ExportOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export default function ExportDataPage() {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);

  const exportOptions: ExportOption[] = [
    { id: "employees", name: "Data Karyawan", description: "Export semua data karyawan", icon: <UsersIcon />, color: "bg-blue-500" },
    { id: "attendance", name: "Data Absensi", description: "Export rekap absensi karyawan", icon: <AttendanceIcon />, color: "bg-green-500" },
    { id: "kpi", name: "Data KPI", description: "Export data KPI karyawan", icon: <KPIIcon />, color: "bg-purple-500" },
    { id: "assessments", name: "Data Penilaian", description: "Export hasil penilaian kinerja", icon: <AssessmentIcon />, color: "bg-yellow-500" },
    { id: "payroll", name: "Data Payroll", description: "Export data penggajian", icon: <PayrollIcon />, color: "bg-red-500" },
  ];

  const handleExport = async (type: string) => {
    setExporting(true);
    setExportType(type);
    try {
      let data: any[] = [];
      let filename = "";

      switch (type) {
        case "employees":
          const usersSnap = await getDocs(collection(db, "users"));
          data = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          filename = "data_karyawan.xlsx";
          break;
        case "attendance":
          const attendanceSnap = await getDocs(collection(db, "attendance"));
          data = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          filename = "data_absensi.xlsx";
          break;
        case "kpi":
          const kpiSnap = await getDocs(collection(db, "kpiData"));
          data = kpiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          filename = "data_kpi.xlsx";
          break;
        case "assessments":
          const assessmentsSnap = await getDocs(collection(db, "assessments"));
          data = assessmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          filename = "data_penilaian.xlsx";
          break;
        default:
          throw new Error("Invalid export type");
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, filename);
      
      alert(`Export ${type} berhasil!`);
    } catch (error) {
      console.error("Export error:", error);
      alert("Gagal mengexport data");
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Export Data</h1><p className="text-sm text-gray-500 mt-1">Export data ke file Excel</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {exportOptions.map((option) => (
          <div key={option.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 ${option.color} bg-opacity-10 rounded-xl flex items-center justify-center mb-4`}>
              <div className={`${option.color.replace("bg-", "text-")} opacity-80`}>{option.icon}</div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">{option.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{option.description}</p>
            <button onClick={() => handleExport(option.id)} disabled={exporting} className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {exporting && exportType === option.id ? "Exporting..." : `Export ${option.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200"><div className="flex gap-3"><svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><div className="text-sm text-blue-800"><p className="font-medium">Informasi</p><p className="mt-1">Data akan diexport dalam format Excel (.xlsx). Pastikan koneksi internet stabil sebelum melakukan export.</p></div></div></div>
    </div>
  );
}

// Icons
const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const AttendanceIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const KPIIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const AssessmentIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const PayrollIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;