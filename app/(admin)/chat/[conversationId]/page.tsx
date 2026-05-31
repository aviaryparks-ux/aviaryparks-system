// app/(admin)/chat/[conversationId]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  getConversation,
  subscribeToMessages,
  sendMessage,
  markAsRead,
  addMemberToGroup,
  removeMemberFromGroup,
} from "@/lib/chat/firebase";
import { searchUsers } from "@/lib/chat/firebase";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, onSnapshot, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import type { Conversation, Message, ChatUser } from "@/types/chat";
import toast from "react-hot-toast";
import { Send, Users, Search, Info, X, Paperclip, Image as ImageIcon, FileText, Download, Phone, Video, Smile } from "lucide-react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { AgoraCallRoom } from "@/components/AgoraCallRoom";

export default function ChatRoomPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [activeCall, setActiveCall] = useState<{ channel: string; token: string; isVideo: boolean; uid: number } | null>(null);
  const [pendingCall, setPendingCall] = useState<{ isVideo: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserId = typeof window !== "undefined"
    ? (() => {
        try {
          const cached = localStorage.getItem("attendance_user_cache");
          if (cached) {
            const { data } = JSON.parse(cached);
            return data?.uid || "";
          }
        } catch {}
        return "";
      })()
    : "";

  useEffect(() => {
    if (!conversationId) return;

    const loadConversation = async () => {
      const conv = await getConversation(conversationId);
      if (conv) setConversation(conv);
    };
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    // Listen to active_calls to see if our pending call gets accepted/declined
    if (pendingCall) {
      const unsub = onSnapshot(doc(db, "active_calls", conversationId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === "accepted") {
            // They accepted! Join the call
            joinCallDirectly(pendingCall.isVideo);
            setPendingCall(null);
          } else if (data.status === "declined" || data.status === "ended") {
            if (data.status === "declined") {
              toast.error("Panggilan ditolak.");
            }
            setPendingCall(null);
            // Optionally delete document
            deleteDoc(doc(db, "active_calls", conversationId)).catch(()=>{});
          }
        }
      });
      return () => unsub();
    }
  }, [pendingCall, conversationId]);

  useEffect(() => {
    // Auto-join if directed from CallListener (accepted incoming call)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("autoJoin") === "true") {
      // Find if we are currently accepting a call
      const checkIncoming = async () => {
        const docSnap = await getDoc(doc(db, "active_calls", conversationId));
        if (docSnap.exists() && docSnap.data().status === "accepted") {
           joinCallDirectly(docSnap.data().isVideo);
           // Clear URL params
           window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      checkIncoming();
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      markAsRead(conversationId);
    });

    return unsub;
  }, [conversationId]);

  useEffect(() => {
    // Listen to other user's presence if private chat
    if (conversation?.type === "private" && conversation.participants?.length === 2) {
      const otherUserId = conversation.participants.find(id => id !== currentUserId);
      if (otherUserId) {
        const userRef = doc(db, "users", otherUserId);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setOtherUserOnline(docSnap.data().isActive === true);
          }
        });
        return () => unsubUser();
      }
    }
  }, [conversation, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchUsers(searchQuery);
      // Filter out existing members for groups
      if (conversation?.type === "group") {
        const existingIds = conversation.memberIds || [];
        setSearchResults(results.filter((u) => !existingIds.includes(u.uid)));
      } else {
        setSearchResults(results);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, conversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(conversationId, newMessage.trim());
      setNewMessage("");
    } catch (error: any) {
      toast.error("Gagal mengirim pesan: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartCall = async (isVideo: boolean) => {
    if (!currentUserId || !conversationId || !conversation) return;
    
    // Determine receiver
    let receiverId = "";
    if (conversation.type === "private" && conversation.participants) {
      receiverId = conversation.participants.find(id => id !== currentUserId) || "";
    } else {
      toast.error("Group calling not fully supported for ringing yet. Joining directly.");
      await joinCallDirectly(isVideo);
      return;
    }

    try {
      // Set local state to show "Calling..." screen
      setPendingCall({ isVideo });

      // Create ringing document in active_calls
      await setDoc(doc(db, "active_calls", conversationId), {
        callerId: currentUserId,
        callerName: conversation.participantNames?.find((n, i) => conversation.participants?.[i] === currentUserId) || "User",
        receiverId: receiverId,
        isVideo: isVideo,
        status: "ringing",
        timestamp: new Date().getTime()
      });

      // Also send chat message for history
      await sendMessage(conversationId, `Memulai panggilan ${isVideo ? "video" : "suara"}...`, 'call');

    } catch (e: any) {
      setPendingCall(null);
      toast.error("Gagal memulai panggilan: " + e.message);
    }
  };

  const joinCallDirectly = async (isVideo: boolean) => {
    const channelName = conversationId;
    try {
      const randomUid = Math.floor(Math.random() * 65500) + 1;
      const res = await fetch('/api/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid: randomUid })
      });
      const data = await res.json();
      
      if (data.token) {
        setActiveCall({
          channel: channelName,
          token: data.token,
          uid: data.uid ? Number(data.uid) : randomUid,
          isVideo
        });
      } else {
        toast.error("Gagal mendapatkan token: " + data.error);
      }
    } catch (e: any) {
      toast.error("Gagal bergabung ke panggilan: " + e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    setShowAttachmentMenu(false);
    
    try {
      let fileToUpload = file;
      if (isImage) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(file, options);
      }

      const fileName = `chat/${isImage ? 'images' : 'files'}/${conversationId}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      const snapshot = await uploadBytes(storageRef, fileToUpload);
      const downloadURL = await getDownloadURL(snapshot.ref);

      if (isImage) {
        await sendMessage(conversationId, downloadURL, "image", downloadURL);
      } else {
        // use imageUrl to store original file name
        await sendMessage(conversationId, downloadURL, "file", file.name);
      }
    } catch (error: any) {
      toast.error(`Gagal mengirim ${isImage ? 'gambar' : 'file'}: ` + error.message);
    } finally {
      setIsSending(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const handleAddMember = async (user: ChatUser) => {
    try {
      await addMemberToGroup(conversationId, user.uid, user.name);
      toast.success(`${user.name} ditambahkan ke grup`);
      setShowAddMember(false);
      setSearchQuery("");
      // Refresh conversation
      const conv = await getConversation(conversationId);
      if (conv) setConversation(conv);
    } catch (error: any) {
      toast.error("Gagal menambahkan member: " + error.message);
    }
  };

  const handleRemoveMember = async (uid: string, name: string) => {
    if (!confirm(`Hapus ${name} dari grup?`)) return;

    try {
      await removeMemberFromGroup(conversationId, uid);
      toast.success(`${name} dihapus dari grup`);
      // Refresh conversation
      const conv = await getConversation(conversationId);
      if (conv) setConversation(conv);
    } catch (error: any) {
      toast.error("Gagal menghapus member: " + error.message);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const getDisplayName = (conv: Conversation) => {
    if (conv.type === "group") return conv.name;
    if (conv.participants && conv.participants.length === 2) {
      const otherIndex = conv.participants[0] === currentUserId ? 1 : 0;
      return conv.participantNames?.[otherIndex] || "Unknown";
    }
    return "Chat";
  };

  const isAdmin = conversation?.admins?.includes(currentUserId);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-200">
        <Link href="/chat" className="text-slate-400 hover:text-slate-600">
          ←
        </Link>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800">{getDisplayName(conversation)}</h2>
          {conversation.type === "group" ? (
            <p className="text-xs text-slate-500">
              {conversation.memberIds?.length || 0} anggota
            </p>
          ) : (
            <p className={`text-xs ${otherUserOnline ? "text-emerald-500 font-medium" : "text-slate-400"}`}>
              {otherUserOnline ? "Online" : "Offline"}
            </p>
          )}
        </div>

        <button onClick={() => handleStartCall(false)} className="p-2 hover:bg-slate-100 rounded-lg text-emerald-600 transition-colors">
          <Phone className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowInfo(true)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <Info className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <p>Belum ada pesan</p>
            <p className="text-sm">Kirim pesan pertama</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[70%] ${isMe ? "items-end" : ""}`}>
                  {!isMe && (
                    <p className="text-xs text-slate-500 mb-1 ml-2">
                      {msg.senderName}
                    </p>
                  )}
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMe
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : "bg-slate-100 text-slate-800 rounded-bl-md"
                    }`}
                  >
                    {msg.type === "image" && msg.text ? (
                      <img
                        src={msg.text}
                        alt="Image"
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewImage(msg.text)}
                      />
                    ) : msg.type === "call" ? (
                      <div className="flex flex-col items-center gap-3 p-2 min-w-[150px]">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Phone className="w-5 h-5" />
                          <span>{msg.text}</span>
                        </div>
                      </div>
                    ) : msg.type === "file" ? (
                      <a 
                        href={msg.text}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-2 p-2 rounded-lg ${isMe ? "bg-emerald-700/50 hover:bg-emerald-700" : "bg-slate-200 hover:bg-slate-300"} transition-colors`}
                      >
                        <FileText className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm truncate max-w-[200px] underline">{msg.imageUrl || "File"}</span>
                      </a>
                    ) : (
                      <p className="text-sm">{msg.text}</p>
                    )}
                    <p
                      className={`text-[10px] mt-1 ${
                        isMe ? "text-emerald-200" : "text-slate-400"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 relative">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            
            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white shadow-xl rounded-xl border border-slate-100 overflow-hidden min-w-[160px] animate-fade-in-up">
                <button 
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 text-slate-700 text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  Gambar
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 text-slate-700 text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                    <FileText className="w-4 h-4" />
                  </div>
                  Dokumen
                </button>
              </div>
            )}
          </div>
          
          <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={(e) => handleFileUpload(e, true)} />
          <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => handleFileUpload(e, false)} />

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Emoji Picker Menu */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-50 animate-fade-in-up">
              <EmojiPicker 
                onEmojiClick={(emojiData: EmojiClickData) => {
                  setNewMessage(prev => prev + emojiData.emoji);
                }} 
              />
            </div>
          )}

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ketik pesan..."
            className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() && !isSending}
            className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-transform active:scale-95"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4 -ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto animate-slide-in-right">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-bold text-slate-800">Info Grup</h3>
              <button onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <div className="p-4">
              {conversation.description && (
                <div className="mb-4">
                  <p className="text-sm text-slate-500">{conversation.description}</p>
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <p className="font-medium text-slate-800">
                  {conversation.memberIds?.length || 0} Anggota
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    + Tambah
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {conversation.memberIds?.map((uid, idx) => {
                  const name = conversation.memberNames?.[idx] || "Unknown";
                  const isGroupAdmin = conversation.admins?.includes(uid);
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                          {name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{name}</p>
                          {isGroupAdmin && (
                            <span className="text-xs text-emerald-600">Admin</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && uid !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(uid, name)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Tambah Anggota</h3>
              <button onClick={() => setShowAddMember(false)}>✕</button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama..."
                  className="w-full border border-slate-200 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => handleAddMember(user)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                        {user.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.department}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && searchQuery.length >= 2 && (
                <p className="text-center text-slate-400 py-8">Tidak ada hasil</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="absolute top-4 right-4 flex gap-4">
            <a 
              href={previewImage}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            >
              <Download className="w-6 h-6" />
            </a>
            <button 
              className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Pending Call Screen */}
      {pendingCall && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <span className="text-4xl text-white font-bold">
              {conversation?.name ? conversation.name[0].toUpperCase() : "?"}
            </span>
          </div>
          <h2 className="text-3xl text-white font-bold mb-2">{conversation?.name || "Unknown"}</h2>
          <p className="text-emerald-400 text-lg mb-12">Menunggu diangkat...</p>
          
          <button 
            onClick={async () => {
              setPendingCall(null);
              try {
                await updateDoc(doc(db, "active_calls", conversationId), { status: "ended" });
              } catch(e) {}
            }}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Phone className="w-8 h-8 text-white fill-white rotate-[135deg]" />
          </button>
        </div>
      )}

      {/* Active Call Modal */}
      {activeCall && (
        <AgoraCallRoom 
          channelName={activeCall.channel}
          appId="cce1fd6074a541e9ae816a873da217f1"
          token={activeCall.token}
          uid={activeCall.uid}
          isVideoCall={activeCall.isVideo}
          onEndCall={async () => {
            setActiveCall(null);
            try {
               await updateDoc(doc(db, "active_calls", conversationId), { status: "ended" });
            } catch(e) {}
          }}
        />
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
