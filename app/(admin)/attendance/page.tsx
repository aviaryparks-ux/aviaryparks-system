"use client";

import { useEffect,useState } from "react";

import { db } from "@/lib/firebase";

import {

 collection,
 onSnapshot

} from "firebase/firestore";

import * as XLSX from "xlsx";

import jsPDF from "jspdf";

import autoTable from "jspdf-autotable";

type Attendance={

 id:string;

 uid:string;

 name:string;

 department?:string;

 jabatan?:string;

 dailyRate?:number;

 date:any;

 checkIn?:any;

 checkOut?:any;

 workHours?:string;

};

export default function AttendancePage(){

 const [data,setData]=useState<Attendance[]>([]);

 const [users,setUsers]=useState<any>({});

 // ================= TEMP FILTER =================

 const [tempDept,setTempDept]=useState("ALL");

 const [tempJabatan,setTempJabatan]=useState("ALL");

 const [tempEmployee,setTempEmployee]=useState("ALL");

 const [tempStartDate,setTempStartDate]=useState("");

 const [tempEndDate,setTempEndDate]=useState("");

 // ================= ACTIVE FILTER =================

 const [dept,setDept]=useState("ALL");

 const [jabatan,setJabatan]=useState("ALL");

 const [employee,setEmployee]=useState("ALL");

 const [startDate,setStartDate]=useState("");

 const [endDate,setEndDate]=useState("");

 // ================= LOAD USERS =================

 useEffect(()=>{

  const unsub=onSnapshot(

   collection(db,"users"),

   snap=>{

    const obj:any={};

    snap.forEach(doc=>{

     obj[doc.id]=doc.data();

    });

    setUsers(obj);

   }

  );

  return()=>unsub();

 },[]);

 // ================= LOAD ATTENDANCE =================

 useEffect(()=>{

  const unsub=onSnapshot(

   collection(db,"attendance"),

   snap=>{

    const arr:any[]=[];

    snap.forEach(doc=>{

     const d=doc.data();

     const user=users[d.uid] || {};

     arr.push({

      id:doc.id,

      ...d,

      department:user.department || "-",

      jabatan:user.jabatan || "-",

      dailyRate:user.dailyRate || 0

     });

    });

    setData(arr);

   });

  return()=>unsub();

 },[users]);

 // ================= FORMAT =================

 function formatDate(ts:any){

  if(!ts) return "-";

  return ts.toDate().toLocaleDateString("id-ID");

 }

 function formatTime(ts:any){

  if(!ts) return "--:--";

  return ts.toDate().toLocaleTimeString("id-ID",{

   hour:"2-digit",

   minute:"2-digit"

  });

 }

 // ================= NORMALIZE DATE =================

 function onlyDate(d:Date){

  return new Date(

   d.getFullYear(),

   d.getMonth(),

   d.getDate()

  );

 }

 // ================= PERIODE 26-25 =================

 function setPayrollPeriod(){

  const now=new Date();

  let start,end;

  if(now.getDate()>=26){

   start=new Date(

    now.getFullYear(),

    now.getMonth(),

    26

   );

   end=new Date(

    now.getFullYear(),

    now.getMonth()+1,

    25

   );

  }else{

   start=new Date(

    now.getFullYear(),

    now.getMonth()-1,

    26

   );

   end=new Date(

    now.getFullYear(),

    now.getMonth(),

    25

   );

  }

  setTempStartDate(

   start.toISOString().split("T")[0]

  );

  setTempEndDate(

   end.toISOString().split("T")[0]

  );

 }

 // ================= APPLY FILTER =================

 function applyFilter(){

  setDept(tempDept);

  setJabatan(tempJabatan);

  setEmployee(tempEmployee);

  setStartDate(tempStartDate);

  setEndDate(tempEndDate);

 }

 function resetFilter(){

  setTempDept("ALL");

  setTempJabatan("ALL");

  setTempEmployee("ALL");

  setTempStartDate("");

  setTempEndDate("");

  setDept("ALL");

  setJabatan("ALL");

  setEmployee("ALL");

  setStartDate("");

  setEndDate("");

 }

 // ================= FILTER =================

 const filtered=data.filter(a=>{

  let ok=true;

  if(dept!="ALL")

   ok=ok && a.department===dept;

  if(jabatan!="ALL")

   ok=ok && a.jabatan===jabatan;

  if(employee!="ALL")

   ok=ok && a.uid===employee;

  if(startDate)

   ok=ok &&

   onlyDate(a.date.toDate())

   >= onlyDate(new Date(startDate));

  if(endDate)

   ok=ok &&

   onlyDate(a.date.toDate())

   <= onlyDate(new Date(endDate));

  return ok;

 });

 // ================= LIST FILTER =================

 const deptList=[

  "ALL",

  ...new Set(

   Object.values(users)

   .map((u:any)=>u.department)

   .filter(Boolean)

  )

 ];

 const jabatanList=[

  "ALL",

  ...new Set(

   Object.values(users)

   .map((u:any)=>u.jabatan)

   .filter(Boolean)

  )

 ];

 const employeeList=[

  "ALL",

  ...new Set(data.map(a=>a.uid))

 ];

 // ================= REKAP =================

 const recap:any={};

 filtered.forEach(a=>{

  if(!recap[a.uid]){

   recap[a.uid]={

    name:a.name,

    department:a.department,

    jabatan:a.jabatan,

    rate:a.dailyRate,

    totalHari:0,

    totalGaji:0

   };

  }

  if(a.checkIn){

   recap[a.uid].totalHari++;

  }

  recap[a.uid].totalGaji=

   recap[a.uid].totalHari *

   (a.dailyRate || 0);

 });

 const recapList=Object.values(recap);

 // ================= EXPORT DETAIL =================

 function exportDetailExcel(){

  const rows=filtered.map(a=>({

   nama:a.name,

   department:a.department,

   jabatan:a.jabatan,

   tanggal:formatDate(a.date),

   masuk:formatTime(a.checkIn?.time),

   pulang:formatTime(a.checkOut?.time),

   jamKerja:a.workHours

  }));

  const ws=XLSX.utils.json_to_sheet(rows);

  const wb=XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb,ws,"detail");

  XLSX.writeFile(wb,"attendance_detail.xlsx");

 }

 function exportDetailPDF(){

  const doc=new jsPDF();

  autoTable(doc,{

   head:[[

    "Nama",

    "Dept",

    "Jabatan",

    "Tanggal",

    "Masuk",

    "Pulang",

    "Jam Kerja"

   ]],

   body:filtered.map(a=>([

    a.name,

    a.department,

    a.jabatan,

    formatDate(a.date),

    formatTime(a.checkIn?.time),

    formatTime(a.checkOut?.time),

    a.workHours

   ]))

  });

  doc.save("attendance_detail.pdf");

 }

 // ================= EXPORT REKAP =================

 function exportRecapExcel(){

  const ws=XLSX.utils.json_to_sheet(recapList);

  const wb=XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb,ws,"rekap");

  XLSX.writeFile(wb,"attendance_rekap.xlsx");

 }

 function exportRecapPDF(){

  const doc=new jsPDF();

  autoTable(doc,{

   head:[[

    "Nama",

    "Dept",

    "Jabatan",

    "Hari",

    "Rate",

    "Total"

   ]],

   body:recapList.map((r:any)=>([

    r.name,

    r.department,

    r.jabatan,

    r.totalHari,

    r.rate,

    r.totalGaji

   ]))

  });

  doc.save("attendance_rekap.pdf");

 }

 return(

 <div className="p-6">

 <h1 className="text-2xl font-bold mb-6">

 Attendance

 </h1>

 {/* FILTER */}

 <div className="flex gap-2 mb-4 flex-wrap">

 <select

 value={tempDept}

 onChange={(e)=>setTempDept(e.target.value)}

 className="border p-2"

 >

 {deptList.map(d=>(

 <option key={d}>{d}</option>

 ))}

 </select>

 <select

 value={tempJabatan}

 onChange={(e)=>setTempJabatan(e.target.value)}

 className="border p-2"

 >

 {jabatanList.map(j=>(

 <option key={j}>{j}</option>

 ))}

 </select>

 <select

 value={tempEmployee}

 onChange={(e)=>setTempEmployee(e.target.value)}

 className="border p-2"

 >

 <option value="ALL">

 semua karyawan

 </option>

 {employeeList.map(uid=>(

 uid!="ALL" &&

 <option key={uid} value={uid}>

 {users[uid]?.name}

 </option>

 ))}

 </select>

 <input

 type="date"

 value={tempStartDate}

 onChange={(e)=>setTempStartDate(e.target.value)}

 className="border p-2"

 />

 <input

 type="date"

 value={tempEndDate}

 onChange={(e)=>setTempEndDate(e.target.value)}

 className="border p-2"

 />

 <button

 onClick={setPayrollPeriod}

 className="bg-indigo-600 text-white px-3 py-2 rounded"

 >

 periode 26-25

 </button>

 <button

 onClick={applyFilter}

 className="bg-green-600 text-white px-3 py-2 rounded"

 >

 tampilkan

 </button>

 <button

 onClick={resetFilter}

 className="bg-gray-500 text-white px-3 py-2 rounded"

 >

 reset

 </button>

 </div>

 {/* EXPORT */}

 <div className="flex gap-2 mb-6 flex-wrap">

 <button

 onClick={exportDetailExcel}

 className="bg-green-600 text-white px-3 py-2 rounded"

 >

 export detail excel

 </button>

 <button

 onClick={exportDetailPDF}

 className="bg-red-600 text-white px-3 py-2 rounded"

 >

 export detail pdf

 </button>

 <button

 onClick={exportRecapExcel}

 className="bg-blue-600 text-white px-3 py-2 rounded"

 >

 export rekap excel

 </button>

 <button

 onClick={exportRecapPDF}

 className="bg-purple-600 text-white px-3 py-2 rounded"

 >

 export rekap pdf

 </button>

 </div>

 {/* TABLE DETAIL */}

 <div className="overflow-auto border mb-8">

 <table className="w-full text-sm">

 <thead className="bg-gray-100">

 <tr>

 <th>Nama</th>

 <th>Dept</th>

 <th>Jabatan</th>

 <th>Tanggal</th>

 <th>Masuk</th>

 <th>Pulang</th>

 <th>Jam Kerja</th>

 </tr>

 </thead>

 <tbody>

 {filtered.map(a=>(

 <tr key={a.id} className="border-b">

 <td>{a.name}</td>

 <td>{a.department}</td>

 <td>{a.jabatan}</td>

 <td>{formatDate(a.date)}</td>

 <td>{formatTime(a.checkIn?.time)}</td>

 <td>{formatTime(a.checkOut?.time)}</td>

 <td>{a.workHours || "-"}</td>

 </tr>

 ))}

 </tbody>

 </table>

 {filtered.length==0 &&

 <div className="p-4 text-gray-500">

 tidak ada data

 </div>

 }

 </div>

 {/* TABLE REKAP */}

 <h2 className="text-lg font-bold mb-2">

 Rekap Gaji Casual / DW

 </h2>

 <div className="overflow-auto border">

 <table className="w-full text-sm">

 <thead className="bg-gray-100">

 <tr>

 <th>Nama</th>

 <th>Dept</th>

 <th>Jabatan</th>

 <th>Hari Kerja</th>

 <th>Rate</th>

 <th>Total Gaji</th>

 </tr>

 </thead>

 <tbody>

 {recapList.map((r:any)=>(

 <tr key={r.name} className="border-b">

 <td>{r.name}</td>

 <td>{r.department}</td>

 <td>{r.jabatan}</td>

 <td>{r.totalHari}</td>

 <td>

 Rp {r.rate?.toLocaleString()}

 </td>

 <td>

 Rp {r.totalGaji?.toLocaleString()}

 </td>

 </tr>

 ))}

 </tbody>

 </table>

 </div>

 </div>

 );

}