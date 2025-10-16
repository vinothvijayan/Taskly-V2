import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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

  // Set up real-time listener when user changes
  useEffect(() => {
    if (user) {
      setupRealtimeListener();
    } else {
      setNotifications([]);
    }
  }, [user]);

  const setupRealtimeListener = () => {
    if (!user) return;

    console.log("Setting up notifications real-time listener for user:", user.uid);
    
    setLoading(true);
    
    const notificationsQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        console.log("Notifications snapshot received, size:", snapshot.size);
        const notificationsList: AppNotification[] = [];
        snapshot.forEach(doc => {
          notificationsList.push({ id: doc.id, ...doc.data() } as AppNotification);
        });
        
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
    
    // Cleanup function
    return () => {
      console.log("Cleaning up notifications listener");
      unsubscribe();
    };
  };

  const addNotification = async (notificationData: Omit<AppNotification, "id" | "userId" | "timestamp">, targetUserId?: string) => {
    // Use targetUserId if provided, otherwise use current user
    const userId = targetUserId || user?.uid;
    
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

      console.log("Adding notification for user:", userId, newNotification);
      await addDoc(notificationsRef, newNotification);
      console.log("Notification added successfully");
    } catch (error) {
      console.error("Error adding notification:", error);
      toast({
        title: "Failed to save notification",
        description: "Could not save the notification.",
        variant: "destructive"
      });
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const notificationRef = doc(db, 'users', user.uid, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
      console.log("Notification marked as read:", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.read);
      
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'users', user.uid, 'notifications', notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      console.log("All notifications marked as read");
      
      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been cleared.",
      });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      toast({
        title: "Failed to mark notifications as read",
        description: "Could not update notifications.",
        variant: "destructive"
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const notificationRef = doc(db, 'users', user.uid, 'notifications', notificationId);
      await deleteDoc(notificationRef);
      console.log("Notification deleted:", notificationId);
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Failed to delete notification",
        description: "Could not delete the notification.",
        variant: "destructive"
      });
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      
      notifications.forEach(notification => {
        const notificationRef = doc(db, 'users', user.uid, 'notifications', notification.id);
        batch.delete(notificationRef);
      });

      await batch.commit();
      console.log("All notifications cleared");
      
      toast({
        title: "All notifications cleared",
        description: "Your notification history has been cleared.",
      });
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      toast({
        title: "Failed to clear notifications",
        description: "Could not clear notifications.",
        variant: "destructive"
      });
    }
  };

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