"use client";

import Sidebar from "@/components/Sidebar";

export default function AdminLayout({
 children,
}:{
 children:React.ReactNode;
}){

 return(

  <div className="flex">

   <Sidebar/>

   <div className="p-10 bg-gray-100 min-h-screen w-full">

    {children}

   </div>

  </div>

 );

}