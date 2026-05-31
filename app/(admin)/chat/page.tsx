// app/(admin)/chat/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  subscribeToGroupConversations,
  subscribeToPrivateConversations,
  createGroupChat,
  getOrCreatePrivateConversation,
  searchUsers,
  subscribeToUnreadCount,
  deleteConversation,
  archiveConversation,
} from "@/lib/chat/firebase";
import type { Conversation, ChatUser } from "@/types/chat";
import toast from "react-hot-toast";
import { MessageSquare, Users, Plus, Search, Trash2, LogOut } from "lucide-react";

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<"groups" | "private">("groups");
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [privateChats, setPrivateChats] = useState<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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
    const unsubGroups = subscribeToGroupConversations(setGroups);
    const unsubPrivate = subscribeToPrivateConversations(setPrivateChats);
    const unsubUnread = subscribeToUnreadCount(setUnreadCount);

    return () => {
      unsubGroups();
      unsubPrivate();
      unsubUnread();
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const conversations = activeTab === "groups" ? groups : privateChats;

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error("Nama grup dan anggota wajib diisi");
      return;
    }

    setIsCreating(true);
    try {
      await createGroupChat({
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        memberIds: selectedUsers.map((u) => u.uid),
        memberNames: selectedUsers.map((u) => u.name),
      });
      toast.success("Grup berhasil dibuat!");
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedUsers([]);
    } catch (error: any) {
      toast.error("Gagal membuat grup: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartPrivateChat = async (user: ChatUser) => {
    try {
      const conversationId = await getOrCreatePrivateConversation(user.uid, user.name);
      window.location.href = `/chat/${conversationId}`;
    } catch (error: any) {
      toast.error("Gagal memulai chat: " + error.message);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return " Baru";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}j`;
    return `${Math.floor(diff / 86400000)}h`;
  };

  const getDisplayName = (conv: Conversation, currentUserId: string) => {
    if (conv.type === "group") return conv.name;
    if (conv.participants && conv.participants.length === 2) {
      const otherIndex = conv.participants[0] === currentUserId ? 1 : 0;
      return conv.participantNames?.[otherIndex] || "Unknown";
    }
    return "Chat";
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Hapus percakapan ini beserta semua pesan? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      await deleteConversation(convId);
      toast.success("Percakapan berhasil dihapus");
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message);
    }
  };

  const handleArchiveConversation = async (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Keluar & arsipkan percakapan ini dari daftar Anda?")) return;
    try {
      await archiveConversation(convId);
      toast.success("Percakapan diarsipkan");
    } catch (error: any) {
      toast.error("Gagal mengarsipkan: " + error.message);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-t-xl border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-800">Chat</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUserSearch(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Chat Pribadi
            </button>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Grup Baru
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "groups"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Grup ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "private"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Pribadi ({privateChats.length})
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 bg-white rounded-b-xl overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {activeTab === "groups" ? "Belum ada grup" : "Belum ada chat pribadi"}
            </p>
            <p className="text-sm mt-1">
              {activeTab === "groups"
                ? "Tekan 'Grup Baru' untuk membuat grup"
                : "Tekan 'Chat Pribadi' untuk mulai percakapan"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conv) => (
              <a
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                  {conv.type === "group" ? (
                    <Users className="w-6 h-6" />
                  ) : (
                    getDisplayName(conv, currentUserId)[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-800 truncate">
                      {getDisplayName(conv, currentUserId)}
                    </h3>
                    {conv.lastMessage && (
                      <span className="text-xs text-slate-400">
                        {formatTime(conv.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate mt-0.5">
                    {conv.lastMessage
                      ? `${conv.lastMessage.senderName}: ${conv.lastMessage.text}`
                      : "Belum ada pesan"}
                  </p>
                </div>
                {conv.type === "group" ? (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                    {conv.memberIds?.length || 0}
                  </span>
                ) : null}
                
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold ml-2">
                    {conv.unreadCount}
                  </span>
                )}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={(e) => handleArchiveConversation(e, conv.id)}
                    title="Arsipkan / Keluar"
                    className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  {(conv.createdBy === currentUserId || conv.type === "private") && (
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      title="Hapus Permanen"
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* User Search Modal for Private Chat */}
      {showUserSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Chat Pribadi</h2>
                <button
                  onClick={() => {
                    setShowUserSearch(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Cari karyawan untuk memulai percakapan
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama atau email..."
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>
              {searchResults.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {searchResults.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => handleStartPrivateChat(user)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                        {user.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-slate-800">{user.name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        {user.department && (
                          <p className="text-xs text-slate-400 mt-1">
                            {user.department}
                            {user.role && ` • ${user.role.toUpperCase()}`}
                          </p>
                        )}
                      </div>
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <p className="text-center text-slate-400 py-8">
                  Ketik lebih banyak untuk mencari
                </p>
              ) : (
                <p className="text-center text-slate-400 py-8">
                  Ketik nama atau email untuk mencari
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Buat Grup Baru</h2>
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Grup *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Contoh: Tim Marketing"
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Deskripsi (opsional)
                  </label>
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Deskripsi grup"
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cari Anggota *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama atau email..."
                      className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                      {searchResults.map((user) => (
                        <button
                          key={user.uid}
                          onClick={() => {
                            if (!selectedUsers.find((u) => u.uid === user.uid)) {
                              setSelectedUsers([...selectedUsers, user]);
                            }
                            setSearchQuery("");
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
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
                </div>
                {selectedUsers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {selectedUsers.length} Anggota Dipilih
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((user) => (
                        <span
                          key={user.uid}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            onClick={() =>
                              setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid))
                            }
                            className="hover:text-emerald-900"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCreating ? "Membuat..." : "Buat Grup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
