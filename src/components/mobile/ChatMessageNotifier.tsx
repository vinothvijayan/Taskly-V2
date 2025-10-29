// src/components/mobile/ChatMessageNotifier.tsx

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rtdb, db } from '@/lib/firebase';
import { ref, onChildAdded, off, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database'; 
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
  const lastSeenPerRoom = useRef<Map<string, number>>(new Map());
  const rtdbUnsubscribers = useRef<Map<string, () => void>>(new Map());
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!user) {
      cleanupListeners();
      lastSeenPerRoom.current.clear();
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

      rtdbUnsubscribers.current.forEach((unsub, chatRoomId) => {
        if (!currentChatRoomIds.has(chatRoomId)) {
          unsub();
          rtdbUnsubscribers.current.delete(chatRoomId);
          lastSeenPerRoom.current.delete(chatRoomId);
        }
      });

      currentChatRoomIds.forEach(chatRoomId => {
        if (!rtdbUnsubscribers.current.has(chatRoomId)) {
          const messagesQuery = rtdbQuery(
            ref(rtdb, `chats/${chatRoomId}/messages`),
            orderByChild('timestamp'),
            limitToLast(10)
          );
          
          const messageUnsubscribe = onChildAdded(messagesQuery, (messagesSnapshot) => {
            const messageData = messagesSnapshot.val();
            const messageId = messagesSnapshot.key;

            if (!messageId || !messageData) return;

            const message = { id: messageId, ...messageData } as ChatMessage;
            
            if (message.senderId === user.uid) {
              lastSeenPerRoom.current.set(chatRoomId, message.timestamp);
              return;
            }

            const lastSeenTimestamp = lastSeenPerRoom.current.get(chatRoomId) || 0;
            if (message.timestamp <= lastSeenTimestamp) {
              return;
            }

            lastSeenPerRoom.current.set(chatRoomId, message.timestamp);

            // Increment unread count and show toast
            incrementUnreadCount(chatRoomId);
            toast.custom((t) => (
              <ChatMessageToast
                senderName={message.senderName}
                senderAvatarUrl={message.senderAvatar}
                messagePreview={message.message}
                onDismiss={() => toast.dismiss(t)}
              />
            ));

            // Schedule native/PWA notification
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