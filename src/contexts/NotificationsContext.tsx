import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  onSnapshot,
  where,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { AppNotification } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Omit<AppNotification, "id" | "userId" | "timestamp">, targetUserId?: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsContextProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const notificationsQuery = query(
        collection(db, 'users', user.uid, 'notifications'),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notificationsList: AppNotification[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
          setNotifications(notificationsList);
          setLoading(false);
        },
        (error) => {
          console.error("Error in notifications listener:", error);
          toast({
            title: "Connection error",
            description: "Lost connection to notifications. Retrying...",
            variant: "destructive"
          });
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    } else {
      setNotifications([]);
    }
  }, [user, toast]);

  const addNotification = useCallback(async (notificationData: Omit<AppNotification, "id" | "userId" | "timestamp">, targetUserId?: string) => {
    const userId = targetUserId || auth.currentUser?.uid;
    
    if (!userId) {
      console.warn("Cannot add notification: no target user specified and current user not authenticated");
      return;
    }

    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const newNotification = {
        ...notificationData,
        userId: userId,
        timestamp: new Date().toISOString()
      };
      await addDoc(notificationsRef, newNotification);
    } catch (error) {
      console.error("Error adding notification:", error);
      toast({
        title: "Failed to save notification",
        description: "Could not save the notification.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!auth.currentUser) return;
    try {
      const notificationRef = doc(db, 'users', auth.currentUser.uid, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const batch = writeBatch(db);
      const unreadQuery = query(collection(db, 'users', auth.currentUser.uid, 'notifications'), where('read', '==', false));
      const snapshot = await getDocs(unreadQuery);
      snapshot.forEach(doc => batch.update(doc.ref, { read: true }));
      await batch.commit();
      toast({ title: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    }
  }, [toast]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!auth.currentUser) return;
    try {
      const notificationRef = doc(db, 'users', auth.currentUser.uid, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({ title: "Failed to delete notification", variant: "destructive" });
    }
  }, [toast]);

  const clearAllNotifications = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const batch = writeBatch(db);
      const allQuery = query(collection(db, 'users', auth.currentUser.uid, 'notifications'));
      const snapshot = await getDocs(allQuery);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: "All notifications cleared" });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast({ title: "Failed to clear notifications", variant: "destructive" });
    }
  }, [toast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationsContextProvider");
  }
  return context;
}