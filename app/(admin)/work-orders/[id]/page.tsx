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
      const q = query(collection(db, "work_threads"), where("woId", "==", woId));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setMessages(data.messages || []);
        }
      });
      return unsub;
    } catch (err) {
      console.error("Error loading thread:", err);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && messagePhotos.length === 0) || !user) return;

    setSendingMessage(true);
    try {
      const message: ThreadMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user.uid,
        senderName: user.name,
        senderRole: user.role,
        text: newMessage,
        attachments: messagePhotos.map(p => ({
          id: p.id,
          url: p.url,
          caption: p.caption || "",
          uploadedBy: user.uid,
          uploadedByName: user.name,
          uploadedAt: new Date()
        })),
        createdAt: new Date(),
        isSystemMessage: false
      };

      const threadRef = doc(db, "work_threads", `thread_${woId}`);
      await setDoc(threadRef, {
        woId,
        messages: [...messages, message],
        lastMessageAt: new Date()
      }, { merge: true });

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
      const message: ThreadMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: "system",
        senderName: "System",
        senderRole: "system",
        text,
        attachments: [],
        createdAt: new Date(),
        isSystemMessage: true
      };
      const threadRef = doc(db, "work_threads", `thread_${woId}`);
      await setDoc(threadRef, {
        woId,
        messages: [...messages, message],
        lastMessageAt: new Date()
      }, { merge: true });
    } catch (err) {
      console.error("Error sending system message:", err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!wo) return;

    if (!confirm(`Ubah status ke "${getWOStatusLabel(newStatus as any)}"?`)) return;

    setUpdatingStatus(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: user?.uid,
        updatedByName: user?.name
      };

      if (newStatus === "completed") {
        updateData.completedAt = new Date();
        updateData.completedBy = user?.uid;
        updateData.completedByName = user?.name;
      }

      if (wo.type === "urgent" && newStatus === "in_progress" && wo.sla) {
        updateData["sla.acknowledgedBy"] = user?.uid;
        updateData["sla.acknowledgedByName"] = user?.name;
        updateData["sla.acknowledgedAt"] = new Date();
      }

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
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white shadow-xl">
          <button onClick={() => router.back()} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-lg hover:bg-white/30">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs ${wo.type === "urgent" ? "bg-red-200 text-red-800" : "bg-purple-200 text-purple-800"}`}>
                {wo.type === "urgent" ? "⚡ Urgent" : "📁 Project"}
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-2">{wo.title}</h1>
            <p className="text-orange-100 mt-1 font-mono text-sm">{wo.woNumber}</p>
            {canEdit && wo.status !== "completed" && (
              <button 
                onClick={() => router.push(`/work-orders/${woId}/edit`)}
                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                ✏️ Edit Work Order
              </button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl bg-white p-5 shadow-md border">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(wo.status)}`}>
                {getWOStatusLabel(wo.status as any)}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${getWOPriorityColor(wo.priority as any)}`}>
                {getWOPriorityLabel(wo.priority as any)}
              </span>
            </div>
            {wo.source === "mod" && (
              <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm">
                🔗 From MOD
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Dibuat oleh</p>
              <p className="font-medium">{wo.createdByName}</p>
            </div>
            <div>
              <p className="text-gray-500">Dept / Divisi Tujuan</p>
              <p className="font-medium">{wo.assignedToDept} {wo.assignedToDivision ? `> ${wo.assignedToDivision}` : ""}</p>
            </div>
            <div>
              <p className="text-gray-500">Tanggal</p>
              <p className="font-medium">{formatDate(wo.createdAt)}</p>
            </div>
            {wo.locationArea && (
              <div>
                <p className="text-gray-500">Lokasi / Area</p>
                <p className="font-medium">{wo.locationArea}</p>
              </div>
            )}
            {wo.inventoryItem && (
              <div>
                <p className="text-gray-500">Barang / Inventory</p>
                <p className="font-medium">{wo.inventoryItem}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Tags</p>
              <p className="font-medium">{wo.tags?.join(", ") || "-"}</p>
            </div>
          </div>
        </div>

        {/* SLA Countdown (Urgent) */}
        {wo.type === "urgent" && wo.sla && (
          <div className={`rounded-xl p-5 shadow-md border ${
            wo.sla.isOverdue || slaCountdown === "⚠️ OVERDUE!" ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">⏱️ SLA</h2>
                <p className="text-sm text-gray-600">
                  Deadline: {new Date(`${wo.sla.dueDate}T${wo.sla.dueTime}`).toLocaleString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
              <div className={`text-right ${wo.sla.isOverdue || slaCountdown === "⚠️ OVERDUE!" ? "text-red-600" : "text-orange-600"}`}>
                <p className="text-3xl font-bold">{slaCountdown || "..."}</p>
                <p className="text-xs">tersisa</p>
              </div>
            </div>
            {wo.sla.acknowledgedBy && (
              <p className="text-xs text-gray-500 mt-2">
                ✅ Diaknowledge oleh {wo.sla.acknowledgedByName} pada {formatDate(wo.sla.acknowledgedAt)}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {wo.description && (
          <div className="rounded-xl bg-white p-5 shadow-md border">
            <h2 className="font-bold text-lg mb-3">📝 Deskripsi</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{wo.description}</p>
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
              {wo.status === "in_progress" && (
                <>
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

        {/* Back */}
        <button onClick={() => router.push("/work-orders")} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-xl">
          ← Kembali ke Daftar
        </button>
      </div>
    </ProtectedRoute>
  );
}