// app/(admin)/employees/import-export/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    
    // Simulasi import
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert(`Import file ${file.name} berhasil!`);
    setFile(null);
    setImporting(false);
  };

  const handleExport = () => {
    // Simulasi export
    alert("Export data pegawai sedang diproses...");
  };

  const handleDownloadTemplate = () => {
    alert("Download template Excel...");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/employees" className="p-2 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Import / Export Data</h1>
          <p className="text-sm text-gray-500 mt-1">Import atau export data pegawai dalam format Excel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Import Data</h2>
              <p className="text-sm text-gray-500">Upload file Excel untuk menambah pegawai</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleDownloadTemplate}
              className="w-full py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
            >
              Download Template Excel
            </button>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer block"
              >
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600">
                  {file ? file.name : "Klik untuk pilih file atau drag & drop"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Format: .xlsx, .xls, .csv</p>
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {importing ? "Mengimport..." : "Import Data"}
            </button>
          </div>
        </div>

        {/* Export Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Export Data</h2>
              <p className="text-sm text-gray-500">Export data pegawai ke Excel</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Semua Data
              </button>
              <button className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Data Aktif
              </button>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export ke Excel
            </button>
          </div>
        </div>
      </div>

      {/* Informasi */}
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Panduan Import</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Download template Excel terlebih dahulu</li>
              <li>Isi data sesuai format yang sudah ditentukan</li>
              <li>Pastikan tidak ada data yang kosong pada kolom wajib (Nama, Email)</li>
              <li>File maksimal 5MB</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}