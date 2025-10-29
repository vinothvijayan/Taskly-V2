// src/components/mobile/ChatMessageNotifier.tsx

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rtdb, db } from '@/lib/firebase';
import { ref, onChildAdded, off, query as rtdbQuery, orderByChild, startAt } from 'firebase/database'; 
import { collection, where, onSnapshot, Unsubscribe, Query, DocumentData, CollectionReference, query } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { getSafeNotificationId } from '@/lib/notificationId';
import { useTeamChat } from '@/contexts/TeamChatContext';
import { toast } from 'sonner';
import { ChatMessageToast } from '@/components/ui/ChatMessageToast';
import { ChatMessage } from '@/types';

/**
 * A headless component that monitors for new team chat messages and sends 
 * local notifications, updates unread counts, and shows toasts.
 */
export function ChatMessageNotifier() {
  const { user } = useAuth();
  const { incrementUnreadCount } = useTeamChat();
  const rtdbUnsubscribers = useRef<Map<string, () => void>>(new Map());
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!user) {
      cleanupListeners();
      return;
    }

    const chatRoomsCollectionRef: CollectionReference<DocumentData> = collection(db, 'chatRooms');
    const chatRoomsQuery: Query<DocumentData> = query(
      chatRoomsCollectionRef,
      where('participants', 'array-contains', user.uid)
    );

    firestoreUnsubscribeRef.current = onSnapshot(chatRoomsQuery, (snapshot) => {
      const currentChatRoomIds = new Set<string>();
      snapshot.forEach(doc => {
        currentChatRoomIds.add(doc.id);
      });

      // Clean up listeners for rooms the user is no longer part of
      rtdbUnsubscribers.current.forEach((unsub, chatRoomId) => {
        if (!currentChatRoomIds.has(chatRoomId)) {
          unsub();
          rtdbUnsubscribers.current.delete(chatRoomId);
        }
      });

      // Set up listeners for new rooms
      currentChatRoomIds.forEach(chatRoomId => {
        if (!rtdbUnsubscribers.current.has(chatRoomId)) {
          const messagesQuery = rtdbQuery(
            ref(rtdb, `chats/${chatRoomId}/messages`),
            orderByChild('timestamp'),
            startAt(Date.now()) // <-- This is the key fix: only listen for messages from now on
          );
          
          const messageUnsubscribe = onChildAdded(messagesQuery, (messagesSnapshot) => {
            const messageData = messagesSnapshot.val();
            const messageId = messagesSnapshot.key;

            if (!messageId || !messageData) return;

            const message = { id: messageId, ...messageData } as ChatMessage;
            
            // Ignore own messages
            if (message.senderId === user.uid) {
              return;
            }

            // --- This is a new message from someone else ---

            // 1. Increment unread count for the badge
            incrementUnreadCount(chatRoomId);

            // 2. Show the custom toast notification
            toast.custom((t) => (
              <ChatMessageToast
                senderName={message.senderName}
                senderAvatarUrl={message.senderAvatar}
                messagePreview={message.message}
                onDismiss={() => toast.dismiss(t)}
              />
            ));

            // 3. Schedule native/PWA notification for when the app is in the background
            const notificationTitle = `New message from ${message.senderName}`;
            const notificationBody = message.message.length > 100 ? `${message.message.substring(0, 100)}...` : message.message;
            const notificationId = getSafeNotificationId(message.timestamp);

            if (Capacitor.isNativePlatform()) {
              import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                LocalNotifications.schedule({
                  notifications: [{
                    id: notificationId,
                    title: notificationTitle,
                    body: notificationBody,
                    schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
                    channelId: 'app_main_channel',
                    extra: {
                      type: 'chat_message',
                      senderId: message.senderId,
                      chatRoomId: chatRoomId,
                    }
                  }]
                }).catch(error => {
                  console.error('Failed to schedule native chat notification:', error);
                });
              });
            } else {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notificationTitle, {
                  body: notificationBody,
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
                  tag: `chat-message-${message.id}`,
                  data: {
                    type: 'chat_message',
                    senderId: message.senderId,
                    chatRoomId: chatRoomId,
                  },
                  requireInteraction: false,
                  vibrate: [100, 50, 100]
                } as any);
              }
            }
          });
          rtdbUnsubscribers.current.set(chatRoomId, () => off(messagesQuery, 'child_added', messageUnsubscribe));
        }
      });
    });

    return () => {
      cleanupListeners();
    };
  }, [user, incrementUnreadCount]);

  const cleanupListeners = () => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }
    rtdbUnsubscribers.current.forEach(unsub => unsub());
    rtdbUnsubscribers.current.clear();
  };

  return null;
}