"use client";

import { useEffect,useState } from "react";

import {
 collection,
 getDocs
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export default function Page(){

 const [stats,setStats]=useState({

  pendingSpv:0,
  pendingHrd:0,
  approved:0,
  rejected:0

 });

 useEffect(()=>{

  load();

 },[]);

 async function load(){

  const snap=
  await getDocs(

   collection(
    db,
    "attendance_requests"
   )

  );

  let pendingSpv=0;
  let pendingHrd=0;
  let approved=0;
  let rejected=0;

  snap.forEach(d=>{

   const data=d.data();

   if(data.status==="approved")
    approved++;

   else if(data.status==="rejected")
    rejected++;

   else{

    const step=
    data.flowSnapshot?.[
     data.currentStep
    ];

    if(step?.role==="spv")
     pendingSpv++;

    if(step?.role==="hrd")
     pendingHrd++;

   }

  });

  setStats({

   pendingSpv,
   pendingHrd,
   approved,
   rejected

  });

 }

 return(

 <div>

 <h1 className="text-2xl font-bold mb-6">

 Dashboard

 </h1>

 <div className="grid grid-cols-4 gap-4">

 <Card
 title="Pending SPV"
 value={stats.pendingSpv}
 color="bg-yellow-100"
 />

 <Card
 title="Pending HRD"
 value={stats.pendingHrd}
 color="bg-blue-100"
 />

 <Card
 title="Approved"
 value={stats.approved}
 color="bg-green-100"
 />

 <Card
 title="Rejected"
 value={stats.rejected}
 color="bg-red-100"
 />

 </div>

 </div>

 );

}

function Card({
 title,
 value,
 color
}:any){

 return(

 <div
 className={`${color} p-4 rounded shadow`}
 >

 <div className="text-sm">

 {title}

 </div>

 <div className="text-2xl font-bold">

 {value}

 </div>

 </div>

 );

}