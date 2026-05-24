"use client";

import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Users, Crown, Building2, Briefcase, UserCheck, Shield, UsersRound, ChevronDown, ChevronUp } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";

// Types
type User = {
  uid: string;
  name: string;
  role: string;
  department?: string;
  section?: string;
  division?: string;
  jabatan?: string;
  photoUrl?: string;
};

type DepartmentData = {
  id: string;
  name: string;
  hodUid?: string;
  sections?: {
    name: string;
    managerUid?: string;
    divisions?: {
      name: string;
      spvUid?: string;
    }[];
  }[];
};

// TreeNode Component
const TreeNode = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  colorClass, 
  children,
  count,
  isCollapsed = false,
  onToggle,
  photoUrl
}: any) => {
  return (
    <div className="flex flex-col items-center">
      <div 
        className={`relative z-10 bg-white rounded-2xl p-4 min-w-[220px] max-w-[250px] shadow-sm border border-slate-200 
          hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 
          ${onToggle ? 'cursor-pointer' : ''}`}
        onClick={onToggle}
      >
        <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl ${colorClass}`} />
        <div className="flex flex-col items-center text-center mt-1">
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={title} 
              className={`w-10 h-10 rounded-full object-cover mb-3 shadow-sm border-2 ${colorClass.split(' ')[0].replace('bg-', 'border-')}`}
            />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${colorClass} bg-opacity-10 text-current`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          <p className="text-xs text-slate-500 mt-1 mb-2 line-clamp-2">{subtitle}</p>
          
          {count !== undefined && count > 0 && (
            <div className="mt-2 bg-slate-50 border border-slate-100 rounded-full px-3 py-1 flex items-center gap-1.5">
              <UsersRound className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">{count} Staff</span>
            </div>
          )}
          
          {onToggle && (
            <button className="mt-2 text-slate-400 hover:text-slate-600 transition-colors">
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && children && (
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-slate-300" />
          <div className="relative flex justify-center">
            {/* The horizontal connecting line */}
            <div className="absolute top-0 w-[calc(100%-50%)] h-px bg-slate-300" 
                 style={{ 
                   width: children.length > 1 ? `calc(100% - ${100 / children.length}%)` : '0px'
                 }} 
            />
            <div className="flex gap-8 px-4 pt-8 relative">
              {children.map((child: any, idx: number) => (
                <div key={idx} className="relative flex flex-col items-center">
                  <div className="absolute -top-8 w-px h-8 bg-slate-300" />
                  {child}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default function OrgChartPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch active users
      const usersSnap = await getDocs(query(collection(db, "users"), where("isActive", "==", true)));
      const usersData = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(usersData);

      // Fetch departments
      const deptsSnap = await getDocs(collection(db, "departments"));
      const deptsData = deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentData));
      setDepartments(deptsData);

    } catch (error) {
      console.error("Error fetching org chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Process hierarchy data
  const boardUsers = users.filter(u => ["owner", "gm"].includes(u.role));
  
  const getUser = (uid?: string) => users.find(u => u.uid === uid);
  
  const getStaffCount = (deptName: string, sectionName?: string, divisionName?: string) => {
    return users.filter(u => {
      const isStaffOrAdmin = ["staff", "admin"].includes(u.role);
      const isDept = u.department?.toLowerCase() === deptName?.toLowerCase();
      const isSec = sectionName ? u.section?.toLowerCase() === sectionName?.toLowerCase() : true;
      const isDiv = divisionName ? u.division?.toLowerCase() === divisionName?.toLowerCase() : true;
      return isStaffOrAdmin && isDept && isSec && isDiv;
    }).length;
  };

  const getAdmins = (deptName: string) => {
    return users.filter(u => 
      u.department?.toLowerCase() === deptName?.toLowerCase() && 
      (u.role === "admin" || (u.jabatan && u.jabatan.toLowerCase().includes("admin")))
    );
  };

  // Drag to scroll logic
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  if (loading) return <LoadingScreen />;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "owner", "gm", "hod", "manager", "spv"]}>
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto">
          
          <div className="mb-10 text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Struktur Organisasi</h1>
            <p className="text-slate-500 mt-2">Bagan hierarki perusahaan berdasarkan departemen</p>
          </div>

          <div 
            ref={scrollRef}
            className={`overflow-x-auto pb-12 w-full custom-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            <div className="min-w-max p-4 flex flex-col items-center select-none">
              
              {/* LEVEL 1: Board of Directors */}
              <div className="flex gap-6 mb-8 justify-center">
                {boardUsers.map((board) => (
                  <div key={board.uid} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 shadow-xl text-white text-center min-w-[240px] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Crown className="w-20 h-20" />
                    </div>
                    <div className="relative z-10">
                      {board.photoUrl ? (
                        <img 
                          src={board.photoUrl} 
                          alt={board.name} 
                          className="w-14 h-14 rounded-full object-cover mx-auto mb-3 shadow-md border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/20">
                          <Crown className="w-6 h-6 text-yellow-400" />
                        </div>
                      )}
                      <h3 className="font-bold text-lg">{board.name}</h3>
                      <p className="text-slate-300 text-sm font-medium">{board.jabatan || board.role.toUpperCase()}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Connecting Line from Board to Departments */}
              {boardUsers.length > 0 && departments.length > 0 && (
                <div className="w-px h-12 bg-slate-300" />
              )}

              {/* LEVEL 2: Departments */}
              <div className="relative flex justify-center">
                {/* Horizontal line connecting departments */}
                <div className="absolute top-0 h-px bg-slate-300" 
                     style={{ 
                       width: departments.length > 1 ? `calc(100% - ${100 / departments.length}%)` : '0px'
                     }} 
                />
                
                <div className="flex gap-12 pt-8 relative">
                  {departments.map((dept, deptIdx) => {
                    const hod = getUser(dept.hodUid);
                    const admins = getAdmins(dept.name);
                    const isDeptCollapsed = collapsedNodes[`dept-${dept.id}`];

                    return (
                      <div key={dept.id} className="relative flex flex-col items-center">
                        <div className="absolute -top-8 w-px h-8 bg-slate-300" />
                        
                        <TreeNode
                          title={hod ? hod.name : "Posisi Kosong"}
                          subtitle={`HOD - ${dept.name}`}
                          icon={Building2}
                          colorClass="bg-blue-500 text-blue-600"
                          isCollapsed={isDeptCollapsed}
                          onToggle={() => toggleNode(`dept-${dept.id}`)}
                          photoUrl={hod?.photoUrl}
                        >
                          {/* Admin Nodes */}
                          {admins.length > 0 ? (
                            admins.map(admin => (
                              <TreeNode
                                key={admin.uid}
                                title={admin.name}
                                subtitle={admin.jabatan || "Admin Departemen"}
                                icon={Shield}
                                colorClass="bg-indigo-500 text-indigo-600"
                                photoUrl={admin?.photoUrl}
                              />
                            ))
                          ) : (
                            <TreeNode
                              key={`empty-admin-${dept.id}`}
                              title="Posisi Kosong"
                              subtitle="Admin Departemen"
                              icon={Shield}
                              colorClass="bg-indigo-500 text-indigo-600"
                            />
                          )}

                          {/* Section Nodes */}
                          {dept.sections?.map((sec, secIdx) => {
                            const manager = getUser(sec.managerUid);
                            const isSecCollapsed = collapsedNodes[`sec-${dept.id}-${secIdx}`];

                            return (
                              <TreeNode
                                key={secIdx}
                                title={manager ? manager.name : "Posisi Kosong"}
                                subtitle={`Manager - ${sec.name}`}
                                icon={Briefcase}
                                colorClass="bg-emerald-500 text-emerald-600"
                                isCollapsed={isSecCollapsed}
                                onToggle={() => toggleNode(`sec-${dept.id}-${secIdx}`)}
                                photoUrl={manager?.photoUrl}
                              >
                                {/* Division Nodes */}
                                {sec.divisions?.map((div, divIdx) => {
                                  const spv = getUser(div.spvUid);
                                  const staffCount = getStaffCount(dept.name, sec.name, div.name);

                                  return (
                                    <TreeNode
                                      key={divIdx}
                                      title={spv ? spv.name : "Posisi Kosong"}
                                      subtitle={`SPV - ${div.name}`}
                                      icon={UserCheck}
                                      colorClass="bg-amber-500 text-amber-600"
                                      count={staffCount}
                                      photoUrl={spv?.photoUrl}
                                    />
                                  );
                                })}
                              </TreeNode>
                            );
                          })}
                        </TreeNode>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
