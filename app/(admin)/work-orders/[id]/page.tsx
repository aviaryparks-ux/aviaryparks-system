// app/(admin)/work-orders/[id]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, setDoc, onSnapshot, query, where, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter, useParams } from "next/navigation";
import {
  WorkOrder,
  getWOStatusLabel,
  getWOPriorityLabel,
  getWOPriorityColor,
  getWOStatusColor,
  ThreadMessage,
  WorkOrderPhoto
} from "@/types/work-order";
import PhotoUpload from "@/components/mod/PhotoUpload";
import TransparentSignature from "@/components/ui/TransparentSignature";

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
  const [responseCountdown, setResponseCountdown] = useState("");
  const [resolutionCountdown, setResolutionCountdown] = useState("");

  // Action Modal State
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionHelpers, setActionHelpers] = useState("");
  const [actionPhotos, setActionPhotos] = useState<any[]>([]);

  // Approve Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveIsReject, setApproveIsReject] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  useEffect(() => {
    loadWorkOrder();
    loadThread();
  }, [woId]);

  // SLA countdown timer
  useEffect(() => {
    if (!wo || wo.type !== "urgent" || !wo.sla) return;

    const updateCountdown = () => {
      const now = new Date();
      
      // Legacy or Resolution SLA
      const resDate = wo.sla!.resolutionDueDate || wo.sla!.dueDate;
      const resTime = wo.sla!.resolutionDueTime || wo.sla!.dueTime;
      if (resDate && resTime) {
        if (wo.sla!.resolutionCompletedAt || wo.sla!.completedAt) {
          setResolutionCountdown("✅ SELESAI");
        } else if (wo.status === "pending") {
          setResolutionCountdown("⏸️ DITUNDA");
        } else {
          const due = new Date(`${resDate}T${resTime}`);
          const diff = due.getTime() - now.getTime();
          if (diff <= 0) {
            setResolutionCountdown("⚠️ OVERDUE!");
          } else {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setResolutionCountdown(`${hours}h ${minutes}m`);
          }
        }
      }

      // Response SLA
      const respDate = wo.sla!.responseDueDate;
      const respTime = wo.sla!.responseDueTime;
      if (respDate && respTime) {
        if (wo.sla!.responseAcknowledgedAt || wo.sla!.acknowledgedAt) {
          setResponseCountdown("✅ DIRESPONS");
        } else {
          const due = new Date(`${respDate}T${respTime}`);
          const diff = due.getTime() - now.getTime();
          if (diff <= 0) {
            setResponseCountdown("⚠️ OVERDUE!");
          } else {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setResponseCountdown(`${hours}h ${minutes}m`);
          }
        }
      }
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

      if (wo.type === "urgent" && wo.sla) {
        if (actionType === "pending") {
          updateData["sla.pauseStartedAt"] = new Date();
        }
        
        if (actionType === "in_progress") {
          updateData["sla.acknowledgedBy"] = user?.uid;
          updateData["sla.acknowledgedByName"] = user?.name;
          updateData["sla.acknowledgedAt"] = new Date();
          if (!wo.sla.responseAcknowledgedAt) {
            updateData["sla.responseAcknowledgedAt"] = new Date();
          }
          
          // Handle unpausing
          if (wo.sla.pauseStartedAt) {
            const pauseStart = wo.sla.pauseStartedAt?.toDate ? wo.sla.pauseStartedAt.toDate() : new Date(wo.sla.pauseStartedAt);
            const now = new Date();
            const pausedMinutes = Math.round((now.getTime() - pauseStart.getTime()) / 60000);
            
            updateData["sla.totalPausedMinutes"] = (wo.sla.totalPausedMinutes || 0) + pausedMinutes;
            updateData["sla.pauseStartedAt"] = null;

            // Extend the resolution deadline
            if (wo.sla.resolutionDueDate && wo.sla.resolutionDueTime) {
              const currentDeadline = new Date(`${wo.sla.resolutionDueDate}T${wo.sla.resolutionDueTime}`);
              currentDeadline.setMinutes(currentDeadline.getMinutes() + pausedMinutes);
              
              const year = currentDeadline.getFullYear();
              const month = String(currentDeadline.getMonth() + 1).padStart(2, '0');
              const day = String(currentDeadline.getDate()).padStart(2, '0');
              updateData["sla.resolutionDueDate"] = `${year}-${month}-${day}`;
              updateData["sla.resolutionDueTime"] = currentDeadline.toTimeString().substring(0, 5);
            }
          }
        }
        
        if (actionType === "completed") {
          updateData["sla.resolutionCompletedAt"] = new Date();
        }
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

      // Add to timeline history
      const historyEntry = {
        id: Date.now().toString(),
        text: actionNotes.trim() || `Status diubah menjadi: ${getWOStatusLabel(actionType as any)}`,
        status: actionType,
        updatedBy: user?.uid,
        updatedByName: user?.name,
        updatedAt: new Date(),
        photoUrl: actionPhotos.length > 0 ? actionPhotos[0].url : null,
      };
      updateData.updateHistory = arrayUnion(historyEntry);

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
        
        const historyEntry = {
          id: Date.now().toString(),
          text: `Status diubah menjadi: ${getWOStatusLabel(newStatus as any)}`,
          status: newStatus,
          updatedBy: user?.uid,
          updatedByName: user?.name,
          updatedAt: new Date(),
        };
        updateData.updateHistory = arrayUnion(historyEntry);

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

  const confirmApprove = (isReject: boolean) => {
    if (!isReject && wo) {
      const budget = wo.budget || [];
      const milestones = wo.milestones || [];
      if (budget.length === 0 || milestones.length === 0) {
        alert("Rencana Anggaran Biaya (RAB) atau Milestone proyek ini masih kosong.\n\nHarap klik tombol 'Edit Work Order' untuk melengkapi RAB terlebih dahulu sebelum menyetujui pengajuan ini.");
        return;
      }
    }
    setApproveIsReject(isReject);
    setApproveNote("");
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!wo || !user || !wo.approvalSteps) return;
    
    setUpdatingStatus(true);
    try {
      const currentStepIdx = wo.currentApprovalStep || 0;
      const step = wo.approvalSteps[currentStepIdx];
      
      const newSteps = [...wo.approvalSteps];
      newSteps[currentStepIdx] = {
        ...step,
        status: approveIsReject ? "rejected" : "approved",
        approverId: user.uid,
        approverName: user.name || "Unknown",
        actionAt: new Date(),
        signatureUrl: user.signatureUrl && user.signatureUrl !== "null" && user.signatureUrl.trim() !== "" ? user.signatureUrl : "",
        ...(approveNote ? { note: approveNote } : {})
      };
      
      const isLastStep = currentStepIdx === newSteps.length - 1;
      const newStatus = approveIsReject ? "cancelled" : (isLastStep ? "open" : "pending_approval");
      
      const updateData: any = {
        approvalSteps: newSteps,
        currentApprovalStep: approveIsReject ? currentStepIdx : (isLastStep ? currentStepIdx : currentStepIdx + 1),
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: user.uid,
        updatedByName: user.name
      };

      const historyText = approveIsReject 
        ? `Proyek Ditolak oleh ${user.name} (${step.role})${approveNote ? ` - Alasan: ${approveNote}` : ''}` 
        : `Proyek Disetujui oleh ${user.name} (${step.role})${approveNote ? ` - Catatan: ${approveNote}` : ''}`;

      const historyEntry = {
        id: Date.now().toString(),
        text: historyText,
        status: newStatus,
        updatedBy: user.uid,
        updatedByName: user.name,
        updatedAt: new Date(),
      };
      updateData.updateHistory = arrayUnion(historyEntry);

      await updateDoc(doc(db, "work_orders", woId), updateData);
      await sendSystemMessage(historyText);
      
      if (!approveIsReject && !isLastStep) {
        const nextApproverId = newSteps[currentStepIdx + 1].approverId;
        if (nextApproverId) {
          await addDoc(collection(db, "notifications"), {
            userId: nextApproverId,
            title: "✍️ Permintaan Persetujuan Project",
            body: `${user.name} telah menyetujui langkah sebelumnya. Sekarang giliran Anda untuk memeriksa Internal Memo Project: ${wo.title}`,
            type: "approval_request",
            data: {
              woId: woId,
            },
            isRead: false,
            createdAt: new Date(),
          });
        }
      }
      
      alert(approveIsReject ? "❌ Proyek ditolak." : "✅ Persetujuan berhasil disimpan!");
      setShowApproveModal(false);
      loadWorkOrder();
    } catch (err) {
      console.error("Error approving:", err);
      alert("Gagal memproses persetujuan");
    } finally {
      setUpdatingStatus(false);
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

  const canApprove = wo && wo.status === "pending_approval" && wo.approvalSteps && wo.currentApprovalStep !== undefined && wo.currentApprovalStep < wo.approvalSteps.length && (
    user?.uid === wo.approvalSteps[wo.currentApprovalStep].approverId
  );

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="view_work_orders">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!wo) return null;

  return (
    <ProtectedRoute requiredFeature="view_work_orders">
      {/* -------------------- PRINT LAYOUT (INTERNAL MEMO) -------------------- */}
      <div className="hidden print:block p-8 max-w-none w-full bg-white">
        <div className="flex justify-center mb-12">
          <div className="w-64 flex items-center justify-center">
            <img src="/images/logo.png" alt="Aviary Park" className="w-full h-auto object-contain" />
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-400 uppercase tracking-widest">INTEROFFICE MEMO</h1>
        </div>
        <div className="grid grid-cols-12 gap-y-2 mb-8 text-sm text-slate-800 font-medium">
          <div className="col-span-3 text-slate-600">Dari</div>
          <div className="col-span-9">: {wo.createdByName} {wo.createdByDept ? `(${wo.createdByDept})` : "(Staff)"}</div>
          <div className="col-span-3 text-slate-600">Kepada</div>
          <div className="col-span-9">: {wo.approvalSteps && wo.approvalSteps.length > 1 
            ? wo.approvalSteps.filter((s: any) => s.step > 0).map((s: any) => {
                const name = s.approverName && s.approverName.trim() !== "" && s.approverName !== "PIC" ? s.approverName : (wo.assignedToUserName || "");
                return name ? `${name} (${s.role})` : s.role;
              }).join(", ") 
            : `${wo.assignedToDept} ${wo.assignedToDivision ? `- ${wo.assignedToDivision}` : ""}`}
          </div>
          <div className="col-span-3 text-slate-600">Tanggal</div>
          <div className="col-span-9">: {wo.createdAt ? formatDate(wo.createdAt) : "-"}</div>
          <div className="col-span-3 text-slate-600">No IM</div>
          <div className="col-span-9">: {wo.woNumber}</div>
          <div className="col-span-3 text-slate-600">Perihal</div>
          <div className="col-span-9 font-bold">: {wo.title}</div>
        </div>
        <div className="border-t-2 border-slate-200 pt-4 pb-4">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: wo.description }} />
          {wo.type === "project" && wo.budget && wo.budget.length > 0 && (
            <div className="mt-8">
              <h4 className="font-bold mb-4">Rincian Anggaran:</h4>
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Item</th>
                    <th className="border border-slate-300 p-2 text-center">Jumlah</th>
                    <th className="border border-slate-300 p-2 text-right">Harga Satuan</th>
                    <th className="border border-slate-300 p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.budget.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="border border-slate-300 p-2">{item.description}</td>
                      <td className="border border-slate-300 p-2 text-center">{item.qty}</td>
                      <td className="border border-slate-300 p-2 text-right">Rp {Number(item.unitPrice).toLocaleString("id-ID")}</td>
                      <td className="border border-slate-300 p-2 text-right">Rp {(Number(item.qty) * Number(item.unitPrice)).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right font-bold mt-4">
                Total Anggaran: Rp {wo.budget.reduce((acc: number, curr: any) => acc + (Number(curr.qty) * Number(curr.unitPrice)), 0).toLocaleString("id-ID")}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 pt-4 flex flex-wrap justify-around gap-8" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          {wo.approvalSteps?.map((step: any, index: number) => (
            <div key={index} className="flex flex-col items-center justify-end h-40 text-center w-48 relative">
              <p className="text-sm font-bold text-slate-600 mb-auto">{step.step === 0 ? "Dibuat Oleh," : "Disetujui Oleh,"}</p>
              {(step.signatureUrl && step.signatureUrl !== "null" && step.signatureUrl.trim() !== "" && (step.signatureUrl.startsWith("data:image") || step.signatureUrl.startsWith("http"))) ? (
                <div className="h-20 w-full flex items-center justify-center relative bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  {step.status === "approved" && step.step > 0 && (
                    <div className="absolute top-0 right-0 transform rotate-12 opacity-80 border-2 border-green-600 text-green-600 px-1 py-0.5 text-[8px] font-black uppercase rounded z-10 bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      Approved
                    </div>
                  )}
                  <TransparentSignature src={step.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center relative bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  {step.status === "approved" && step.step > 0 && (
                    <div className="absolute transform rotate-12 opacity-80 border-2 border-green-600 text-green-600 px-2 py-1 text-xs font-black uppercase rounded bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      Di-ACC
                    </div>
                  )}
                  {step.status === "rejected" && <span className="text-red-500 font-bold">DITOLAK</span>}
                  {step.status === "pending" && <span className="text-gray-400 text-xs">Menunggu</span>}
                </div>
              )}
              <div className="w-full border-t border-slate-800 pt-2 mt-2">
                <p className="font-bold text-slate-800 text-sm truncate">{step.approverName || step.role}</p>
                <p className="text-xs text-slate-500 capitalize">{step.role || ""}</p>
                {step.actionAt && (
                   <p className="text-[10px] text-slate-400 mt-1 font-medium">{formatDate(step.actionAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* ------------------ END PRINT LAYOUT ------------------ */}

      <div className="space-y-6 p-4 sm:p-6 lg:p-8 w-full pb-24 print:hidden">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{wo.title}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${wo.type === "urgent" ? "bg-red-100 text-red-600 border border-red-200" : "bg-purple-100 text-purple-600 border border-purple-200"}`}>
                  {wo.type === "urgent" ? "URGENT" : "PROJECT"}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-mono mt-1">{wo.woNumber}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {canEdit && wo.status !== "completed" && (
              <button 
                onClick={() => router.push(`/work-orders/${woId}/edit`)}
                className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                ✏️ Edit Work Order
              </button>
            )}
            {wo.type === "project" && ["pending_approval", "open", "in_progress", "completed"].includes(wo.status) && (
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Cetak PDF
              </button>
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

        {/* SLA Countdowns (Urgent) */}
        {wo.type === "urgent" && wo.sla && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Response SLA */}
            <div className={`rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border relative overflow-hidden ${
              responseCountdown === "⚠️ OVERDUE!" || wo.sla.isOverdue
                ? "bg-gradient-to-br from-red-50 to-white border-red-200"
                : responseCountdown === "✅ DIRESPONS"
                ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
                : "bg-gradient-to-br from-yellow-50 to-white border-yellow-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div>
                  <h2 className="font-black text-lg flex items-center gap-2 mb-1">
                    ⏱️ <span className="tracking-tight">SLA Respons</span>
                  </h2>
                  <p className="text-xs font-medium text-slate-600 bg-white/60 inline-block px-2 py-1 rounded-md">
                    Target: {wo.sla.responseDueDate && wo.sla.responseDueTime ? new Date(`${wo.sla.responseDueDate}T${wo.sla.responseDueTime}`).toLocaleString("id-ID", {
                      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    }) : '-'}
                  </p>
                </div>
                <div className={`text-left sm:text-right bg-white/60 p-3 rounded-2xl border border-white/50 backdrop-blur-sm ${
                  responseCountdown === "⚠️ OVERDUE!" ? "text-red-600" : 
                  responseCountdown === "✅ DIRESPONS" ? "text-emerald-600" : "text-yellow-600"
                }`}>
                  <p className="text-3xl font-black tracking-tighter">{responseCountdown || "..."}</p>
                </div>
              </div>
              {(wo.sla.responseAcknowledgedAt || wo.sla.acknowledgedAt) && (
                <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-100">
                  ✅ Direspons oleh <strong>{wo.sla.acknowledgedByName}</strong> pada {formatDate(wo.sla.responseAcknowledgedAt || wo.sla.acknowledgedAt)}
                </div>
              )}
            </div>

            {/* Resolution SLA */}
            <div className={`rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border relative overflow-hidden ${
              resolutionCountdown === "⚠️ OVERDUE!" 
                ? "bg-gradient-to-br from-red-50 to-white border-red-200"
                : resolutionCountdown === "✅ SELESAI"
                ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
                : resolutionCountdown === "⏸️ DITUNDA"
                ? "bg-gradient-to-br from-slate-100 to-white border-slate-300"
                : "bg-gradient-to-br from-amber-50 to-white border-amber-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div>
                  <h2 className="font-black text-lg flex items-center gap-2 mb-1">
                    🏁 <span className="tracking-tight">SLA Penyelesaian</span>
                  </h2>
                  <p className="text-xs font-medium text-slate-600 bg-white/60 inline-block px-2 py-1 rounded-md">
                    Target: {(wo.sla.resolutionDueDate || wo.sla.dueDate) && (wo.sla.resolutionDueTime || wo.sla.dueTime) ? new Date(`${wo.sla.resolutionDueDate || wo.sla.dueDate}T${wo.sla.resolutionDueTime || wo.sla.dueTime}`).toLocaleString("id-ID", {
                      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    }) : '-'}
                  </p>
                  {(wo.sla.totalPausedMinutes || 0) > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      *(Diperpanjang {(wo.sla.totalPausedMinutes || 0)} menit karena pending)
                    </p>
                  )}
                </div>
                <div className={`text-left sm:text-right bg-white/60 p-3 rounded-2xl border border-white/50 backdrop-blur-sm ${
                  resolutionCountdown === "⚠️ OVERDUE!" ? "text-red-600" : 
                  resolutionCountdown === "✅ SELESAI" ? "text-emerald-600" :
                  resolutionCountdown === "⏸️ DITUNDA" ? "text-slate-600" : "text-amber-600"
                }`}>
                  <p className="text-3xl font-black tracking-tighter">{resolutionCountdown || "..."}</p>
                </div>
              </div>
              {(wo.sla.resolutionCompletedAt || wo.sla.completedAt) && (
                <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-100">
                  ✅ Selesai pada {formatDate(wo.sla.resolutionCompletedAt || wo.sla.completedAt)}
                </div>
              )}
            </div>
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
        {/* Timeline Riwayat Pekerjaan (Update History) */}
        {((wo.updateHistory && wo.updateHistory.length > 0) || wo.actionNotes || wo.actionPhotoUrl) && (
          <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-bl-full -mr-10 -mt-10 blur-xl"></div>
            <h2 className="font-extrabold text-xl mb-6 text-blue-900 flex items-center gap-2 relative z-10">👨‍🔧 <span>Riwayat Pengerjaan & Penundaan</span></h2>
            
            <div className="space-y-6 relative z-10">
              {/* If we have updateHistory array */}
              {wo.updateHistory && wo.updateHistory.length > 0 ? (
                wo.updateHistory.map((history, idx) => (
                  <div key={history.id || idx} className="relative pl-6 border-l-2 border-blue-200">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-900">{history.updatedByName}</span>
                      <span className="text-xs text-blue-500 font-medium bg-blue-100/50 px-2 py-0.5 rounded">
                        {formatDate(history.updatedAt)}
                      </span>
                      {history.status && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${getWOStatusColor(history.status as any)}`}>
                          {getWOStatusLabel(history.status as any)}
                        </span>
                      )}
                    </div>
                    <div className="bg-white/70 p-4 rounded-2xl border border-white/50 backdrop-blur-sm shadow-sm mt-2">
                      <p className="text-blue-900 whitespace-pre-wrap leading-relaxed">{history.text}</p>
                      {history.photoUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border-2 border-white shadow-sm inline-block bg-white p-1">
                          <img src={history.photoUrl} alt="Action Proof" className="max-w-full md:max-w-xs max-h-48 object-contain rounded-lg" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback for old work orders */
                <div className="relative pl-6 border-l-2 border-blue-200">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold text-blue-900">{wo.updatedByName || "Teknisi"}</span>
                  </div>
                  <div className="bg-white/70 p-4 rounded-2xl border border-white/50 backdrop-blur-sm shadow-sm mt-2">
                    {wo.actionNotes && (
                      <p className="text-blue-900 whitespace-pre-wrap leading-relaxed">{wo.actionNotes}</p>
                    )}
                    {wo.actionPhotoUrl && (
                      <div className="mt-3 rounded-xl overflow-hidden border-2 border-white shadow-sm inline-block bg-white p-1">
                        <img src={wo.actionPhotoUrl} alt="Action Proof" className="max-w-full md:max-w-xs max-h-48 object-contain rounded-lg" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
                  <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                    <div>
                      <p className="font-bold text-gray-800">{b.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {b.qty ? `${b.qty} x ${formatCurrency(b.unitPrice || 0)}` : b.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{formatCurrency(b.estimatedCost)}</p>
                      {b.actualCost > 0 && (
                        <p className="text-xs text-gray-500 mt-1">Actual: {formatCurrency(b.actualCost)}</p>
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
          <div className="rounded-xl bg-white p-5 shadow-md border border-indigo-100 mt-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span>Persetujuan (Internal Memo)</span>
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {wo.approvalSteps.map(step => (
                <div key={step.id} className={`flex flex-col items-center justify-between p-4 rounded-xl border-2 ${
                  step.status === "approved" ? "border-green-200 bg-green-50" :
                  step.status === "rejected" ? "border-red-200 bg-red-50" :
                  step.status === "pending" && step.step === (wo.currentApprovalStep || 0) ? "border-yellow-300 bg-yellow-50" :
                  "border-gray-100 bg-gray-50"
                }`}>
                  <p className="font-bold text-sm text-center mb-1 text-gray-700">{step.role}</p>
                  
                  <div className="h-24 w-full flex items-center justify-center my-2 bg-white/50 rounded-lg border border-dashed border-gray-300">
                    {step.status === "approved" && step.signatureUrl && step.signatureUrl !== "null" && step.signatureUrl.trim() !== "" ? (
                      <img src={step.signatureUrl} alt="Signature" className="max-h-20 max-w-full object-contain mix-blend-multiply" />
                    ) : step.status === "approved" ? (
                      <span className="text-green-500 font-bold italic">Di-ACC</span>
                    ) : step.status === "rejected" ? (
                      <span className="text-red-500 font-bold italic">Ditolak</span>
                    ) : (
                      <span className="text-gray-400 text-xs text-center px-2">Menunggu Persetujuan</span>
                    )}
                  </div>
                  
                  <p className="text-xs font-medium text-gray-600 text-center">{step.approverName && step.approverName.trim() !== "" && step.approverName !== "PIC" ? step.approverName : step.role}</p>
                  {step.actionAt && (
                    <p className="text-[10px] text-gray-500 mt-1">{formatDate(step.actionAt)}</p>
                  )}
                  {step.notes && (
                    <div className="w-full mt-2 pt-2 border-t border-dashed border-gray-200">
                      <p className="text-[10px] text-gray-500 italic text-center">"{step.notes}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Current approver action */}
            {canApprove && (
              <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-sm font-bold mb-3 text-indigo-900">Giliran Anda untuk menyetujui:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmApprove(false)}
                    disabled={updatingStatus}
                    className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-bold shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    ✅ Setujui & Tanda Tangani
                  </button>
                  <button
                    onClick={() => confirmApprove(true)}
                    disabled={updatingStatus}
                    className="flex-1 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-bold shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    ❌ Tolak
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl text-slate-800">
                  Update Status: <span className="text-indigo-600">{getWOStatusLabel(actionType as any)}</span>
                </h3>
                <button 
                  onClick={() => setShowActionModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan Pekerjaan / Hasil</label>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Tuliskan apa saja yang sudah dikerjakan..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm min-h-[100px]"
                  />
                </div>
                
                {actionType === "completed" && wo.type === "project" && (
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <label className="block text-sm font-semibold text-orange-800 mb-2">Pekerja / Helper Terlibat</label>
                    <input
                      type="text"
                      value={actionHelpers}
                      onChange={(e) => setActionHelpers(e.target.value)}
                      placeholder="Contoh: Budi (Teknisi), Andi (Helper)"
                      className="w-full border-2 border-orange-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                    <p className="text-xs text-orange-600 mt-1">Sebutkan nama-nama yang terlibat menyelesaikan project ini</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Bukti Foto</label>
                  <PhotoUpload 
                    photos={actionPhotos} 
                    onChange={setActionPhotos} 
                    maxPhotos={5} 
                    hideRating={true}
                  />
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={submitAction}
                  disabled={updatingStatus}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {updatingStatus ? "Menyimpan..." : "Simpan Update"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <h3 className={`font-bold text-xl ${approveIsReject ? "text-red-600" : "text-green-600"}`}>
                  {approveIsReject ? "Tolak Project" : "Setujui Project"}
                </h3>
                <button 
                  onClick={() => setShowApproveModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {approveIsReject ? "Alasan Penolakan (Wajib)" : "Catatan (Opsional)"}
                  </label>
                  <textarea
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder={approveIsReject ? "Berikan alasan kenapa ditolak..." : "Catatan tambahan..."}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm min-h-[100px]"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (approveIsReject && !approveNote.trim()) {
                      alert("Alasan penolakan wajib diisi!");
                      return;
                    }
                    handleApprove();
                  }}
                  disabled={updatingStatus || (approveIsReject && !approveNote.trim())}
                  className={`px-6 py-2.5 rounded-xl text-white font-bold shadow-md disabled:opacity-50 transition-all flex items-center gap-2 ${
                    approveIsReject ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {updatingStatus ? "Menyimpan..." : (approveIsReject ? "Tolak Project" : "Setujui Project")}
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