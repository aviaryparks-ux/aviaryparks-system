import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { AppNotification } from "../../types/notification";

// Helper to get current user ID
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

/**
 * Subscribe to current user's notifications in real-time
 */
export function subscribeToNotifications(
  callback: (notifications: AppNotification[]) => void
): () => void {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    callback([]);
    return () => {};
  }

  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("userId", "==", currentUserId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const results: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        results.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as AppNotification);
      });
      callback(results);
    },
    (error) => {
      console.error("Error subscribing to notifications:", error);
      callback([]);
    }
  );
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  const docRef = doc(db, "notifications", notificationId);
  await updateDoc(docRef, { isRead: true });
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;

  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("userId", "==", currentUserId),
    where("isRead", "==", false)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.update(docSnap.ref, { isRead: true });
  });

  await batch.commit();
}
