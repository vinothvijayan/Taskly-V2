import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TasksContext";
import { rtdb } from "@/lib/firebase";
import { ref, onValue, off, set, push, serverTimestamp, update } from "firebase/database";
import { ChatMessage, ChatRoom, UserProfile } from "@/types";

interface OnlineStatus {
  [userId: string]: {
    online: boolean;
    lastSeen: number;
  };
}

interface UnreadCounts {
  [chatRoomId: string]: number;
}

interface MessageStatus {
  [messageId: string]: {
    delivered: boolean;
    read: boolean;
    readAt?: number;
  };
}

interface TeamChatContextType {
  onlineStatus: OnlineStatus;
  unreadCounts: UnreadCounts;
  messageStatus: MessageStatus;
  totalUnreadCount: number;
  markMessageAsRead: (chatRoomId: string, messageId: string) => Promise<void>;
  markChatAsRead: (chatRoomId: string) => Promise<void>;
  markMessagesAsReadBatch: (chatRoomId: string, messageIds: string[]) => Promise<void>;
  updateOnlineStatus: (online: boolean) => Promise<void>;
  incrementUnreadCount: (chatRoomId: string) => void;
  clearUnreadCount: (chatRoomId: string) => void;
}

const TeamChatContext = createContext<TeamChatContextType | undefined>(undefined);

export function TeamChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { teamMembers } = useTasks();
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({});
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [messageStatus, setMessageStatus] = useState<MessageStatus>({});

  const incrementUnreadCount = (chatRoomId: string) => {
    console.log(`[DEBUG] TeamChatContext: incrementUnreadCount called for room ${chatRoomId}`);
    setUnreadCounts(prev => {
      const newCount = (prev[chatRoomId] || 0) + 1;
      console.log(`[DEBUG] TeamChatContext: Unread count for ${chatRoomId} is now ${newCount}`);
      return {
        ...prev,
        [chatRoomId]: newCount,
      };
    });
  };

  const clearUnreadCount = (chatRoomId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [chatRoomId]: 0,
    }));
  };

  // Update user's online status
  const updateOnlineStatus = async (online: boolean) => {
    if (!user) return;
    
    try {
      const statusRef = ref(rtdb, `presence/${user.uid}`);
      await set(statusRef, {
        online,
        lastSeen: Date.now()
      });
    } catch (error) {
      console.error("Error updating online status:", error);
    }
  };

  // Set up presence system
  useEffect(() => {
    if (!user) return;

    // Set user online when component mounts
    updateOnlineStatus(true);

    // Set user offline when they leave
    const handleBeforeUnload = () => {
      updateOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also handle page visibility changes
    const handleVisibilityChange = () => {
      updateOnlineStatus(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      updateOnlineStatus(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Listen to team members' online status
  useEffect(() => {
    if (!teamMembers.length) return;

    const unsubscribers: (() => void)[] = [];

    teamMembers.forEach((member) => {
      const statusRef = ref(rtdb, `presence/${member.uid}`);
      
      const unsubscribe = onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setOnlineStatus(prev => ({
            ...prev,
            [member.uid]: {
              online: data.online || false,
              lastSeen: data.lastSeen || Date.now()
            }
          }));
        }
      });

      unsubscribers.push(() => off(statusRef));
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [teamMembers]);

  // Calculate total unread count
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    console.log(`[DEBUG] TeamChatContext: Total unread count updated to: ${totalUnreadCount}`);
  }, [totalUnreadCount]);

  // Mark a specific message as read
  const markMessageAsRead = async (chatRoomId: string, messageId: string) => {
    if (!user) return;
    
    try {
      const statusRef = ref(rtdb, `messageStatus/${chatRoomId}/${messageId}/${user.uid}`);
      await set(statusRef, {
        read: true,
        readAt: Date.now()
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  // Mark multiple messages as read in a single batch operation
  const markMessagesAsReadBatch = async (chatRoomId: string, messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;
    
    try {
      const updates: { [path: string]: any } = {};
      const readData = {
        read: true,
        readAt: Date.now()
      };

      messageIds.forEach(messageId => {
        updates[`messageStatus/${chatRoomId}/${messageId}/${user.uid}`] = readData;
      });

      await update(ref(rtdb), updates);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Mark entire chat as read
  const markChatAsRead = async (chatRoomId: string) => {
    if (!user) return;
    
    try {
      clearUnreadCount(chatRoomId);

      const messagesRef = ref(rtdb, `chats/${chatRoomId}/messages`);
      onValue(messagesRef, async (snapshot) => {
        const messages = snapshot.val();
        if (messages) {
          const unreadMessageIds = Object.entries(messages)
            .filter(([id, msg]: [string, any]) => msg.senderId !== user.uid)
            .map(([id]) => id);
          
          if (unreadMessageIds.length > 0) {
            await markMessagesAsReadBatch(chatRoomId, unreadMessageIds);
          }
        }
      }, { onlyOnce: true });
    } catch (error) {
      console.error("Error marking chat as read:", error);
    }
  };

  const value = {
    onlineStatus,
    unreadCounts,
    messageStatus,
    totalUnreadCount,
    markMessageAsRead,
    markChatAsRead,
    markMessagesAsReadBatch,
    updateOnlineStatus,
    incrementUnreadCount,
    clearUnreadCount,
  };

  return (
    <TeamChatContext.Provider value={value}>
      {children}
    </TeamChatContext.Provider>
  );
}

export function useTeamChat() {
  const context = useContext(TeamChatContext);
  if (context === undefined) {
    throw new Error("useTeamChat must be used within a TeamChatProvider");
  }
  return context;
}