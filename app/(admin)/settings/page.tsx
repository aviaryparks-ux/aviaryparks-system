"use client";

import { useEffect,useState } from "react";

import { db } from "@/lib/firebase";

import {

 collection,
 addDoc,
 getDocs,
 doc,
 updateDoc

} from "firebase/firestore";

import dynamic from "next/dynamic";

const MapPicker =
 dynamic(

  ()=>import("@/components/MapPicker"),

  { ssr:false }

 );

export default function SettingsPage(){

 const [data,setData] = useState<any[]>([]);

 const [name,setName] = useState("");
 const [company,setCompany] = useState("");

 const [lat,setLat] = useState("");
 const [lng,setLng] = useState("");

 const [radius,setRadius] = useState("");

 const [address,setAddress] = useState("");

 const [editId,setEditId] = useState<string|null>(null);

 useEffect(()=>{

  loadData();

 },[]);

 const loadData = async()=>{

  const snap =
  await getDocs(

   collection(db,"settings")

  );

  const arr:any[] = [];

  snap.forEach((doc)=>{

   arr.push({

    id:doc.id,
    ...doc.data()

   });

  });

  setData(arr);

 };

 const saveData = async()=>{

  if(editId){

   await updateDoc(

    doc(db,"settings",editId),

    {

     name,
     company,

     lat:Number(lat),
     lng:Number(lng),

     radius:Number(radius),

     address,

     isActive:true

    }

   );

  }else{

   await addDoc(

    collection(db,"settings"),

    {

     name,
     company,

     lat:Number(lat),
     lng:Number(lng),

     radius:Number(radius),

     address,

     isActive:true

    }

   );

  }

  clearForm();

  loadData();

 };

 const clearForm = ()=>{

  setName("");

  setCompany("");

  setLat("");
  setLng("");

  setRadius("");

  setAddress("");

  setEditId(null);

 };

 const editData = (s:any)=>{

  setName(s.name);

  setCompany(s.company);

  setLat(s.lat);

  setLng(s.lng);

  setRadius(s.radius);

  setAddress(s.address);

  setEditId(s.id);

 };

 return(

  <div>

   <h1 className="text-2xl font-bold mb-6">

    Setting Lokasi Absensi

   </h1>

   {/* FORM */}

   <div className="bg-white p-4 rounded shadow mb-6">

    <div className="grid grid-cols-3 gap-3">

     <input
      placeholder="nama lokasi"
      value={name}
      onChange={(e)=>setName(e.target.value)}
      className="border p-2"
     />

     <input
      placeholder="company"
      value={company}
      onChange={(e)=>setCompany(e.target.value)}
      className="border p-2"
     />

     <input
      placeholder="radius meter"
      value={radius}
      onChange={(e)=>setRadius(e.target.value)}
      className="border p-2"
     />

     <input
      placeholder="latitude"
      value={lat}
      onChange={(e)=>setLat(e.target.value)}
      className="border p-2"
     />

     <input
      placeholder="longitude"
      value={lng}
      onChange={(e)=>setLng(e.target.value)}
      className="border p-2"
     />

     <input
      placeholder="alamat"
      value={address}
      onChange={(e)=>setAddress(e.target.value)}
      className="border p-2"
     />

    </div>

    {/* MAP */}

   <div className="mt-4">

 <MapPicker
  setLat={setLat}
  setLng={setLng}
  radius={Number(radius) || 100}
 />

 <p className="text-sm mt-2">

  lingkaran hijau = area absensi

 </p>

</div>

    <button
     onClick={saveData}
     className="bg-blue-600 text-white px-4 py-2 rounded mt-3"
    >

     {editId ? "update" : "simpan"}

    </button>

   </div>

   {/* TABLE */}

   <div className="bg-white rounded shadow">

    <table className="w-full">

     <thead className="bg-gray-200">

      <tr>

       <th>Lokasi</th>

       <th>Company</th>

       <th>Radius</th>

       <th>Lat</th>

       <th>Lng</th>

       <th>Aksi</th>

      </tr>

     </thead>

     <tbody>

      {data.map((s,i)=>(

       <tr key={i} className="border-b">

        <td className="p-3">

         {s.name}

        </td>

        <td>

         {s.company}

        </td>

        <td>

         {s.radius} m

        </td>

        <td>

         {s.lat}

        </td>

        <td>

         {s.lng}

        </td>

        <td>

         <button
          onClick={()=>editData(s)}
          className="bg-yellow-500 text-white px-3 py-1 rounded"
         >

          edit

         </button>

        </td>

       </tr>

      ))}

     </tbody>

    </table>

   </div>

  </div>

 );
}