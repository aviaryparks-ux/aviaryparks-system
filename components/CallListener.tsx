"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CallListener() {
  const { user } = useAuth();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "active_calls"),
      where("receiverIds", "array-contains", user.uid),
      where("status", "==", "ringing")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Assume only 1 incoming call at a time
        const callDoc = snapshot.docs[0];
        setIncomingCall({
          id: callDoc.id, // This is usually the conversationId
          ...callDoc.data()
        });
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async () => {
    if (!incomingCall) return;
    
    try {
      await updateDoc(doc(db, "active_calls", incomingCall.id), {
        status: "accepted"
      });
      // Redirect to the chat room where the call UI will be rendered
      router.push(`/chat/${incomingCall.id}?autoJoin=true`);
      setIncomingCall(null);
    } catch (e) {
      console.error("Failed to accept call:", e);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    
    try {
      await updateDoc(doc(db, "active_calls", incomingCall.id), {
        status: "declined"
      });
      setIncomingCall(null);
    } catch (e) {
      console.error("Failed to decline call:", e);
    }
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border border-slate-700 animate-in fade-in zoom-in duration-300">
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-white font-bold">
            {incomingCall.callerName ? incomingCall.callerName[0].toUpperCase() : "?"}
          </span>
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">{incomingCall.callerName || "Unknown"}</h3>
        <p className="text-emerald-400 font-medium mb-8 flex items-center justify-center gap-2">
          {incomingCall.isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          Panggilan Masuk...
        </p>
        
        <div className="flex items-center justify-center gap-8">
          <button 
            onClick={handleDecline}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>
          
          <button 
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 animate-pulse"
          >
            <Phone className="w-8 h-8 text-white fill-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
