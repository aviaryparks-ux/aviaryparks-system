import { FirebaseTimestamp } from "./chat";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "action";
  isRead: boolean;
  createdAt: FirebaseTimestamp;
  link?: string; // Optional URL to navigate to when clicked
  metadata?: any;
}
