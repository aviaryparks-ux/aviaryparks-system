"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import Select from "react-select";

interface Division {
  id: string;
  name: string;
  spvUid: string;
}

interface Position {
  id: string;
  name: string;
  userUid?: string;
}

interface Division {
  id: string;
  name: string;
  spvUid: string;
  positions: Position[];
}

interface Department {
  id: string;
  name: string;
  hodUid: string;
  divisions: Division[];
  sections?: any[]; // legacy
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

export default function DepartmentsSettingsPage() {
  const { user: currentUser } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [hodUid, setHodUid] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: UserData[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        usersList.push({
          id: d.id,
          name: data.name || "Unknown",
          role: data.role || "employee"
        });
      });
      usersList.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(usersList);

      const deptSnap = await getDocs(collection(db, "departments"));
      const deptList: Department[] = [];
      deptSnap.forEach((d) => {
        const data = d.data();
        let loadedDivisions: Division[] = data.divisions || [];
        
        // Migrate legacy sections to flat divisions
        if (data.sections && data.sections.length > 0 && loadedDivisions.length === 0) {
          const flattenedDivs: Division[] = [];
          data.sections.forEach((sec: any) => {
            if (sec.divisions) {
              flattenedDivs.push(...sec.divisions);
            }
          });
          loadedDivisions = flattenedDivs;
        }

        // Ensure positions array exists
        loadedDivisions = loadedDivisions.map(div => ({
          ...div,
          positions: div.positions || []
        }));

        deptList.push({
          id: d.id,
          name: data.name || "",
          hodUid: data.hodUid || data.managerUid || "",
          divisions: loadedDivisions,
        });
      });
      setDepartments(deptList);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDivision = () => {
    setDivisions([
      ...divisions,
      { id: Date.now().toString(), name: "", spvUid: "", positions: [] }
    ]);
  };

  const handleUpdateDivision = (index: number, field: keyof Division, value: any) => {
    const updated = [...divisions];
    updated[index] = { ...updated[index], [field]: value };
    setDivisions(updated);
  };

  const handleRemoveDivision = (index: number) => {
    const updated = divisions.filter((_, i) => i !== index);
    setDivisions(updated);
  };

  const handleAddPosition = (divIndex: number) => {
    const updated = [...divisions];
    updated[divIndex].positions.push({
      id: Date.now().toString() + Math.random().toString().slice(2,5),
      name: ""
    });
    setDivisions(updated);
  };

  const handleUpdatePosition = (divIndex: number, posIndex: number, field: keyof Position, value: string) => {
    const updated = [...divisions];
    updated[divIndex].positions[posIndex] = { ...updated[divIndex].positions[posIndex], [field]: value };
    setDivisions(updated);
  };

  const handleRemovePosition = (divIndex: number, posIndex: number) => {
    const updated = [...divisions];
    updated[divIndex].positions = updated[divIndex].positions.filter((_, i) => i !== posIndex);
    setDivisions(updated);
  };

  const handleSave = async () => {
    if (!deptName.trim()) {
      alert("Department name is required.");
      return;
    }

    try {
      const idToSave = editingId || `dept_${Date.now()}`;
      
      const normalizedName = deptName.trim().toUpperCase();
      const normalizedDivisions = divisions.map(div => ({
        ...div,
        name: div.name.trim().toUpperCase(),
        positions: div.positions.map(pos => ({
          name: pos.name.trim().toUpperCase(),
          userUid: pos.userUid || ""
        })).filter(pos => pos.name !== "")
      })).filter(div => div.name !== "");

      const dataToSave = {
        name: normalizedName,
        hodUid,
        divisions: normalizedDivisions,
        updatedAt: Timestamp.now(),
      };

      if (!editingId) {
        (dataToSave as any).createdAt = Timestamp.now();
      }

      await setDoc(doc(db, "departments", idToSave), dataToSave, { merge: true });
      alert("✅ Department saved successfully.");
      
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error("Error saving department:", error);
      alert("Failed to save department.");
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingId(dept.id);
    setDeptName(dept.name);
    setHodUid(dept.hodUid);
    setDivisions(dept.divisions || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "departments", id));
      alert("✅ Department deleted.");
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setDeptName("");
    setHodUid("");
    setDivisions([]);
  };

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="manage_settings">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  const potentialHods = users.filter(u => ["hod", "gm", "owner", "super_admin", "manager"].includes(u.role));
  const potentialManagers = users.filter(u => ["manager", "hod", "gm", "owner", "super_admin"].includes(u.role));
  const potentialSpvs = users; // SPV can be anyone technically

  const spvOptions = potentialSpvs.map(u => ({ value: u.id, label: `${u.name} (${u.role})` }));
  const userOptions = users.map(u => ({ value: u.id, label: u.name }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderColor: '#e2e8f0',
      borderRadius: '0.5rem',
      padding: '1px',
      boxShadow: 'none',
      fontSize: '0.875rem',
      '&:hover': {
        borderColor: '#22c55e'
      }
    }),
    option: (base: any) => ({
      ...base,
      fontSize: '0.875rem'
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50
    })
  };

  return (
    <ProtectedRoute requiredFeature="manage_settings">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Master Departments & Organization Structure</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure organizational structure (Department ➔ Division ➔ Position) and approval routing.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            {showForm ? "Cancel" : "+ Add Department"}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editingId ? "Edit Department" : "Create New Department"}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. OPERATIONAL"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kepala Departemen (HOD / GM / Owner)</label>
                <select
                  value={hodUid}
                  onChange={(e) => setHodUid(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">-- No HOD Assigned --</option>
                  {potentialHods.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">This person will oversee the entire department.</p>
              </div>
            </div>

            {/* Divisions Section */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-slate-800">Divisions & Positions</h3>
                <button
                  onClick={handleAddDivision}
                  className="text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-green-200"
                >
                  + Add Division
                </button>
              </div>

              {divisions.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm">
                  No divisions added yet. Click "+ Add Division" to create one.
                </div>
              ) : (
                <div className="space-y-6">
                  {divisions.map((div, divIdx) => (
                    <div key={div.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
                        <div className="flex-1 w-full">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Division Name</label>
                          <input
                            type="text"
                            placeholder="e.g. KITCHEN"
                            value={div.name}
                            onChange={(e) => handleUpdateDivision(divIdx, "name", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none uppercase"
                          />
                        </div>
                        <div className="flex-1 w-full">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Kepala Division (SPV)</label>
                          <Select
                            options={spvOptions}
                            value={spvOptions.find(opt => opt.value === div.spvUid) || null}
                            onChange={(option: any) => handleUpdateDivision(divIdx, "spvUid", option ? option.value : "")}
                            isClearable
                            placeholder="-- No SPV Assigned --"
                            styles={selectStyles}
                            className="w-full"
                          />
                        </div>
                        <div className="mt-5">
                          <button
                            onClick={() => handleRemoveDivision(divIdx)}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                            title="Remove Division"
                          >
                            Delete Division
                          </button>
                        </div>
                      </div>

                      {/* Nested Positions */}
                      <div className="pl-6 border-l-2 border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-semibold text-slate-600">Positions in this Division</h4>
                          <button
                            onClick={() => handleAddPosition(divIdx)}
                            className="text-xs bg-white hover:bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-300 font-medium transition-colors"
                          >
                            + Add Position
                          </button>
                        </div>

                        {(!div.positions || div.positions.length === 0) ? (
                          <div className="text-xs text-slate-400 italic mb-2">No positions defined.</div>
                        ) : (
                          <div className="space-y-2">
                            {div.positions.map((pos, posIdx) => (
                              <div key={pos.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={pos.name}
                                    onChange={(e) => handleUpdatePosition(divIdx, posIdx, 'name', e.target.value)}
                                    placeholder="Position Name (e.g. TEKNISI AC)"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                  />
                                </div>
                                <div className="flex-1">
                                  <Select
                                    options={userOptions}
                                    value={userOptions.find(opt => opt.value === pos.userUid) || null}
                                    onChange={(option: any) => handleUpdatePosition(divIdx, posIdx, 'userUid', option ? option.value : "")}
                                    isClearable
                                    placeholder="-- Assigned To --"
                                    styles={selectStyles}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <button
                                    onClick={() => handleRemovePosition(divIdx, posIdx)}
                                    className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Save Department
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {!showForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                No departments found. Create your first department to set up the organizational structure.
              </div>
            ) : (
              departments.map((dept) => {
                const hod = users.find(u => u.id === dept.hodUid);
                const totalPositions = dept.divisions?.reduce((acc, div) => acc + (div.positions?.length || 0), 0) || 0;
                
                return (
                  <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-slate-800">{dept.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {dept.divisions?.length || 0} Divisions
                          </span>
                          <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {totalPositions} Positions
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Head of Department</p>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                            {hod ? hod.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {hod ? hod.name : <span className="text-slate-400 italic">Unassigned</span>}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {!dept.divisions || dept.divisions.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No divisions defined</p>
                        ) : (
                          dept.divisions.map(div => {
                            const spv = users.find(u => u.id === div.spvUid);
                            return (
                              <div key={div.id} className="border border-slate-100 rounded-lg overflow-hidden">
                                <div className="bg-slate-100 px-3 py-2 flex justify-between items-center">
                                  <div>
                                    <p className="text-xs font-bold text-slate-700">{div.name}</p>
                                    <p className="text-[10px] text-slate-500">SPV: {spv?.name || 'Unassigned'}</p>
                                  </div>
                                </div>
                                <div className="bg-white p-2">
                                  {(!div.positions || div.positions.length === 0) ? (
                                    <p className="text-[10px] text-slate-400 italic px-1">No positions</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {div.positions.map(pos => {
                                        return (
                                          <li key={pos.id} className="text-[11px] flex justify-between items-center py-1 px-2 hover:bg-slate-50 rounded">
                                            <span className="font-medium text-slate-600">• {pos.name}</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 flex justify-end gap-2 border-t border-slate-100">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1 hover:bg-blue-50 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1 hover:bg-red-50 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        
      </div>
    </ProtectedRoute>
  );
}
