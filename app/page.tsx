"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <h1 className="text-3xl font-bold mb-6">
        Admin Panel Aviary Parks
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg mb-2">Dashboard</h2>
          <p>Ringkasan data absensi</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg mb-2">Data Absensi</h2>
          <p>Melihat daftar kehadiran karyawan</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg mb-2">Approval</h2>
          <p>Menyetujui pengajuan</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg mb-2">History</h2>
          <p>Riwayat absensi</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg mb-2">Export</h2>
          <p>Export PDF / Excel</p>
        </div>

      </div>

    </div>
  );
}