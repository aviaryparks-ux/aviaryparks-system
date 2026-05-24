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
import type { Conversation, Message, ChatUser } from "@/types/chat";
import toast from "react-hot-toast";
import { Send, Users, Search, Info, X } from "lucide-react";
import Link from "next/link";

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
    if (!conversationId) return;

    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      markAsRead(conversationId);
    });

    return unsub;
  }, [conversationId]);

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
          {conversation.type === "group" && (
            <p className="text-xs text-slate-500">
              {conversation.memberIds?.length || 0} anggota
            </p>
          )}
        </div>
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
                    {msg.type === "image" && msg.imageUrl ? (
                      <img
                        src={msg.imageUrl}
                        alt="Image"
                        className="max-w-full rounded-lg"
                      />
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
      <div className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder="Ketik pesan..."
            className="flex-1 border border-slate-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
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

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
