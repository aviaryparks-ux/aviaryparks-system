"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

import {

 collection,
 onSnapshot,
 orderBy,
 query,
 doc,
 updateDoc,
 Timestamp,
 getDoc,
 setDoc

} from "firebase/firestore";

type Request = {

 id:string;

 uid:string;

 name:string;

 date:any;

 checkIn?:string;

 checkOut?:string;

 reason:string;

 status:string;

};

export default function AttendanceCorrectionsPage(){

 const [data,setData]=useState<Request[]>([]);

 useEffect(()=>{

  const q=query(

   collection(db,"attendance_requests"),

   orderBy("createdAt","desc")

  );

  const unsub=onSnapshot(q,(snap)=>{

   const arr:any[]=[];

   snap.forEach(doc=>{

    arr.push({

     id:doc.id,

     ...doc.data()

    });

   });

   setData(arr);

  });

  return ()=>unsub();

 },[]);

 function formatDate(ts:any){

  if(!ts) return "-";

  const d=ts.toDate();

  return d.toLocaleDateString("id-ID",{

   day:"2-digit",

   month:"short",

   year:"numeric"

  });

 }

 async function approve(r:Request){

  try{

   const dateObj=r.date.toDate();

   const yyyy=dateObj.getFullYear();

   const mm=(dateObj.getMonth()+1)

    .toString()

    .padStart(2,"0");

   const dd=dateObj

    .getDate()

    .toString()

    .padStart(2,"0");

   const docId=`${r.uid}_${yyyy}-${mm}-${dd}`;

   const attendanceRef=

    doc(db,"attendance",docId);

   const snap=

    await getDoc(attendanceRef);

   const updateData:any={};

   if(r.checkIn){

    const [h,m]=r.checkIn.split(":");

    updateData["checkIn.time"]=Timestamp.fromDate(

     new Date(

      yyyy,

      mm-1,

      dd,

      parseInt(h),

      parseInt(m)

     )

    );

   }

   if(r.checkOut){

    const [h,m]=r.checkOut.split(":");

    updateData["checkOut.time"]=Timestamp.fromDate(

     new Date(

      yyyy,

      mm-1,

      dd,

      parseInt(h),

      parseInt(m)

     )

    );

   }

   if(!snap.exists()){

    await setDoc(attendanceRef,{

     uid:r.uid,

     name:r.name,

     date:r.date,

     createdAt:Timestamp.now()

    });

   }

   await updateDoc(attendanceRef,updateData);

   await updateDoc(

    doc(db,"attendance_requests",r.id),

    {

     status:"approved"

    }

   );

   alert("approved");

  }

  catch(e){

   alert(e);

  }

 }

 async function reject(id:string){

  await updateDoc(

   doc(db,"attendance_requests",id),

   {

    status:"rejected"

   }

  );

 }

 return(

 <div className="p-6">

 <h1 className="text-2xl font-bold mb-6">

 Attendance Corrections

 </h1>

 <div className="overflow-auto border rounded-lg">

 <table className="min-w-full text-sm">

 <thead className="bg-gray-100">

 <tr>

 <th className="p-3">Nama</th>

 <th className="p-3">Tanggal</th>

 <th className="p-3">Jam</th>

 <th className="p-3">Alasan</th>

 <th className="p-3">Status</th>

 <th className="p-3">Action</th>

 </tr>

 </thead>

 <tbody>

 {data.map(r=>(

 <tr key={r.id} className="border-t">

 <td className="p-3">

 {r.name}

 </td>

 <td className="p-3">

 {formatDate(r.date)}

 </td>

 <td className="p-3">

 {r.checkIn ?? "--"} - {r.checkOut ?? "--"}

 </td>

 <td className="p-3">

 {r.reason}

 </td>

 <td className="p-3">

 <span className={`px-2 py-1 rounded

 ${

  r.status==="approved"

  &&"bg-green-100 text-green-700"

 }

 ${

  r.status==="rejected"

  &&"bg-red-100 text-red-700"

 }

 ${

  r.status==="pending"

  &&"bg-yellow-100 text-yellow-700"

 }

 `}>

 {r.status}

 </span>

 </td>

 <td className="p-3 flex gap-2">

 {r.status==="pending" &&(

 <>

 <button

 onClick={()=>approve(r)}

 className="px-3 py-1 rounded bg-green-600 text-white"

 >

 approve

 </button>

 <button

 onClick={()=>reject(r.id)}

 className="px-3 py-1 rounded bg-red-600 text-white"

 >

 reject

 </button>

 </>

 )}

 </td>

 </tr>

 ))}

 </tbody>

 </table>

 </div>

 </div>

 );

}