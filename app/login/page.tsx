"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage(){

  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);

  const login = async()=>{

    setLoading(true);

    try{

      console.log("EMAIL:", email);
      console.log("PASSWORD:", password);

      const res = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      console.log("LOGIN SUCCESS:", res.user.uid);

      const uid = res.user.uid;

      const userDoc = await getDoc(
        doc(db,"users",uid)
      );

      console.log("USER DATA:", userDoc.data());

      if(!userDoc.exists()){

        alert("user tidak ada di firestore");
        setLoading(false);
        return;

      }

      const role = userDoc.data()?.role;

      if(role !== "super_admin"){

        alert("akun bukan super admin");
        setLoading(false);
        return;

      }

      alert("login berhasil");

      router.push("/dashboard");

    }catch(e:any){

      console.log("ERROR LOGIN:");
      console.log(e);
      console.log("CODE:", e.code);
      console.log("MESSAGE:", e.message);

      alert(
        "ERROR:\n" +
        e.code + "\n\n" +
        e.message
      );

    }

    setLoading(false);

  };

  return(

    <div className="h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white p-8 rounded-xl shadow w-[350px]">

        <h1 className="text-xl font-bold mb-6">
          Super Admin Login
        </h1>

        <input
          placeholder="email"
          className="border p-2 w-full mb-3"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          placeholder="password"
          type="password"
          className="border p-2 w-full mb-5"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={login}
          className="bg-blue-600 text-white w-full p-2 rounded"
        >
          {loading ? "loading..." : "login"}
        </button>

      </div>

    </div>

  );

}