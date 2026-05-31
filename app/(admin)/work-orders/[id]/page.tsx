// app/(admin)/work-orders/[id]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, setDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useParams } from "next/navigation";
import {
  WorkOrder,
  getWOStatusLabel,
  getWOPriorityLabel,
  getWOPriorityColor,
  ThreadMessage,
  WorkOrderPhoto
} from "@/types/work-order";
import PhotoUpload from "@/components/mod/PhotoUpload";

export default function WorkOrderDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const woId = params.id as string;

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Thread
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagePhotos, setMessagePhotos] = useState<any[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // SLA countdown
  const [slaCountdown, setSlaCountdown] = useState("");

  // Action Modal State
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionHelpers, setActionHelpers] = useState("");
  const [actionPhotos, setActionPhotos] = useState<any[]>([]);

  useEffect(() => {
    loadWorkOrder();
    loadThread();
  }, [woId]);

  // SLA countdown timer
  useEffect(() => {
    if (!wo || wo.type !== "urgent" || !wo.sla) return;

    const updateCountdown = () => {
      const due = new Date(`${wo.sla!.dueDate}T${wo.sla!.dueTime}`);
      const now = new Date();
      const diff = due.getTime() - now.getTime();

      if (diff <= 0) {
        setSlaCountdown("⚠️ OVERDUE!");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setSlaCountdown(`${hours}h ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [wo]);

  const loadWorkOrder = async () => {
    try {
      const docRef = doc(db, "work_orders", woId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert("Work Order tidak ditemukan!");
        router.push("/work-orders");
        return;
      }

      const data = { id: docSnap.id, ...docSnap.data() } as WorkOrder;
      setWo(data);
    } catch (err) {
      console.error("Error loading WO:", err);
      alert("Gagal memuat Work Order!");
      router.push("/work-orders");
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async () => {
    try {
      const q = query(
        collection(db, "messages"),
        where("conversationId", "==", `wo_${woId}`)
      );
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const msgs: any[] = [];
          snap.forEach(doc => {
            msgs.push({ id: doc.id, ...doc.data() });
          });
          // Sort messages locally by timestamp
          msgs.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
            const timeB = b.timestamp?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
            return timeA - timeB;
          });
          setMessages(msgs);
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      });
      return unsub;
    } catch (err) {
      console.error("Error loading thread:", err);
    }
  };

  const ensureConversationExists = async () => {
    if (!wo) return;
    const convRef = doc(db, "conversations", `wo_${woId}`);
    const convSnap = await getDoc(convRef);
    
    if (!convSnap.exists()) {
      const memberIds = [wo.createdBy];
      const memberNames = [wo.createdByName];
      if (wo.assignedToUser && !memberIds.includes(wo.assignedToUser)) {
        memberIds.push(wo.assignedToUser);
        memberNames.push(wo.assignedToUserName || "PIC");
      }

      await setDoc(convRef, {
        type: "group",
        name: `WO: ${wo.woNumber} - ${wo.title}`,
        createdBy: wo.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberIds,
        memberNames,
        departmentId: wo.assignedToDept,
        isAutoCreated: true,
        admins: [wo.createdBy]
      });
      
      // Update user_conversations
      for (let i = 0; i < memberIds.length; i++) {
        const uid = memberIds[i];
        const uName = memberNames[i];
        await setDoc(doc(db, "user_conversations", uid, "conversations", `wo_${woId}`), {
          conversationId: `wo_${woId}`,
          name: `WO: ${wo.woNumber} - ${wo.title}`,
          isAutoCreated: true,
          joinedAt: new Date(),
          unreadCount: 0,
          isMuted: false,
          isPinned: false
        }, { merge: true });
      }
    } else {
      // If conversation exists but someone new assigned, add them
      const data = convSnap.data();
      const memberIds = data.memberIds || [];
      
      let updates: any = {};
      const expectedName = `WO: ${wo.woNumber} - ${wo.title}`;
      
      if (data.name !== expectedName) {
        updates.name = expectedName;
      }
      
      if (wo.assignedToUser && !memberIds.includes(wo.assignedToUser)) {
        updates.memberIds = [...memberIds, wo.assignedToUser];
        updates.memberNames = [...(data.memberNames || []), wo.assignedToUserName || "PIC"];
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(convRef, updates);
      }

      // Selalu pastikan user yang memuat halaman ini memiliki namanya diupdate di daftar chat-nya
      if (user) {
        await setDoc(doc(db, "user_conversations", user.uid, "conversations", `wo_${woId}`), {
          conversationId: `wo_${woId}`,
          name: expectedName,
          isAutoCreated: true,
          joinedAt: new Date(),
          isMuted: false,
          isPinned: false
        }, { merge: true });
      }
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && messagePhotos.length === 0) || !user) return;

    setSendingMessage(true);
    try {
      await ensureConversationExists();
      
      const msgObj = {
        conversationId: `wo_${woId}`,
        senderId: user.uid,
        senderName: user.name,
        text: newMessage,
        attachments: messagePhotos.map(p => ({
          id: p.id,
          url: p.url,
          name: p.caption || "Image"
        })),
        timestamp: new Date(),
        isSystemMessage: false
      };

      await addDoc(collection(db, "messages"), msgObj);
      
      await updateDoc(doc(db, "conversations", `wo_${woId}`), {
        lastMessage: msgObj,
        updatedAt: new Date()
      });

      setNewMessage("");
      setMessagePhotos([]);
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Gagal mengirim pesan");
    } finally {
      setSendingMessage(false);
    }
  };

  const sendSystemMessage = async (text: string) => {
    try {
      await ensureConversationExists();
      
      const msgObj = {
        conversationId: `wo_${woId}`,
        senderId: "system",
        senderName: "System",
        text,
        timestamp: new Date(),
        isSystemMessage: true
      };

      await addDoc(collection(db, "messages"), msgObj);
      
      await updateDoc(doc(db, "conversations", `wo_${woId}`), {
        lastMessage: msgObj,
        updatedAt: new Date()
      });
    } catch (err) {
      console.error("Error sending system message:", err);
    }
  };

  const openActionModal = (newStatus: string) => {
    setActionType(newStatus);
    setActionNotes("");
    setActionHelpers("");
    setActionPhotos([]);
    setShowActionModal(true);
  };

  const submitAction = async () => {
    if (!wo) return;
    
    // Validate if it's pending (Tunda), notes are required
    if (actionType === "pending" && !actionNotes.trim()) {
      alert("Catatan penundaan wajib diisi!");
      return;
    }

    setUpdatingStatus(true);
    try {
      const updateData: any = {
        status: actionType,
        updatedAt: new Date(),
        updatedBy: user?.uid,
        updatedByName: user?.name
      };

      if (actionType === "in_progress") {
        updateData.assignedToUser = user?.uid;
        updateData.assignedToUserName = user?.name;
      }

      if (actionType === "completed") {
        updateData.completedAt = new Date();
        updateData.completedBy = user?.uid;
        updateData.completedByName = user?.name;
      }

      if (actionNotes.trim()) {
        updateData.actionNotes = actionNotes.trim();
      }

      if (actionHelpers.trim()) {
        // Simple comma separated split for helpers
        updateData.helpers = actionHelpers.split(",").map(h => h.trim()).filter(h => h);
      }

      if (wo.type === "urgent" && actionType === "in_progress" && wo.sla) {
        updateData["sla.acknowledgedBy"] = user?.uid;
        updateData["sla.acknowledgedByName"] = user?.name;
        updateData["sla.acknowledgedAt"] = new Date();
      }
      
      // If photos uploaded, add to wo.photos
      if (actionPhotos.length > 0) {
        const newPhotos = actionPhotos.map(p => ({
          id: p.id,
          url: p.url,
          caption: p.caption || "Foto Eksekusi",
          uploadedBy: user?.uid,
          uploadedByName: user?.name,
          uploadedAt: new Date()
        }));
        updateData.photos = [...(wo.photos || []), ...newPhotos];
      }

      await updateDoc(doc(db, "work_orders", woId), updateData);
      await sendSystemMessage(`Status diubah menjadi: ${getWOStatusLabel(actionType as any)} oleh ${user?.name}${actionNotes ? `\nCatatan: ${actionNotes}` : ""}`);
      
      alert("✅ Status berhasil diupdate!");
      setShowActionModal(false);
      loadWorkOrder();
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Gagal mengupdate status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    // If it's a simple cancel or complete without modal (for admin/approve), we still use this directly.
    // But for actual executor, we want the modal.
    if (newStatus === "cancelled" || newStatus === "open") {
      if (!confirm(`Ubah status ke "${getWOStatusLabel(newStatus as any)}"?`)) return;
      
      setUpdatingStatus(true);
      try {
        const updateData: any = {
          status: newStatus,
          updatedAt: new Date(),
          updatedBy: user?.uid,
          updatedByName: user?.name
        };
        await updateDoc(doc(db, "work_orders", woId), updateData);
        await sendSystemMessage(`Status diubah menjadi: ${getWOStatusLabel(newStatus as any)} oleh ${user?.name}`);
        alert("✅ Status berhasil diupdate!");
        loadWorkOrder();
      } catch (err) {
        console.error("Error updating status:", err);
        alert("Gagal mengupdate status");
      } finally {
        setUpdatingStatus(false);
      }
    } else {
      openActionModal(newStatus);
    }
  };

  const toggleMilestone = async (milestoneId: string, currentStatus: string) => {
    if (!wo) return;

    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    const updatedMilestones = wo.milestones?.map(m =>
      m.id === milestoneId
        ? {
            ...m,
            status: newStatus,
            completedAt: newStatus === "completed" ? new Date() : null,
            completedBy: newStatus === "completed" ? user?.uid : null,
            completedByName: newStatus === "completed" ? user?.name : null
          }
        : m
    );

    try {
      await updateDoc(doc(db, "work_orders", woId), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });
      loadWorkOrder();
    } catch (err) {
      console.error("Error updating milestone:", err);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-red-100 text-red-600";
      case "in_progress": return "bg-yellow-100 text-yellow-600";
      case "pending_approval": return "bg-blue-100 text-blue-600";
      case "completed": return "bg-green-100 text-green-600";
      case "cancelled": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const canEdit = wo && (
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.role === "hr" ||
    wo.createdBy === user?.uid
  );

  const canApprove = wo && (
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.role === "hr" ||
    (user?.role === "spv" && wo.currentApprovalStep === 0) ||
    (user?.role === "manager" && wo.currentApprovalStep === 1)
  );

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager", "employee"]}>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!wo) return null;

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "spv", "manager", "employee"]}>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24">
        {/* Header with Premium Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-8 text-white shadow-2xl shadow-emerald-500/20">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-teal-400/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
          
          <button onClick={() => router.back()} className="absolute left-6 top-6 p-2.5 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition-all duration-300 z-20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="relative z-10 text-center mt-2">
            <div className="flex items-center justify-center gap-3">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wider shadow-sm backdrop-blur-md ${wo.type === "urgent" ? "bg-red-500/20 text-red-50 border border-red-400/30" : "bg-purple-500/20 text-purple-50 border border-purple-400/30"}`}>
                {wo.type === "urgent" ? "⚡ URGENT" : "📁 PROJECT"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight drop-shadow-md">{wo.title}</h1>
            <p className="text-emerald-100/80 mt-2 font-mono text-sm tracking-wider bg-black/10 inline-block px-3 py-1 rounded-lg backdrop-blur-sm border border-white/10">{wo.woNumber}</p>
            {canEdit && wo.status !== "completed" && (
              <div className="mt-6">
                <button 
                  onClick={() => router.push(`/work-orders/${woId}/edit`)}
                  className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-sm font-bold transition-all duration-300 inline-flex items-center gap-2 border border-white/20 shadow-lg hover:-translate-y-0.5"
                >
                  ✏️ Edit Work Order
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta Info Grid */}
        <div className="rounded-3xl bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start flex-wrap gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm ${getStatusColor(wo.status)}`}>
                {getWOStatusLabel(wo.status as any)}
              </span>
              <span className={`px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm ${getWOPriorityColor(wo.priority as any)}`}>
                {getWOPriorityLabel(wo.priority as any)}
              </span>
            </div>
            {wo.source === "mod" && (
              <span className="px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-sm font-bold shadow-sm">
                🔗 Dari MOD
              </span>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4 text-sm relative z-10">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dibuat oleh</p>
              <p className="font-semibold text-slate-800">{wo.createdByName}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dept Tujuan</p>
              <p className="font-semibold text-slate-800">{wo.assignedToDept} {wo.assignedToDivision ? `> ${wo.assignedToDivision}` : ""}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Buat</p>
              <p className="font-semibold text-slate-800">{formatDate(wo.createdAt)}</p>
            </div>
            {wo.locationArea && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi / Area</p>
                <p className="font-semibold text-slate-800">{wo.locationArea}</p>
              </div>
            )}
            {wo.inventoryItem && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Inventory</p>
                <p className="font-semibold text-slate-800">{wo.inventoryItem}</p>
              </div>
            )}
            {wo.assignedToUserName && (
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Dikerjakan Oleh (PIC)</p>
                <p className="font-bold text-blue-700">{wo.assignedToUserName}</p>
              </div>
            )}
            {wo.helpers && wo.helpers.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Petugas Bantuan</p>
                <p className="font-semibold text-slate-800">{wo.helpers.join(", ")}</p>
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tags</p>
              <p className="font-semibold text-slate-800">{wo.tags?.join(", ") || "-"}</p>
            </div>
          </div>
        </div>

        {/* SLA Countdown (Urgent) */}
        {wo.type === "urgent" && wo.sla && (
          <div className={`rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border relative overflow-hidden ${
            wo.sla.isOverdue || slaCountdown === "⚠️ OVERDUE!" 
              ? "bg-gradient-to-br from-red-50 to-white border-red-200" 
              : "bg-gradient-to-br from-amber-50 to-white border-amber-200"
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-bl-full -mr-10 -mt-10 blur-xl"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <h2 className="font-black text-xl flex items-center gap-2 mb-1">
                  ⏱️ <span className="tracking-tight">SLA Target</span>
                </h2>
                <p className="text-sm font-medium text-slate-600 bg-white/60 inline-block px-3 py-1 rounded-lg">
                  Deadline: {new Date(`${wo.sla.dueDate}T${wo.sla.dueTime}`).toLocaleString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>
              <div className={`text-left sm:text-right bg-white/60 p-4 rounded-2xl border border-white/50 backdrop-blur-sm ${wo.sla.isOverdue || slaCountdown === "⚠️ OVERDUE!" ? "text-red-600" : "text-amber-600"}`}>
                <p className="text-4xl sm:text-5xl font-black tracking-tighter">{slaCountdown || "..."}</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Waktu Tersisa</p>
              </div>
            </div>
            {wo.sla.acknowledgedBy && (
              <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                ✅ <span>Diaknowledge oleh <strong>{wo.sla.acknowledgedByName}</strong> pada {formatDate(wo.sla.acknowledgedAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {wo.description && (
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <h2 className="font-extrabold text-xl mb-4 text-slate-800 flex items-center gap-2">📝 <span>Deskripsi Masalah</span></h2>
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{wo.description}</p>
            </div>
          </div>
        )}

        {/* Action Notes (From Technician) */}
        {(wo.actionNotes || wo.actionPhotoUrl) && (
          <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-bl-full -mr-10 -mt-10 blur-xl"></div>
            <h2 className="font-extrabold text-xl mb-4 text-blue-900 flex items-center gap-2 relative z-10">👨‍🔧 <span>Catatan Teknisi (Eksekusi / Penundaan)</span></h2>
            
            {wo.actionNotes && (
              <div className="bg-white/60 p-5 rounded-2xl border border-white/50 backdrop-blur-sm relative z-10 mb-4 shadow-sm">
                <p className="text-blue-900 whitespace-pre-wrap leading-relaxed">{wo.actionNotes}</p>
              </div>
            )}
            
            {wo.actionPhotoUrl && (
              <div className="rounded-2xl overflow-hidden border-2 border-white shadow-md inline-block relative z-10 bg-white p-1">
                <img src={wo.actionPhotoUrl} alt="Action Proof" className="max-w-full md:max-w-md max-h-64 object-contain rounded-xl" />
              </div>
            )}
            
            <p className="text-xs font-bold text-blue-400 mt-4 flex items-center gap-1.5 relative z-10 uppercase tracking-wider">
              <span>Diperbarui oleh:</span> <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md">{wo.updatedByName || "Teknisi"}</span>
            </p>
          </div>
        )}

        {/* Milestones (Project) */}
        {wo.type === "project" && wo.milestones && wo.milestones.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-purple-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>🏁</span>
              <span>Milestones ({wo.milestones.filter(m => m.status === "completed").length}/{wo.milestones.length})</span>
            </h2>
            <div className="space-y-3">
              {wo.milestones.map((m, i) => (
                <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                  m.status === "completed" ? "bg-green-50" : "bg-gray-50"
                }`}>
                  <input
                    type="checkbox"
                    checked={m.status === "completed"}
                    onChange={() => toggleMilestone(m.id, m.status)}
                    disabled={!canEdit}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${m.status === "completed" ? "line-through text-gray-500" : ""}`}>
                      {i + 1}. {m.title}
                    </p>
                    {m.dueDate && (
                      <p className="text-xs text-gray-500">
                        Due: {new Date(m.dueDate).toLocaleDateString("id-ID")}
                        {m.completedAt && ` • Completed: ${formatDate(m.completedAt)}`}
                        {m.completedByName && ` by ${m.completedByName}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget (Project) */}
        {wo.type === "project" && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-green-100">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>💰</span>
              <span>Budget</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <p className="text-sm text-gray-500">Estimated</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(wo.estimatedBudget || 0)}</p>
              </div>
              <div className={`p-4 rounded-xl text-center ${
                (wo.actualBudget || 0) > (wo.estimatedBudget || 0) ? "bg-red-50" : "bg-green-50"
              }`}>
                <p className="text-sm text-gray-500">Actual</p>
                <p className={`text-xl font-bold ${(wo.actualBudget || 0) > (wo.estimatedBudget || 0) ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(wo.actualBudget || 0)}
                </p>
              </div>
            </div>

            {/* Budget items */}
            {wo.budget && wo.budget.length > 0 && (
              <div className="space-y-2">
                {wo.budget.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{b.description}</p>
                      <p className="text-xs text-gray-500">{b.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(b.estimatedCost)}</p>
                      {b.actualCost > 0 && (
                        <p className="text-xs text-gray-500">Actual: {formatCurrency(b.actualCost)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approval Chain (Project) */}
        {wo.type === "project" && wo.approvalSteps && wo.approvalSteps.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-md border border-blue-100">
            <h2 className="font-bold text-lg mb-4">🔐 Approval Chain</h2>
            <div className="space-y-3">
              {wo.approvalSteps.map(step => (
                <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                  step.status === "approved" ? "bg-green-50" :
                  step.status === "rejected" ? "bg-red-50" :
                  step.status === "pending" && step.step <= wo.currentApprovalStep + 1 ? "bg-yellow-50" :
                  "bg-gray-50"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    step.status === "approved" ? "bg-green-500 text-white" :
                    step.status === "rejected" ? "bg-red-500 text-white" :
                    "bg-gray-300 text-gray-700"
                  }`}>
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{step.role === "dept_manager" ? "Dept Manager" : step.role === "finance" ? "Finance" : step.role}</p>
                    {step.approverName && (
                      <p className="text-xs text-gray-500">{step.approverName}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    step.status === "approved" ? "bg-green-100 text-green-700" :
                    step.status === "rejected" ? "bg-red-100 text-red-700" :
                    step.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {step.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Current approver action */}
            {canApprove && wo.status === "pending_approval" && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm font-medium mb-3">Action Required:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange("in_progress")}
                    disabled={updatingStatus}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange("open")}
                    disabled={updatingStatus}
                    className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {wo.photos && wo.photos.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-md border">
            <h2 className="font-bold text-lg mb-4">📷 Foto ({wo.photos.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {wo.photos.map(photo => (
                <div key={photo.id} className="rounded-xl overflow-hidden border">
                  <img src={photo.url} alt="" className="w-full h-40 object-cover" />
                  {photo.caption && (
                    <div className="p-2 text-xs text-gray-600">{photo.caption}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thread/Chat */}
        <div className="rounded-xl bg-white shadow-md border overflow-hidden">
          <div className="bg-gray-50 p-4 border-b">
            <h2 className="font-bold text-lg">💬 Diskusi</h2>
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Belum ada pesan. Mulai diskusi...</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.senderId === user?.uid ? "flex-row-reverse" : ""}`}>
                  <div className={`max-w-[80%] rounded-xl p-3 ${
                    msg.isSystemMessage
                      ? "bg-gray-100 text-gray-600 text-center w-full"
                      : msg.senderId === user?.uid
                        ? "bg-orange-100 text-gray-800"
                        : "bg-gray-100 text-gray-800"
                  }`}>
                    {!msg.isSystemMessage && (
                      <p className="text-xs font-medium text-gray-500 mb-1">{msg.senderName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {msg.attachments.map(att => (
                          <div key={att.id} className="rounded-lg overflow-hidden border border-gray-200">
                            <img src={att.url} alt="" className="w-full h-24 object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === "Enter" && sendMessage()}
                placeholder="Ketik pesan..."
                className="flex-1 border rounded-xl px-4 py-2 text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={sendingMessage || (!newMessage.trim() && messagePhotos.length === 0)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50"
              >
                ➤
              </button>
            </div>
            <div>
              <PhotoUpload 
                photos={messagePhotos} 
                onChange={setMessagePhotos} 
                maxPhotos={3} 
                hideRating={true}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {wo.status !== "completed" && wo.status !== "cancelled" && (
          <div className="rounded-xl bg-white p-5 shadow-md border">
            <h2 className="font-bold text-lg mb-4">⚡ Aksi</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wo.status === "open" && (
                <button
                  onClick={() => handleStatusChange("in_progress")}
                  disabled={updatingStatus}
                  className="py-2 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm"
                >
                  ▶️ Mulai Kerja
                </button>
              )}
              {wo.status === "pending" && (
                <button
                  onClick={() => handleStatusChange("in_progress")}
                  disabled={updatingStatus}
                  className="py-2 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm"
                >
                  ▶️ Lanjutkan Kerja
                </button>
              )}
              {wo.status === "in_progress" && (
                <>
                  <button
                    onClick={() => handleStatusChange("pending")}
                    disabled={updatingStatus}
                    className="py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm"
                  >
                    ⏸️ Tunda Pekerjaan
                  </button>
                  {wo.type === "urgent" && (
                    <button
                      onClick={() => handleStatusChange("completed")}
                      disabled={updatingStatus}
                      className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm"
                    >
                      ✅ Selesai
                    </button>
                  )}
                  {wo.type === "project" && (
                    <button
                      onClick={() => handleStatusChange("pending_approval")}
                      disabled={updatingStatus}
                      className="py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                    >
                      📤 Ajukan Approval
                    </button>
                  )}
                </>
              )}
              {wo.status === "pending_approval" && canApprove && (
                <button
                  onClick={() => handleStatusChange("completed")}
                  disabled={updatingStatus}
                  className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm"
                >
                  ✅ Setujui Selesai
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={updatingStatus}
                  className="py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm"
                >
                  ❌ Batalkan
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Modal */}
        {showActionModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">
                  Konfirmasi: {getWOStatusLabel(actionType as any)}
                </h3>
                <button onClick={() => setShowActionModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Catatan (Opsional) {actionType === "pending" && <span className="text-red-500">* (Wajib)</span>}
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                    rows={3}
                    placeholder="Contoh: Menunggu sparepart / Menambahkan freon AC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Petugas Bantuan (Opsional)</label>
                  <input
                    type="text"
                    value={actionHelpers}
                    onChange={e => setActionHelpers(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="Pisahkan dengan koma (Contoh: Budi, Agus)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Foto Bukti (Opsional)</label>
                  <PhotoUpload
                    photos={actionPhotos}
                    onChange={setActionPhotos}
                    maxPhotos={3}
                    hideRating={true}
                  />
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                <button
                  onClick={() => setShowActionModal(false)}
                  disabled={updatingStatus}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Batal
                </button>
                <button
                  onClick={submitAction}
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {updatingStatus ? "Menyimpan..." : "Simpan & Lanjutkan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back */}
        <button onClick={() => router.push("/work-orders")} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-xl mt-6">
          ← Kembali ke Daftar
        </button>
      </div>
    </ProtectedRoute>
  );
}