// Chat Feature Types for Next.js Web Admin Panel
// Must be synchronized with Flutter models

export interface LastMessage {
  text: string;
  senderId: string;
  senderName: string;
  timestamp: FirebaseTimestamp;
}

export interface FirebaseTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

export interface Conversation {
  id: string;
  type: "group" | "private";
  name: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
  lastMessage?: LastMessage;
  // For private chats
  participants?: string[];
  participantNames?: string[];
  // For group chats
  memberIds?: string[];
  memberNames?: string[];
  departmentId?: string;
  isAutoCreated?: boolean;
  admins?: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  text: string;
  type: "text" | "image";
  imageUrl?: string;
  timestamp: FirebaseTimestamp;
  isRead: boolean;
  readBy: string[];
}

export interface UserConversation {
  uid: string;
  conversationId: string;
  name: string;
  unreadCount: number;
  lastReadTimestamp?: FirebaseTimestamp;
  isMuted: boolean;
  isPinned: boolean;
  joinedAt: FirebaseTimestamp;
  isAutoCreated?: boolean;
}

export interface ChatUser {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  department?: string;
  section?: string;
  division?: string;
  isActive: boolean;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  avatarUrl?: string;
  memberIds: string[];
  memberNames: string[];
  departmentId?: string;
  isAutoCreated?: boolean;
}

export type TimestampValue = FirebaseTimestamp | {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
};
