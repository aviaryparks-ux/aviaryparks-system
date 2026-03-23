"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-10">

      <h1 className="text-3xl font-bold mb-8">
        Admin Panel Aviary Parks
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <Link href="/dashboard" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Dashboard
        </Link>

        <Link href="/attendance" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Attendance
        </Link>

        <Link href="/approval-flow" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Approval Flow
        </Link>

        <Link href="/attendance-corrections" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Attendance Corrections
        </Link>

        <Link href="/users" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Users
        </Link>

        <Link href="/settings" className="bg-white p-6 rounded-xl shadow hover:bg-gray-50">
          Settings
        </Link>

      </div>

    </div>
  );
}