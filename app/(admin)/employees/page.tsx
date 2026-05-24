// app/(admin)/employees/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import LoadingScreen from "@/components/ui/LoadingScreen";

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  isActive: boolean;
  joinDate: any;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("name"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment === "all" || emp.department === filterDepartment;
    return matchesSearch && matchesDept;
  });

  const departments = ["all", ...new Set(employees.map(emp => emp.department).filter(Boolean))];

  return (
    <div className="space-y-6 pb-20">
      {/* Top Actions: Filters & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow shadow-sm"
          />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-green-500 transition-shadow shadow-sm"
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>
                {dept === "all" ? "Semua Departemen" : dept}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/employees/add"
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-sm shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Pegawai
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Departemen</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Jabatan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <LoadingScreen fullScreen={false} message="Memuat data pegawai..." size={120} />
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data pegawai
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800">{emp.name || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{emp.email || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{emp.department || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{emp.position || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        emp.role === "super_admin" ? "bg-red-50 text-red-700 ring-1 ring-red-200" :
                        emp.role === "admin" ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200" :
                        emp.role === "hr" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" :
                        "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                      }`}>
                        {emp.role || "employee"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        emp.isActive !== false ? "bg-green-50 text-green-700 ring-1 ring-green-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
                      }`}>
                        {emp.isActive !== false ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button className="text-slate-400 hover:text-green-600 font-medium mr-4 transition-colors">Edit</button>
                      <button className="text-slate-400 hover:text-red-600 font-medium transition-colors">Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Total Pegawai</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{employees.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Aktif</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{employees.filter(e => e.isActive !== false).length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Departemen</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{departments.length - 1}</p>
        </div>
      </div>
    </div>
  );
}