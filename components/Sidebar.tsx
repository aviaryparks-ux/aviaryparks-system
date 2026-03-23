"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar(){

 const pathname = usePathname();

 const menu=[

  {name:"Dashboard",path:"/dashboard"},

  {name:"Attendance",path:"/attendance"},

  {name:"Attendance Corrections",path:"/attendance-corrections"},

  {name:"Users",path:"/users"},

  {name:"Settings Lokasi",path:"/settings"},

  {name:"Approval Flow",path:"/approval-flow"}

 ];

 return(

 <div className="w-64 bg-gray-900 text-white min-h-screen p-6">

 <h1 className="text-xl font-bold mb-8">

 WEB ADMIN

 </h1>

 <div className="flex flex-col gap-2">

 {menu.map(m=>(

 <Link

 key={m.path}

 href={m.path}

 className={`p-2 rounded ${
 pathname===m.path
  ? "bg-green-600"
  : "hover:bg-gray-700"
 }`}

 >

 {m.name}

 </Link>

 ))}

 </div>

 </div>

 );

}