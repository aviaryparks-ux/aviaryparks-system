import React, { useState, useMemo } from "react";
import { Search, ArrowRightLeft, X, Check, ArrowRight, ArrowLeft } from "lucide-react";

type FilterUser = {
  uid: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  jabatan?: string;
  avatar?: string;
};

interface EmployeeFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedUids: string[]) => void;
  users: Record<string, any>;
  employeeList: string[]; // List of valid UIDs
  initialSelected: string[]; // "ALL" is handled outside, this should be array of UIDs
}

export default function EmployeeFilterModal({
  isOpen,
  onClose,
  onSave,
  users,
  employeeList,
  initialSelected
}: EmployeeFilterModalProps) {
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set(initialSelected));
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  // Get full user objects for all valid employees
  const allEmployees = useMemo(() => {
    return employeeList
      .filter((uid) => uid !== "ALL" && users[uid])
      .map((uid) => ({
        uid, // Explicitly inject uid
        ...users[uid]
      }) as FilterUser);
  }, [employeeList, users]);

  // Split into left (unselected) and right (selected)
  const leftEmployees = useMemo(() => {
    return allEmployees.filter((emp) => !selectedUids.has(emp.uid) && emp.name.toLowerCase().includes(leftSearch.toLowerCase()));
  }, [allEmployees, selectedUids, leftSearch]);

  const rightEmployees = useMemo(() => {
    return allEmployees.filter((emp) => selectedUids.has(emp.uid) && emp.name.toLowerCase().includes(rightSearch.toLowerCase()));
  }, [allEmployees, selectedUids, rightSearch]);

  if (!isOpen) return null;

  const handleMoveToRight = (uid: string) => {
    const newSet = new Set(selectedUids);
    newSet.add(uid);
    setSelectedUids(newSet);
  };

  const handleMoveToLeft = (uid: string) => {
    const newSet = new Set(selectedUids);
    newSet.delete(uid);
    setSelectedUids(newSet);
  };

  const handleMoveAllToRight = () => {
    const newSet = new Set(selectedUids);
    leftEmployees.forEach((emp) => newSet.add(emp.uid));
    setSelectedUids(newSet);
  };

  const handleMoveAllToLeft = () => {
    const newSet = new Set(selectedUids);
    rightEmployees.forEach((emp) => newSet.delete(emp.uid));
    setSelectedUids(newSet);
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" /> Filter Karyawan
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px] overflow-hidden">
          {/* Left Panel: Selectable */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-[400px] lg:h-auto">
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari karyawan..."
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tersedia ({leftEmployees.length})</span>
                <button onClick={handleMoveAllToRight} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Pilih Semua
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {leftEmployees.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-medium">Tidak ada karyawan ditemukan</div>
              ) : (
                leftEmployees.map((emp) => (
                  <div
                    key={emp.uid}
                    onClick={() => handleMoveToRight(emp.uid)}
                    className="flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-emerald-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300">
                      <span className="text-sm font-bold text-slate-600">{getInitials(emp.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{emp.name}</p>
                      <p className="text-xs text-slate-500 truncate">{emp.jabatan} • {emp.department}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transfer Buttons (Visible on LG) */}
          <div className="hidden lg:flex flex-col justify-center items-center gap-4">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleMoveAllToRight}
                disabled={leftEmployees.length === 0}
                className="p-2 bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                title="Pindahkan Semua ke Kanan"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleMoveAllToLeft}
                disabled={rightEmployees.length === 0}
                className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                title="Kembalikan Semua ke Kiri"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Panel: Selected */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-[400px] lg:h-auto">
            <div className="p-3 border-b border-slate-100 bg-emerald-50/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari yang terpilih..."
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Terpilih ({rightEmployees.length})</span>
                <button onClick={handleMoveAllToLeft} className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors">
                  Hapus Semua
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-emerald-50/10">
              {rightEmployees.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-medium">Belum ada karyawan yang dipilih</div>
              ) : (
                rightEmployees.map((emp) => (
                  <div
                    key={emp.uid}
                    onClick={() => handleMoveToLeft(emp.uid)}
                    className="flex items-center gap-3 p-2 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-rose-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                      <span className="text-sm font-bold text-emerald-700">{getInitials(emp.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{emp.name}</p>
                      <p className="text-xs text-slate-500 truncate">{emp.jabatan} • {emp.department}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={() => {
              onSave(Array.from(selectedUids));
              onClose();
            }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Terapkan ({selectedUids.size})
          </button>
        </div>
      </div>
    </div>
  );
}
