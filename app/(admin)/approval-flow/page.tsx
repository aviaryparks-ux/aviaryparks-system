"use client";

import { useState,useEffect } from "react";

import {
 doc,
 setDoc,
 getDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export default function Page(){

 const [department,setDepartment]=useState("");

 const [flow,setFlow]=useState<any[]>([]);

 const roles=[
  "spv",
  "manager",
  "hrd"
 ];

 // ================= LOAD =================

 async function load(){

  if(!department) return;

  const ref = doc(
   db,
   "approval_settings",
   department
  );

  const snap = await getDoc(ref);

  if(snap.exists()){

   setFlow(
    snap.data().flow || []
   );

  }else{

   setFlow([]);

  }

 }

 useEffect(()=>{

  load();

 },[department]);

 // ================= ADD LEVEL =================

 function addLevel(){

  setFlow([

   ...flow,

   {
    role:"spv",
    label:"SPV",
    order:flow.length+1
   }

  ]);

 }

 // ================= UPDATE =================

 function updateRole(i:number,value:string){

  const arr=[...flow];

  arr[i].role=value;

  arr[i].label=value.toUpperCase();

  setFlow(arr);

 }

 // ================= DELETE =================

 function remove(i:number){

  const arr=[...flow];

  arr.splice(i,1);

  setFlow(arr);

 }

 // ================= SAVE =================

 async function save(){

  if(!department){

   alert("department wajib diisi");

   return;

  }

  const ref = doc(
   db,
   "approval_settings",
   department
  );

  await setDoc(

   ref,

   {
    department,
    flow
   }

  );

  alert("flow saved");

 }

 return(

 <div>

 <h1 className="text-2xl font-bold mb-6">

 Approval Flow

 </h1>

 <input

 placeholder="contoh: IT"

 value={department}

 onChange={(e)=>setDepartment(e.target.value)}

 className="border p-2 mb-4"

 />

 {flow.map((f,i)=>(

 <div
 key={i}
 className="flex gap-3 mb-2"
 >

 <span>{i+1}</span>

 <select

 value={f.role}

 onChange={(e)=>

 updateRole(i,e.target.value)

 }

 className="border p-2"
 >

 {roles.map(r=>(

 <option key={r}>

 {r}

 </option>

 ))}

 </select>

 <button

 onClick={()=>remove(i)}

 className="text-red-600"

 >

 hapus

 </button>

 </div>

 ))}

 <button

 onClick={addLevel}

 className="bg-gray-700 text-white px-3 py-2 mr-3"

 >

 tambah level

 </button>

 <button

 onClick={save}

 className="bg-green-600 text-white px-3 py-2"

 >

 simpan

 </button>

 </div>

 );

}