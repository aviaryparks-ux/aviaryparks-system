"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, use, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion, collection, query, where, onSnapshot, setDoc } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, User, Tag, Clock, CheckCircle2, AlertCircle, Wrench } from "lucide-react";
import PhotoUpload from "@/components/mod/PhotoUpload";

type UploadedPhoto = {
  id: string;
  url: string;
  caption: string;
  rating: "pass" | "need_improvement" | null;
  fileName?: string;
};

export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const woId = resolvedParams.id;
  const { user } = useAuth();
  const [woData, setWoData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Action state
  const [actionNotes, setActionNotes] = useState("");
  const [actionPhotos, setActionPhotos] = useState<UploadedPhoto[]>([]);
  const [showActionForm, setShowActionForm] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [messagePhotos, setMessagePhotos] = useState<UploadedPhoto[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorkOrder();
  }, [woId]);

  useEffect(() => {
    if (woData) {
      const unsub = loadThread();
      return () => {
        unsub.then(u => u && u());
      };
    }
  }, [woData?.id]);

  const loadWorkOrder = async () => {
    setIsLoading(true);
    try {
      if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) setUserData(uDoc.data());
      }

      const snap = await getDoc(doc(db, "work_orders", woId));
      if (snap.exists()) {
        setWoData({ id: snap.id, ...snap.data() });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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
    if (!woData || !user) return;
    const convRef = doc(db, "conversations", `wo_${woId}`);
    const convSnap = await getDoc(convRef);
    
    if (!convSnap.exists()) {
      const memberIds = [woData.createdBy];
      const memberNames = [woData.createdByName];
      if (woData.assignedToUser && !memberIds.includes(woData.assignedToUser)) {
        memberIds.push(woData.assignedToUser);
        memberNames.push(woData.assignedToUserName || "PIC");
      }
      if (!memberIds.includes(user.uid)) {
        memberIds.push(user.uid);
        memberNames.push(userData?.name || user.email?.split('@')[0] || "Unknown");
      }

      await setDoc(convRef, {
        type: "group",
        name: `WO: ${woData.woNumber} - ${woData.title}`,
        createdBy: woData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberIds,
        memberNames,
        departmentId: woData.assignedToDept,
        isAutoCreated: true,
        admins: [woData.createdBy]
      });
      
      // Update user_conversations
      for (let i = 0; i < memberIds.length; i++) {
        const uid = memberIds[i];
        await setDoc(doc(db, "user_conversations", uid, "conversations", `wo_${woId}`), {
          conversationId: `wo_${woId}`,
          name: `WO: ${woData.woNumber} - ${woData.title}`,
          isAutoCreated: true,
          joinedAt: new Date(),
          unreadCount: 0,
          isMuted: false,
          isPinned: false
        }, { merge: true });
      }
    } else {
      const data = convSnap.data();
      const memberIds = data.memberIds || [];
      const expectedName = `WO: ${woData.woNumber} - ${woData.title}`;
      let updates: any = {};
      
      if (!memberIds.includes(user.uid)) {
        updates.memberIds = [...memberIds, user.uid];
        updates.memberNames = [...(data.memberNames || []), userData?.name || user.email?.split('@')[0] || "Unknown"];
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(convRef, updates);
      }

      await setDoc(doc(db, "user_conversations", user.uid, "conversations", `wo_${woId}`), {
        conversationId: `wo_${woId}`,
        name: expectedName,
        isAutoCreated: true,
        joinedAt: new Date(),
        isMuted: false,
        isPinned: false
      }, { merge: true });
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
        senderName: userData?.name || user.email?.split('@')[0] || 'Unknown',
        text: newMessage,
        attachments: messagePhotos.map(p => ({
          url: p.url,
          id: p.id,
          type: "image"
        })),
        createdAt: new Date()
      };

      await setDoc(doc(collection(db, "messages")), msgObj);
      
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

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      case 'high': return 'text-red-600 bg-red-50';
      case 'critical': return 'text-white bg-red-600';
      default: return 'text-orange-600 bg-orange-50';
    }
  };

  const mapStatusDisplay = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'Baru';
      case 'in_progress': return 'Proses';
      case 'completed': return 'Selesai';
      case 'pending': return 'Ditunda';
      case 'closed': return 'Ditutup';
      default: return 'Baru';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) {
        if (timestamp instanceof Date) {
            return timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return "-";
    }
    return timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!user) return;
    if (newStatus === 'pending' && !actionNotes.trim()) {
      alert("Catatan wajib diisi jika menunda work order.");
      return;
    }

    setIsUpdating(true);
    try {
      const userName = userData?.name || user.email?.split('@')[0] || 'Unknown';
      
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: userName,
      };

      // Take ownership of the WO
      if (newStatus === 'in_progress') {
        updateData.assignedToUser = user.uid;
        updateData.assignedToUserName = userName;
      }

      if (actionNotes.trim()) {
        updateData.actionNotes = actionNotes;
      }

      // Add uploaded photo url to WO data
      if (actionPhotos.length > 0) {
        updateData.actionPhotoUrl = actionPhotos[0].url;
      }

      if (newStatus === 'completed') {
        updateData.completedAt = serverTimestamp();
        updateData.completedBy = user.uid;
        updateData.completedByName = userName;
      }

      // History Entry
      const historyEntry = {
        id: Date.now().toString(),
        text: actionNotes.trim() || `Status diubah menjadi: ${mapStatusDisplay(newStatus)}`,
        status: newStatus,
        updatedBy: user.uid,
        updatedByName: userName,
        updatedAt: new Date(), // using local date so arrayUnion works reliably
        photoUrl: actionPhotos.length > 0 ? actionPhotos[0].url : null
      };

      updateData.updateHistory = arrayUnion(historyEntry);

      await updateDoc(doc(db, "work_orders", woId), updateData);
      
      // Auto send chat message for history update
      await ensureConversationExists();
      const msgObj = {
        conversationId: `wo_${woId}`,
        senderId: "system",
        senderName: "System",
        text: `[System] ${userName} mengubah status menjadi ${mapStatusDisplay(newStatus)}\n${actionNotes.trim()}`,
        attachments: actionPhotos.map(p => ({ url: p.url, id: p.id, type: "image" })),
        createdAt: new Date(),
        isSystemMessage: true
      };
      await setDoc(doc(collection(db, "messages")), msgObj);

      // Reload data
      await loadWorkOrder();
      setShowActionForm(null);
      setActionNotes("");
      setActionPhotos([]);
      alert(`Status berhasil diubah menjadi ${mapStatusDisplay(newStatus)}`);

    } catch (error) {
      console.error("Error updating status:", error);
      alert("Gagal memperbarui status");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white p-4 shadow-sm flex gap-3 items-center">
          <Link href="/mobile/tasks"><ArrowLeft /></Link>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (!woData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p>Work Order tidak ditemukan.</p>
        <Link href="/mobile/tasks" className="text-green-600 mt-2 underline">Kembali</Link>
      </div>
    );
  }

  const photos = woData.photos || [];
  const history = woData.updateHistory || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative pb-32">
      {/* HEADER OVERLAY */}
      <div className="bg-gradient-to-br from-green-700 to-emerald-900 px-4 pt-6 pb-12 rounded-b-3xl relative z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/mobile/tasks" className="p-2 -ml-2 rounded-full bg-white/20 text-white backdrop-blur-sm">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-white flex-1 truncate">Detail Work Order</h1>
        </div>

        <div className="flex justify-between items-start mb-2">
          <span className="bg-white/20 text-white border border-white/30 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider">
            {woData.woNumber || "WO-???"}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getPriorityColor(woData.priority)}`}>
            {woData.priority?.toUpperCase() || 'MEDIUM'}
          </span>
        </div>

        <h2 className="text-2xl font-black text-white leading-tight mb-2 mt-4">
          {woData.title || "Tanpa Judul"}
        </h2>
      </div>

      {/* CONTENT BOXES */}
      <div className="px-4 -mt-6 relative z-20 space-y-4">
        
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Status Saat Ini</p>
            <p className="font-bold text-gray-800 text-lg">{mapStatusDisplay(woData.status)}</p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            woData.status === 'completed' ? 'bg-green-100 text-green-600' :
            woData.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
            'bg-orange-100 text-orange-600'
          }`}>
            {woData.status === 'completed' ? <CheckCircle2 size={24} /> :
             woData.status === 'in_progress' ? <Clock size={24} /> :
             <AlertCircle size={24} />}
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-2">Informasi Masalah</h3>
          
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Lokasi / Area</p>
              <p className="text-sm font-semibold text-gray-800">{woData.locationArea || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Tag size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Kategori Inventaris</p>
              <p className="text-sm font-semibold text-gray-800">{woData.inventoryItem || "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Pelapor</p>
              <p className="text-sm font-semibold text-gray-800">{woData.createdByName || "Admin"}</p>
            </div>
          </div>

          {woData.assignedToUserName && (
            <div className="flex items-start gap-3">
              <Wrench size={18} className="text-blue-500 mt-0.5" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Teknisi Penanggung Jawab</p>
                <p className="text-sm font-bold text-gray-800">{woData.assignedToUserName}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar size={18} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Tanggal Dibuat</p>
              <p className="text-sm font-semibold text-gray-800">{formatDate(woData.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Description Box */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm mb-2">Deskripsi Detail</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {woData.description || "Tidak ada deskripsi detail untuk work order ini."}
          </p>
        </div>

        {/* Photos (if any) */}
        {photos.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Foto Bukti / Kerusakan</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {photos.map((p: any, i: number) => (
                <div key={i} className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url || p} alt="Foto Bukti" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat / Diskusi (Thread) */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden mt-4">
          <div className="bg-gray-50 p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">💬 Diskusi & Live Chat</h3>
          </div>

          <div className="max-h-72 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">Belum ada diskusi. Mulai chat...</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.uid ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                    msg.isSystemMessage
                      ? "bg-gray-100 text-gray-600 w-full text-center rounded-xl"
                      : msg.senderId === user?.uid
                        ? "bg-green-100 text-gray-800 rounded-br-none"
                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                  }`}>
                    {!msg.isSystemMessage && (
                      <p className="text-[10px] font-bold text-gray-500 mb-1">{msg.senderName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {msg.attachments.map((att: any) => (
                          <div key={att.id} className="rounded-lg overflow-hidden border border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={att.url} alt="" className="w-20 h-20 object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{formatDate(msg.createdAt)}</span>
                </div>
              ))
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-100 bg-white">
            <div className="mb-3">
              <PhotoUpload 
                photos={messagePhotos} 
                onChange={setMessagePhotos} 
                maxPhotos={2} 
                hideRating={true}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === "Enter" && sendMessage()}
                placeholder="Ketik pesan..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-500 outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={sendingMessage || (!newMessage.trim() && messagePhotos.length === 0)}
                className="px-4 py-2 bg-green-600 text-white rounded-xl shadow-md font-bold disabled:opacity-50"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR (Only if not completed) */}
      {woData.status !== 'completed' && woData.status !== 'closed' && (
        <div className="fixed bottom-[72px] left-0 right-0 w-full sm:max-w-md sm:mx-auto p-4 bg-white border-t border-gray-200 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
          
          {/* Form Modal (Overlay) */}
          {showActionForm && (
            <div className="absolute bottom-full left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] rounded-t-2xl max-h-[80vh] overflow-y-auto pb-6">
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
                <h4 className="font-bold text-gray-800">
                  {showActionForm === 'in_progress' ? 'Mulai Kerjakan (Ambil WO)' :
                   showActionForm === 'completed' ? 'Selesaikan Work Order' : 'Tunda Work Order'}
                </h4>
                <button onClick={() => setShowActionForm(null)} className="p-1 text-gray-400 bg-gray-100 rounded-full"><AlertCircle size={20}/></button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">Catatan Teknisi {showActionForm === 'pending' && <span className="text-red-500">*wajib</span>}</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    rows={3}
                    placeholder="Tuliskan keterangan..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">Upload Bukti Foto</label>
                  <PhotoUpload 
                    photos={actionPhotos} 
                    onChange={setActionPhotos} 
                    maxPhotos={3} 
                    hideRating={true}
                  />
                </div>
              </div>
              
              <button 
                onClick={() => handleUpdateStatus(showActionForm)}
                disabled={isUpdating}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {['open', 'baru', 'new'].includes(woData.status?.toLowerCase()) && (
              <button 
                onClick={() => setShowActionForm('in_progress')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm"
              >
                Ambil & Kerjakan
              </button>
            )}
            
            {woData.status === 'in_progress' && (
              <>
                <button 
                  onClick={() => setShowActionForm('pending')}
                  className="flex-1 bg-orange-100 text-orange-700 font-bold py-3.5 rounded-xl transition-colors"
                >
                  Tunda
                </button>
                <button 
                  onClick={() => setShowActionForm('completed')}
                  className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-green-600/30"
                >
                  Selesaikan
                </button>
              </>
            )}

            {woData.status === 'pending' && (
              <button 
                onClick={() => setShowActionForm('in_progress')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                Lanjutkan Pekerjaan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
