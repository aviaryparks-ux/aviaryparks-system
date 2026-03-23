"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  useEffect(()=>{

    const unsub = onAuthStateChanged(auth,(user)=>{

      if(user){

        router.push("/dashboard");

      }else{

        router.push("/login");

      }

    });

    return ()=>unsub();

  },[]);

  return (
    <div className="p-10">
      checking login...
    </div>
  );

}