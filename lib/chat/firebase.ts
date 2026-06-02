// Chat Firebase Helper for Next.js Web Admin Panel
// This file provides real-time chat functionality synchronized with Flutter app

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import type { Conversation, Message, ChatUser, CreateGroupPayload } from "@/types/chat";

// ==================== HELPERS ====================

const getCurrentUserId = (): string => {
  if (typeof window === "undefined") return "";
  const cached = localStorage.getItem("attendance_user_cache");
  if (cached) {
    try {
      const { data } = JSON.parse(cached);
      return data?.uid || "";
    } catch {
      return "";
    }
  }
  return "";
};

const getCurrentUserName = (): string => {
  if (typeof window === "undefined") return "Unknown";
  const cached = localStorage.getItem("attendance_user_cache");
  if (cached) {
    try {
      const { data } = JSON.parse(cached);
      return data?.name || "Unknown";
    } catch {
      return "Unknown";
    }
  }
  return "Unknown";
};

// ==================== CONVERSATIONS ====================

/**
 * Get all conversations for current user (real-time)
 */
export function subscribeToConversations(
  callback: (conversations: Conversation[]) => void
): () => void {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    callback([]);
    return () => {};
  }

  const userConvsRef = collection(
    db,
    "user_conversations",
    currentUserId,
    "conversations"
  );

  return onSnapshot(userConvsRef, async (snapshot) => {
    const conversations: Conversation[] = [];

    for (const docSnap of snapshot.docs) {
      const convDoc = await getDoc(doc(db, "conversations", docSnap.id));
      if (convDoc.exists()) {
        const convData = convDoc.data();
        let participantNames = convData.participantNames || [];
        
        // Fix missing participant names for old private chats
        const isNamesInvalid = !participantNames || participantNames.length < 2 || participantNames.some((n: any) => !n || n === "Unknown");
        if (convData.type === "private" && convData.participants && convData.participants.length === 2 && isNamesInvalid) {
          const names = [];
          for (const pUid of convData.participants) {
            const uDoc = await getDoc(doc(db, "users", pUid));
            names.push(uDoc.exists() ? (uDoc.data().name || uDoc.data().email || "Unknown") : "Unknown");
          }
          participantNames = names;
        }

        conversations.push({
          id: convDoc.id,
          ...convData,
          participantNames,
          unreadCount: docSnap.data().unreadCount || 0,
        } as Conversation);
      }
    }

    // Sort by updatedAt descending
    conversations.sort((a, b) => {
      const aTime = a.updatedAt?.toDate?.() || new Date(0);
      const bTime = b.updatedAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });

    callback(conversations);
  });
}

/**
 * Get group conversations only
 * Fetches all groups from the conversations collection so Admins can see all chats.
 */
export function subscribeToGroupConversations(
  callback: (conversations: Conversation[]) => void
): () => void {
  const q = query(
    collection(db, "conversations"),
    where("type", "==", "group"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, async (snapshot) => {
    const currentUserId = getCurrentUserId();
    const conversations = await Promise.all(snapshot.docs.map(async (docSnap) => {
      let unreadCount = 0;
      if (currentUserId) {
        try {
          const ucSnap = await getDoc(doc(db, "user_conversations", currentUserId, "conversations", docSnap.id));
          if (ucSnap.exists()) {
            unreadCount = ucSnap.data().unreadCount || 0;
          }
        } catch (e) {}
      }
      return {
        id: docSnap.id,
        ...docSnap.data(),
        unreadCount,
      } as Conversation;
    }));
    callback(conversations);
  });
}

/**
 * Get private conversations only
 */
export function subscribeToPrivateConversations(
  callback: (conversations: Conversation[]) => void
): () => void {
  return subscribeToConversations((convs) => {
    callback(convs.filter((c) => c.type === "private"));
  });
}

/**
 * Get total unread message count
 */
export function subscribeToUnreadCount(
  callback: (count: number) => void
): () => void {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    callback(0);
    return () => {};
  }

  const userConvsRef = collection(
    db,
    "user_conversations",
    currentUserId,
    "conversations"
  );

  return onSnapshot(userConvsRef, async (snapshot) => {
    let total = 0;
    for (const docSnap of snapshot.docs) {
      const count = (docSnap.data().unreadCount || 0) as number;
      if (count > 0) {
        try {
          const convDoc = await getDoc(doc(db, "conversations", docSnap.id));
          if (convDoc.exists()) {
            total += count;
          } else {
            // Auto-clean up ghost conversation
            deleteDoc(docSnap.ref).catch(() => {});
          }
        } catch (e) {
          total += count; // Fallback
        }
      }
    }
    callback(total);
  });
}

/**
 * Get a single conversation
 */
export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  const docSnap = await getDoc(doc(db, "conversations", conversationId));
  if (docSnap.exists()) {
    const convData = docSnap.data();
    let participantNames = convData.participantNames || [];

    // Fix missing participant names for old private chats
    const isNamesInvalid = !participantNames || participantNames.length < 2 || participantNames.some((n: any) => !n || n === "Unknown");
    if (convData.type === "private" && convData.participants && convData.participants.length === 2 && isNamesInvalid) {
      const names = [];
      for (const pUid of convData.participants) {
        const uDoc = await getDoc(doc(db, "users", pUid));
        names.push(uDoc.exists() ? (uDoc.data().name || uDoc.data().email || "Unknown") : "Unknown");
      }
      participantNames = names;
    }

    // Fix missing member names for old group chats
    let memberNames = convData.memberNames || [];
    const isMemberNamesInvalid = convData.memberIds && convData.memberIds.length > 0 && 
      (!memberNames || memberNames.length < convData.memberIds.length || memberNames.some((n: any) => !n || n === "Unknown"));
      
    if (convData.type === "group" && isMemberNamesInvalid) {
      const names = [];
      for (const pUid of convData.memberIds) {
        const uDoc = await getDoc(doc(db, "users", pUid));
        names.push(uDoc.exists() ? (uDoc.data().name || uDoc.data().email || "Unknown") : "Unknown");
      }
      memberNames = names;
    }

    return { id: docSnap.id, ...convData, participantNames, memberNames } as Conversation;
  }
  return null;
}

/**
 * Create a new group chat
 */
export async function createGroupChat(
  payload: CreateGroupPayload
): Promise<string> {
  const currentUserId = getCurrentUserId();
  const currentUserName = getCurrentUserName();

  const conversationRef = doc(collection(db, "conversations"));
  const now = serverTimestamp();

  const conversation: Record<string, any> = {
    type: "group",
    name: payload.name,
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    memberIds: [...payload.memberIds, currentUserId],
    memberNames: [...payload.memberNames, currentUserName],
    isAutoCreated: payload.isAutoCreated ?? false,
    admins: [currentUserId],
  };

  if (payload.description !== undefined) conversation.description = payload.description;
  if (payload.avatarUrl !== undefined) conversation.avatarUrl = payload.avatarUrl;
  if (payload.departmentId !== undefined) conversation.departmentId = payload.departmentId;

  await setDoc(conversationRef, conversation);

  // Add all members to user_conversations
  for (let i = 0; i < payload.memberIds.length; i++) {
    await addUserToConversation(
      conversationRef.id,
      payload.memberIds[i],
      payload.memberNames[i] || "Unknown",
      payload.isAutoCreated ?? false
    );
  }
  await addUserToConversation(
    conversationRef.id,
    currentUserId,
    currentUserName,
    payload.isAutoCreated ?? false
  );

  return conversationRef.id;
}

/**
 * Add user to conversation tracking
 */
async function addUserToConversation(
  conversationId: string,
  uid: string,
  name: string,
  isAutoCreated: boolean
): Promise<void> {
  await setDoc(
    doc(db, "user_conversations", uid, "conversations", conversationId),
    {
      conversationId,
      name,
      isAutoCreated,
      joinedAt: serverTimestamp(),
      unreadCount: 0,
      isMuted: false,
      isPinned: false,
    }
  );
}

/**
 * Get or create a private conversation
 */
export async function getOrCreatePrivateConversation(
  otherUserId: string,
  otherUserName: string
): Promise<string> {
  const currentUserId = getCurrentUserId();

  // Check if conversation already exists
  const snapshot = await getDocs(
    query(
      collection(db, "conversations"),
      where("type", "==", "private"),
      where("participants", "array-contains", currentUserId)
    )
  );

  for (const docSnap of snapshot.docs) {
    const participants = docSnap.data().participants || [];
    if (
      participants.includes(otherUserId) &&
      participants.includes(currentUserId)
    ) {
      return docSnap.id;
    }
  }

  // Create new conversation
  const conversationRef = doc(collection(db, "conversations"));
  const currentUserName = getCurrentUserName();
  const now = serverTimestamp();

  await setDoc(conversationRef, {
    type: "private",
    name: "private",
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    participants: [currentUserId, otherUserId],
    participantNames: [currentUserName, otherUserName],
  });

  // Add both users
  await addUserToConversation(conversationRef.id, currentUserId, currentUserName, false);
  await addUserToConversation(conversationRef.id, otherUserId, otherUserName, false);

  return conversationRef.id;
}

/**
 * Add member to group (admin only)
 */
export async function addMemberToGroup(
  conversationId: string,
  newMemberId: string,
  newMemberName: string
): Promise<void> {
  const currentUserId = getCurrentUserId();
  const conv = await getConversation(conversationId);

  if (!conv || !conv.admins?.includes(currentUserId)) return;

  const existingIds = conv.memberIds || [];
  if (existingIds.includes(newMemberId)) return;

  await updateDoc(doc(db, "conversations", conversationId), {
    memberIds: arrayUnion(newMemberId),
    memberNames: arrayUnion(newMemberName),
    updatedAt: serverTimestamp(),
  });

  await addUserToConversation(conversationId, newMemberId, newMemberName, conv.isAutoCreated ?? false);
}

/**
 * Remove member from group (admin only)
 */
export async function removeMemberFromGroup(
  conversationId: string,
  memberId: string
): Promise<void> {
  const currentUserId = getCurrentUserId();
  const conv = await getConversation(conversationId);

  if (!conv || !conv.admins?.includes(currentUserId)) return;

  await updateDoc(doc(db, "conversations", conversationId), {
    memberIds: arrayRemove(memberId),
    updatedAt: serverTimestamp(),
  });

  // Remove user's conversation tracking
  await deleteDoc(
    doc(db, "user_conversations", memberId, "conversations", conversationId)
  );
}

/**
 * Leave a group
 */
export async function leaveGroup(conversationId: string): Promise<void> {
  const currentUserId = getCurrentUserId();

  await updateDoc(doc(db, "conversations", conversationId), {
    memberIds: arrayRemove(currentUserId),
    updatedAt: serverTimestamp(),
  });

  await deleteDoc(
    doc(db, "user_conversations", currentUserId, "conversations", conversationId)
  );
}

// ==================== MESSAGES ====================

/**
 * Subscribe to messages in a conversation (real-time)
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
): () => void {
  const q = query(
    collection(db, "messages"),
    where("conversationId", "==", conversationId),
    orderBy("timestamp", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Message
    );
    callback(messages);
  });
}

/**
 * Send a text message
 */
export async function sendMessage(
  conversationId: string,
  text: string,
  type: "text" | "image" | "file" | "call" = "text",
  imageUrl?: string,
  mentions?: string[]
): Promise<void> {
  const currentUserId = getCurrentUserId();
  const currentUserName = getCurrentUserName();

  const messageData: Record<string, any> = {
    conversationId,
    senderId: currentUserId,
    senderName: currentUserName,
    text,
    type,
    timestamp: serverTimestamp(),
    isRead: false,
    readBy: [currentUserId],
  };

  // Only add imageUrl if provided
  if (imageUrl) {
    messageData.imageUrl = imageUrl;
  }
  
  if (mentions && mentions.length > 0) {
    messageData.mentions = mentions;
  }

  // Add message
  await addDoc(collection(db, "messages"), messageData);

  // Update conversation's lastMessage
  let lastMessageText = text;
  if (type === "image") lastMessageText = "[Gambar]";
  if (type === "file") lastMessageText = `\uD83D\uDCC4 ${imageUrl || 'File'}`; // We use imageUrl as fileName

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: {
      text: lastMessageText.length > 50
        ? `${lastMessageText.substring(0, 50)}...`
        : lastMessageText,
      senderId: currentUserId,
      senderName: currentUserName,
      timestamp: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  // Update user_conversations for all members
  const convDoc = await getDoc(doc(db, "conversations", conversationId));
  if (convDoc.exists()) {
    const data = convDoc.data();
    let members: string[] = [];
    if (data.type === "private") {
      members = data.participants || [];
    } else {
      members = data.memberIds || [];
    }
    
    // We can't use batch here if there are many, but Promise.all is fine
    const updatePromises = members.map((memberId: string) => {
      const isSender = memberId === currentUserId;
      return setDoc(
        doc(db, "user_conversations", memberId, "conversations", conversationId),
        {
          lastMessage: lastMessageText,
          updatedAt: serverTimestamp(),
          ...(!isSender ? { unreadCount: increment(1) } : {})
        },
        { merge: true }
      );
    });
    
    await Promise.all(updatePromises);
  }
}

/**
 * Mark messages as read
 */
export async function markAsRead(conversationId: string): Promise<void> {
  const currentUserId = getCurrentUserId();

  // Get unread messages not from current user
  const q = query(
    collection(db, "messages"),
    where("conversationId", "==", conversationId),
    where("senderId", "!=", currentUserId),
    where("isRead", "==", false)
  );

  const snapshot = await getDocs(q);
  const batch: Promise<void>[] = [];

  snapshot.docs.forEach((docSnap) => {
    batch.push(
      updateDoc(doc(db, "messages", docSnap.id), {
        isRead: true,
        readBy: arrayUnion(currentUserId),
      })
    );
  });

  await Promise.all(batch);

  // Reset unread count
  await setDoc(
    doc(db, "user_conversations", currentUserId, "conversations", conversationId),
    { unreadCount: 0 },
    { merge: true }
  );
}

// ==================== USERS ====================

/**
 * Search users by name or email
 */
export async function searchUsers(searchQuery: string): Promise<ChatUser[]> {
  if (!searchQuery.trim()) return [];

  try {
    const snapshot = await getDocs(
      query(collection(db, "users"))
    );

    const lowerQuery = searchQuery.toLowerCase();
    return snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        name: doc.data().name || "",
        email: doc.data().email || "",
        photoUrl: doc.data().photoUrl,
        role: doc.data().role || "",
        department: doc.data().department || "",
        section: doc.data().section || "",
        division: doc.data().division || "",
        isActive: doc.data().isActive ?? true,
      }))
      .filter(
        (user) =>
          user.name.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10);
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}

/**
 * Get all active users
 */
export async function getAllUsers(): Promise<ChatUser[]> {
  const currentUserId = getCurrentUserId();
  const snapshot = await getDocs(
    query(collection(db, "users"), where("isActive", "==", true))
  );

  return snapshot.docs
    .map((doc) => ({
      uid: doc.id,
      name: doc.data().name || "",
      email: doc.data().email || "",
      photoUrl: doc.data().photoUrl,
      role: doc.data().role || "",
      department: doc.data().department || "",
      section: doc.data().section || "",
      division: doc.data().division || "",
      isActive: doc.data().isActive ?? true,
    }))
    .filter((user) => user.uid !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get user by ID
 */
export async function getUserById(uid: string): Promise<ChatUser | null> {
  const docSnap = await getDoc(doc(db, "users", uid));
  if (docSnap.exists()) {
    return {
      uid: docSnap.id,
      name: docSnap.data().name || "",
      email: docSnap.data().email || "",
      photoUrl: docSnap.data().photoUrl,
      role: docSnap.data().role || "",
      department: docSnap.data().department || "",
      section: docSnap.data().section || "",
      division: docSnap.data().division || "",
      isActive: docSnap.data().isActive ?? true,
    };
  }
  return null;
}


/**
 * Delete a conversation (creator/admin only)
 * Removes: conversation doc, all messages, all user_conversations references
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const conv = await getConversation(conversationId);
  if (!conv) throw new Error("Percakapan tidak ditemukan");

  const currentUserId = getCurrentUserId();

  if (conv.type === "private") {
    // For private chats, ONLY delete it from the current user's list (like WhatsApp)
    await deleteDoc(
      doc(db, "user_conversations", currentUserId, "conversations", conversationId)
    );
    return;
  }

  // For groups (if admin), delete completely for everyone
  const messagesSnapshot = await getDocs(
    query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId)
    )
  );
  const deleteBatch: Promise<void>[] = [];
  messagesSnapshot.docs.forEach((docSnap) => {
    deleteBatch.push(deleteDoc(doc(db, "messages", docSnap.id)));
  });
  await Promise.all(deleteBatch);

  const memberIds = conv.memberIds || [];
  for (const uid of memberIds) {
    try {
      await deleteDoc(
        doc(db, "user_conversations", uid, "conversations", conversationId)
      );
    } catch {
      // Ignore if already removed
    }
  }

  await deleteDoc(doc(db, "conversations", conversationId));
}

/**
 * Remove conversation from current user's list only (archive/hide)
 */
export async function archiveConversation(conversationId: string): Promise<void> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) throw new Error("User tidak ditemukan");

  // Remove from user's conversation list
  await deleteDoc(
    doc(db, "user_conversations", currentUserId, "conversations", conversationId)
  );

  // If group, also remove from memberIds
  const conv = await getConversation(conversationId);
  if (conv && conv.type === "group") {
    await updateDoc(doc(db, "conversations", conversationId), {
      memberIds: arrayRemove(currentUserId),
      updatedAt: serverTimestamp(),
    });
  }
}
