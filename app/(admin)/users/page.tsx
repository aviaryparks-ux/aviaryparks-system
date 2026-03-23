"use client";

import { useEffect,useState } from "react";

import { db,auth,storage } from "@/lib/firebase";

import {

 collection,
 getDocs,
 doc,
 setDoc,
 updateDoc,
 Timestamp

} from "firebase/firestore";

import {

 createUserWithEmailAndPassword,
 sendPasswordResetEmail

} from "firebase/auth";

import {

 ref,
 uploadBytes,
 getDownloadURL

} from "firebase/storage";

export default function UsersPage(){

 const [data,setData] = useState<any[]>([]);

 const [name,setName] = useState("");
 const [email,setEmail] = useState("");
 const [password,setPassword] = useState("");

 const [department,setDepartment] = useState("");
 const [jabatan,setJabatan] = useState("");

 const [dailyRate,setDailyRate] = useState("");

 const [role,setRole] = useState("employee");

 const [company,setCompany] = useState("");
 const [location,setLocation] = useState("");

 const [joinDate,setJoinDate] = useState("");

 const [photo,setPhoto] = useState<File|null>(null);

 const [isActive,setIsActive] = useState(true);

 const [editId,setEditId] = useState<string|null>(null);

 useEffect(()=>{

  loadData();

 },[]);

 // ================= LOAD USERS =================

 const loadData = async()=>{

  const snap = await getDocs(

   collection(db,"users")

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

 // ================= UPLOAD FOTO =================

 const uploadPhoto = async(uid:string)=>{

  if(!photo) return null;

  const storageRef = ref(

   storage,

   "profile/"+uid+".jpg"

  );

  await uploadBytes(

   storageRef,

   photo

  );

  return await getDownloadURL(storageRef);

 };

 // ================= SIMPAN USER =================

 const saveData = async()=>{

  try{

   if(editId){

    await updateDoc(

     doc(db,"users",editId),

     {

      name,

      email,

      department,

      jabatan,

      dailyRate:
       dailyRate
       ? Number(dailyRate)
       : null,

      role,

      company,

      location,

      joinDate,

      isActive

     }

    );

   }else{

    const cred =

    await createUserWithEmailAndPassword(

     auth,

     email,

     password

    );

    const uid = cred.user.uid;

    const photoUrl =

    await uploadPhoto(uid);

    // ================= UID JADI DOC ID =================

    await setDoc(

     doc(db,"users",uid),

     {

      name,

      email,

      department,

      jabatan,

      dailyRate:
       dailyRate
       ? Number(dailyRate)
       : null,

      role,

      company,

      location,

      joinDate,

      photoUrl,

      isActive:true,

      createdAt:Timestamp.now()

     }

    );

   }

   clearForm();

   loadData();

  }catch(e:any){

   alert(e.message);

  }

 };

 // ================= CLEAR FORM =================

 const clearForm = ()=>{

  setName("");

  setEmail("");

  setPassword("");

  setDepartment("");

  setJabatan("");

  setDailyRate("");

  setRole("employee");

  setCompany("");

  setLocation("");

  setJoinDate("");

  setPhoto(null);

  setEditId(null);

 };

 // ================= EDIT =================

 const editData = (u:any)=>{

  setName(u.name || "");

  setEmail(u.email || "");

  setDepartment(u.department || "");

  setJabatan(u.jabatan || "");

  setDailyRate(

   u.dailyRate?.toString() || ""

  );

  setRole(u.role || "employee");

  setCompany(u.company || "");

  setLocation(u.location || "");

  setJoinDate(u.joinDate || "");

  setIsActive(

   u.isActive ?? true

  );

  setEditId(u.id);

 };

 // ================= RESET PASSWORD =================

 const resetPassword = async(email:string)=>{

  await sendPasswordResetEmail(

   auth,

   email

  );

  alert("email reset password terkirim");

 };

 // ================= AKTIF NONAKTIF =================

 const toggleActive = async(u:any)=>{

  await updateDoc(

   doc(db,"users",u.id),

   {

    isActive:!u.isActive

   }

  );

  loadData();

 };

 return(

 <div className="p-6">

 <h1 className="text-2xl font-bold mb-6">

 Data Karyawan

 </h1>

 {/* FORM */}

 <div className="bg-white p-4 rounded shadow mb-6">

 <div className="grid grid-cols-3 gap-3">

 <input

 placeholder="nama"

 value={name}

 onChange={(e)=>setName(e.target.value)}

 className="border p-2"

 />

 <input

 placeholder="email"

 value={email}

 onChange={(e)=>setEmail(e.target.value)}

 className="border p-2"

 />

 {!editId &&

 <input

 type="password"

 placeholder="password awal"

 value={password}

 onChange={(e)=>setPassword(e.target.value)}

 className="border p-2"

 />

 }

 {/* ROLE */}

 <select

 value={role}

 onChange={(e)=>setRole(e.target.value)}

 className="border p-2"

 >

 <option value="employee">

 Employee

 </option>

 <option value="spv">

 SPV

 </option>

 <option value="admin">

 Admin

 </option>

 <option value="hr">

 HR

 </option>

 <option value="super_admin">

 Super Admin

 </option>

 </select>

 {/* DEPARTMENT */}

 <input

 placeholder="department"

 value={department}

 onChange={(e)=>setDepartment(e.target.value)}

 className="border p-2"

 />

 {/* JABATAN */}

 <select

 value={jabatan}

 onChange={(e)=>setJabatan(e.target.value)}

 className="border p-2"

 >

 <option value="">

 pilih jabatan

 </option>

 <option value="Casual">

 Casual

 </option>

 <option value="DW">

 Daily Worker

 </option>

 <option value="Staff">

 Staff

 </option>

 <option value="SPV">

 Supervisor

 </option>

 <option value="Manager">

 Manager

 </option>

 </select>

 {/* DAILY RATE */}

 <input

 placeholder="rate per hari (casual / DW)"

 value={dailyRate}

 onChange={(e)=>setDailyRate(e.target.value)}

 className="border p-2"

 />

 <input

 placeholder="company"

 value={company}

 onChange={(e)=>setCompany(e.target.value)}

 className="border p-2"

 />

 <input

 placeholder="lokasi kerja"

 value={location}

 onChange={(e)=>setLocation(e.target.value)}

 className="border p-2"

 />

 <input

 type="date"

 value={joinDate}

 onChange={(e)=>setJoinDate(e.target.value)}

 className="border p-2"

 />

 <input

 type="file"

 onChange={(e)=>

 setPhoto(

 e.target.files?.[0] || null

 )

 }

 className="border p-2"

 />

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

 <table className="w-full text-sm">

 <thead className="bg-gray-200">

 <tr>

 <th>Foto</th>

 <th>Nama</th>

 <th>Dept</th>

 <th>Jabatan</th>

 <th>Rate</th>

 <th>Role</th>

 <th>Status</th>

 <th>Aksi</th>

 </tr>

 </thead>

 <tbody>

 {data.map((u,i)=>(

 <tr key={i} className="border-b">

 <td className="p-2">

 {u.photoUrl &&

 <img

 src={u.photoUrl}

 className="w-12 h-12 rounded-full"

 />

 }

 </td>

 <td>{u.name}</td>

 <td>{u.department}</td>

 <td>{u.jabatan}</td>

 <td>

 {u.dailyRate
 ? "Rp "+u.dailyRate.toLocaleString()
 : "-"}

 </td>

 <td>{u.role}</td>

 <td>

 {

 u.isActive

 ? "aktif"

 : "nonaktif"

 }

 </td>

 <td className="space-x-2">

 <button

 onClick={()=>editData(u)}

 className="bg-yellow-500 text-white px-2 py-1 rounded"

 >

 edit

 </button>

 <button

 onClick={()=>resetPassword(u.email)}

 className="bg-blue-600 text-white px-2 py-1 rounded"

 >

 reset

 </button>

 <button

 onClick={()=>toggleActive(u)}

 className="bg-red-600 text-white px-2 py-1 rounded"

 >

 aktif/nonaktif

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