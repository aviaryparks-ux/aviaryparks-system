"use client";

import { useState } from "react";
import { Download, Upload, X, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

interface ImportExcelModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportExcelModal({ onClose, onSuccess }: ImportExcelModalProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");

  const extractSheetId = (url: string) => {
    const regex = /\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const downloadTemplate = () => {
    // Define the headers
    const ws_data = [
      ["Departemen", "Divisi", "Posisi", "Level", "Indikator", "Deskripsi", "Cara Mengukur", "Bobot"]
    ];
    // Create a worksheet
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Add some column widths for better UX
    ws['!cols'] = [
      { wch: 20 }, // Departemen
      { wch: 20 }, // Divisi
      { wch: 20 }, // Posisi
      { wch: 15 }, // Level
      { wch: 30 }, // Indikator
      { wch: 40 }, // Deskripsi
      { wch: 40 }, // Cara Mengukur
      { wch: 10 }  // Bobot
    ];

    // Create a workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_KPI");

    // Save the file
    XLSX.writeFile(wb, "Template_Import_KPI.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      setFile(fileList[0]);
    }
  };

  const processData = async (jsonData: any[], toastId: string) => {
    if (jsonData.length === 0) {
      throw new Error("Data kosong");
    }

    // Format validation and grouping by Role (Dept + Div + Pos + Lvl)
    const rolesMap = new Map<string, { weight: number, rows: any[] }>();

    for (const row of jsonData as any[]) {
      if (!row.Departemen || !row.Divisi || !row.Posisi || !row.Level || !row.Indikator || !row.Deskripsi || !row["Cara Mengukur"] || !row.Bobot) {
        throw new Error("Terdapat baris dengan data yang tidak lengkap. Pastikan semua kolom terisi.");
      }

      const roleKey = `${row.Departemen}|${row.Divisi}|${row.Posisi}|${row.Level}`;
      const bobot = Number(row.Bobot);
      
      if (isNaN(bobot)) {
        throw new Error(`Bobot pada baris indikator "${row.Indikator}" bukan sebuah angka.`);
      }

      if (!rolesMap.has(roleKey)) {
        rolesMap.set(roleKey, { weight: 0, rows: [] });
      }

      const roleData = rolesMap.get(roleKey)!;
      roleData.weight += bobot;
      roleData.rows.push(row);
    }

    // Validate 100% weight per role
    for (const [roleKey, roleData] of rolesMap.entries()) {
      if (roleData.weight !== 100) {
        const parts = roleKey.split('|');
        throw new Error(`Total bobot untuk posisi ${parts[2]} (${parts[0]} - ${parts[1]}) adalah ${roleData.weight}%. Bobot harus tepat 100%.`);
      }
    }

    // Save to Firebase
    const promises = [];
    for (const [roleKey, roleData] of rolesMap.entries()) {
      for (const row of roleData.rows) {
        promises.push(
          addDoc(collection(db, "kpiSettings"), {
            department: row.Departemen,
            division: row.Divisi,
            position: row.Posisi,
            level: row.Level,
            indicator: row.Indikator,
            description: row.Deskripsi,
            measurement: row["Cara Mengukur"],
            weight: Number(row.Bobot),
            isActive: true
          })
        );
      }
    }

    await Promise.all(promises);
    toast.success(`Berhasil mengimpor ${promises.length} KPI!`, { id: toastId });
    onSuccess();
  };

  const processFile = async () => {
    if (!file) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Memproses file...");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      await processData(jsonData, toastId);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Terjadi kesalahan saat memproses file", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const processUrl = async () => {
    if (!sheetUrl) {
      toast.error("Masukkan link Google Spreadsheet");
      return;
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("Link Google Spreadsheet tidak valid");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mengunduh data dari Google...");

    try {
      const res = await fetch(`/api/import-sheet?sheetId=${sheetId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengambil data dari Google Spreadsheet");
      }

      const csvText = await res.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      await processData(jsonData, toastId);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Gagal memproses data dari link", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            Import KPI via Excel / Spreadsheet
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1 */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">1. Unduh Template</h3>
            <p className="text-sm text-slate-500 mb-3">
              Silakan unduh template yang sudah diformat khusus, lalu isi data KPI Anda pada kolom yang disediakan. Bisa diedit menggunakan Microsoft Excel atau Google Spreadsheet.
            </p>
            <button 
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Unduh Template.xlsx
            </button>
          </div>

          <div className="border-t border-slate-100"></div>

          {/* Step 2 */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">2. Upload File</h3>
            <p className="text-sm text-slate-500 mb-3">
              Pastikan **Total Bobot** untuk satu jabatan (Departemen, Divisi, Posisi, Level yang sama) jumlahnya tepat **100%**.
            </p>
            
            <div className="mt-2 flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors relative">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-slate-400" />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 px-2 py-1">
                      <span>{file ? file.name : "Pilih file Excel / CSV"}</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-2 flex justify-end">
              <button 
                onClick={processFile}
                disabled={loading || !file}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && file ? "Memproses..." : "Upload File"}
              </button>
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">ATAU</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Step 3: Link Import */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">3. Tarik Data dari Link Google Sheets</h3>
            <p className="text-sm text-slate-500 mb-3">
              Pastikan akses link sudah disetel ke <b>"Anyone with the link can view"</b>.
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Paste link https://docs.google.com/spreadsheets/d/..." 
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition-all"
              />
              <button 
                onClick={processUrl}
                disabled={loading || !sheetUrl}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {loading && sheetUrl ? "Menarik..." : "Tarik Data"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="px-6 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors w-full"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
