"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

interface Division {
  id: string;
  name: string;
  spvUid: string;
}

interface Section {
  id: string;
  name: string;
  managerUid: string;
  divisions: Division[];
}

interface Department {
  id: string;
  name: string;
  hodUid: string;
  managerUid?: string; // legacy
  sections: Section[];
  divisions?: Division[]; // legacy
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
  const [sections, setSections] = useState<Section[]>([]);

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
        
        let loadedSections: Section[] = data.sections || [];
        
        // Migrate legacy divisions
        if (data.divisions && data.divisions.length > 0 && loadedSections.length === 0) {
          loadedSections = [
            {
              id: `sec_${Date.now()}`,
              name: "GENERAL SECTION",
              managerUid: data.managerUid || "",
              divisions: data.divisions
            }
          ];
        }

        deptList.push({
          id: d.id,
          name: data.name || "",
          hodUid: data.hodUid || data.managerUid || "",
          sections: loadedSections,
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

  const handleAddSection = () => {
    setSections([
      ...sections,
      { id: Date.now().toString(), name: "", managerUid: "", divisions: [] }
    ]);
  };

  const handleUpdateSection = (index: number, field: keyof Section, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const handleRemoveSection = (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
  };

  const handleAddDivision = (sectionIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].divisions.push({
      id: Date.now().toString() + Math.random().toString().slice(2,5),
      name: "",
      spvUid: ""
    });
    setSections(updated);
  };

  const handleUpdateDivision = (secIndex: number, divIndex: number, field: keyof Division, value: string) => {
    const updated = [...sections];
    updated[secIndex].divisions[divIndex] = { ...updated[secIndex].divisions[divIndex], [field]: value };
    setSections(updated);
  };

  const handleRemoveDivision = (secIndex: number, divIndex: number) => {
    const updated = [...sections];
    updated[secIndex].divisions = updated[secIndex].divisions.filter((_, i) => i !== divIndex);
    setSections(updated);
  };

  const handleSave = async () => {
    if (!deptName.trim()) {
      alert("Department name is required.");
      return;
    }

    try {
      const idToSave = editingId || `dept_${Date.now()}`;
      
      const normalizedName = deptName.trim().toUpperCase();
      const normalizedSections = sections.map(sec => ({
        ...sec,
        name: sec.name.trim().toUpperCase(),
        divisions: sec.divisions.map(div => ({
          ...div,
          name: div.name.trim().toUpperCase()
        })).filter(div => div.name !== "")
      })).filter(sec => sec.name !== "");

      const dataToSave = {
        name: normalizedName,
        hodUid,
        sections: normalizedSections,
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
    setSections(dept.sections || []);
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
    setSections([]);
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "owner", "gm"]}>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  const potentialHods = users.filter(u => ["hod", "gm", "owner", "super_admin", "manager"].includes(u.role));
  const potentialManagers = users.filter(u => ["manager", "hod", "gm", "owner", "super_admin"].includes(u.role));
  const potentialSpvs = users; // SPV can be anyone technically

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "owner", "gm"]}>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Master Departments & Organization Structure</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure 3-tier structure (Department ➔ Section ➔ Division) and approval routing.
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

            {/* Sections Section */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-slate-800">Sections & Divisions</h3>
                <button
                  onClick={handleAddSection}
                  className="text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-green-200"
                >
                  + Add Section
                </button>
              </div>

              {sections.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm">
                  No sections added yet. Click "+ Add Section" to create one.
                </div>
              ) : (
                <div className="space-y-6">
                  {sections.map((sec, secIdx) => (
                    <div key={sec.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
                        <div className="flex-1 w-full">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Section Name</label>
                          <input
                            type="text"
                            placeholder="e.g. F&B SECTION"
                            value={sec.name}
                            onChange={(e) => handleUpdateSection(secIdx, "name", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none uppercase"
                          />
                        </div>
                        <div className="flex-1 w-full">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Kepala Section (Manager)</label>
                          <select
                            value={sec.managerUid}
                            onChange={(e) => handleUpdateSection(secIdx, "managerUid", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                          >
                            <option value="">-- No Manager Assigned --</option>
                            {potentialManagers.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-5">
                          <button
                            onClick={() => handleRemoveSection(secIdx)}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                            title="Remove Section"
                          >
                            Delete Section
                          </button>
                        </div>
                      </div>

                      {/* Nested Divisions */}
                      <div className="pl-6 border-l-2 border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-semibold text-slate-600">Divisions in this Section</h4>
                          <button
                            onClick={() => handleAddDivision(secIdx)}
                            className="text-xs bg-white hover:bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-300 font-medium transition-colors"
                          >
                            + Add Division
                          </button>
                        </div>

                        {sec.divisions.length === 0 ? (
                          <div className="text-xs text-slate-400 italic mb-2">No divisions in this section.</div>
                        ) : (
                          <div className="space-y-2">
                            {sec.divisions.map((div, divIdx) => (
                              <div key={div.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex-[2] w-full">
                                  <input
                                    type="text"
                                    placeholder="Division Name (e.g. KITCHEN)"
                                    value={div.name}
                                    onChange={(e) => handleUpdateDivision(secIdx, divIdx, "name", e.target.value)}
                                    className="w-full border-none bg-transparent px-2 py-1 text-sm focus:ring-0 outline-none uppercase placeholder:normal-case"
                                  />
                                </div>
                                <div className="flex-[2] w-full border-l border-slate-100 pl-2">
                                  <select
                                    value={div.spvUid}
                                    onChange={(e) => handleUpdateDivision(secIdx, divIdx, "spvUid", e.target.value)}
                                    className="w-full border-none bg-transparent px-2 py-1 text-sm focus:ring-0 outline-none text-slate-600"
                                  >
                                    <option value="">-- SPV --</option>
                                    {potentialSpvs.map(u => (
                                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <button
                                    onClick={() => handleRemoveDivision(secIdx, divIdx)}
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
                const totalDivisions = dept.sections?.reduce((acc, sec) => acc + sec.divisions.length, 0) || 0;
                
                return (
                  <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-slate-800">{dept.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {dept.sections?.length || 0} Sections
                          </span>
                          <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {totalDivisions} Divisions
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
                        {!dept.sections || dept.sections.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No sections defined</p>
                        ) : (
                          dept.sections.map(sec => {
                            const manager = users.find(u => u.id === sec.managerUid);
                            return (
                              <div key={sec.id} className="border border-slate-100 rounded-lg overflow-hidden">
                                <div className="bg-slate-100 px-3 py-2 flex justify-between items-center">
                                  <div>
                                    <p className="text-xs font-bold text-slate-700">{sec.name}</p>
                                    <p className="text-[10px] text-slate-500">Mgr: {manager?.name || 'Unassigned'}</p>
                                  </div>
                                </div>
                                <div className="bg-white p-2">
                                  {sec.divisions.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic px-1">No divisions</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {sec.divisions.map(div => {
                                        const spv = users.find(u => u.id === div.spvUid);
                                        return (
                                          <li key={div.id} className="text-[11px] flex justify-between items-center py-1 px-2 hover:bg-slate-50 rounded">
                                            <span className="font-medium text-slate-600">• {div.name}</span>
                                            <span className="text-slate-400">
                                              SPV: {spv ? spv.name.split(' ')[0] : "None"}
                                            </span>
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
