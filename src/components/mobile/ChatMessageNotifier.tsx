// src/components/mobile/ChatMessageNotifier.tsx

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rtdb, db } from '@/lib/firebase';
import { ref, onChildAdded, off, query as rtdbQuery, orderByChild, startAt, onValue, limitToLast } from 'firebase/database'; 
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

      // Cleanup listeners for removed chat rooms
      rtdbUnsubscribers.current.forEach((unsub, chatRoomId) => {
        if (!currentChatRoomIds.has(chatRoomId)) {
          unsub();
          rtdbUnsubscribers.current.delete(chatRoomId);
        }
      });

      // Add listeners for new chat rooms
      currentChatRoomIds.forEach(chatRoomId => {
        if (!rtdbUnsubscribers.current.has(chatRoomId)) {
          
          // --- NEW, MORE ROBUST LOGIC ---
          const messagesRef = ref(rtdb, `chats/${chatRoomId}/messages`);
          
          // 1. Get the timestamp of the last known message to avoid notifying for old messages.
          const lastMessageQuery = rtdbQuery(messagesRef, orderByChild('timestamp'), limitToLast(1));
          
          onValue(lastMessageQuery, (lastMessageSnapshot) => {
            let lastTimestamp = Date.now() - 1000; // Default to 1 second ago to be safe
            if (lastMessageSnapshot.exists()) {
              const lastMessageData = lastMessageSnapshot.val();
              const lastMessageKey = Object.keys(lastMessageData)[0];
              lastTimestamp = lastMessageData[lastMessageKey].timestamp;
            }

            // 2. Now, listen ONLY for messages added AFTER that timestamp.
            const newMessagesQuery = rtdbQuery(messagesRef, orderByChild('timestamp'), startAt(lastTimestamp + 1));
            
            const messageUnsubscribe = onChildAdded(newMessagesQuery, (messageSnapshot) => {
              const messageData = messageSnapshot.val();
              const messageId = messageSnapshot.key;

              if (!messageId || !messageData) return;

              const message = { id: messageId, ...messageData } as ChatMessage;
              
              // Don't notify for your own messages unless it's a self-chat
              const isSelfChat = chatRoomId.split('_')[0] === chatRoomId.split('_')[1];
              if (message.senderId === user.uid && !isSelfChat) {
                return;
              }

              // This is a genuinely new message. Trigger notifications.
              incrementUnreadCount(chatRoomId);

              toast.custom((t) => (
                <ChatMessageToast
                  senderName={message.senderName}
                  senderAvatarUrl={message.senderAvatar}
                  messagePreview={message.message}
                  onDismiss={() => toast.dismiss(t)}
                />
              ));

              // Schedule native/PWA notification for when the app is in the background
              // (This part is unchanged and correct)
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
                      extra: { type: 'chat_message', senderId: message.senderId, chatRoomId: chatRoomId }
                    }]
                  }).catch(error => console.error('Failed to schedule native chat notification:', error));
                });
              } else {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: '/icon-192x192.png',
                    badge: '/icon-192x192.png',
                    tag: `chat-message-${message.id}`,
                    data: { type: 'chat_message', senderId: message.senderId, chatRoomId: chatRoomId },
                    requireInteraction: false,
                    vibrate: [100, 50, 100]
                  } as any);
                }
              }
            });

            rtdbUnsubscribers.current.set(chatRoomId, () => off(newMessagesQuery, 'child_added', messageUnsubscribe));

          }, { onlyOnce: true }); // This onValue runs only once to get the starting point.
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