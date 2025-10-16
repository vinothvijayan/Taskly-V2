// src/components/mobile/ChatMessageNotifier.tsx

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rtdb, db } from '@/lib/firebase';
// Change 1: Aliased the RTDB query function to `rtdbQuery`
import { ref, onChildAdded, off, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database'; 
import { unifiedNotificationService } from '@/lib/unifiedNotificationService';
// Change 2: Imported the `query` function from Firestore
import { collection, where, onSnapshot, Unsubscribe, Query, DocumentData, CollectionReference, query } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { getSafeNotificationId } from '@/lib/notificationId'; // Import the new helper

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  chatId?: string; // Optional, as it might be derived from chatRoomId
}

/**
 * A headless component that monitors for new team chat messages and sends 
 * local notifications to the user when they receive messages from other team members.
 */
export function ChatMessageNotifier() {
  const { user } = useAuth();
  // Use a Map to store the last seen timestamp for each chat room
  const lastSeenPerRoom = useRef<Map<string, number>>(new Map());
  const rtdbUnsubscribers = useRef<Map<string, () => void>>(new Map());
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!user) {
      // Clear all listeners and state if user logs out
      cleanupListeners();
      lastSeenPerRoom.current.clear();
      return;
    }

    // Initialize unified notification service (ensures Capacitor/Web APIs are ready)
    unifiedNotificationService.init();

    // Firestore listener for chat rooms the user is a participant in
    const chatRoomsCollectionRef: CollectionReference<DocumentData> = collection(db, 'chatRooms');
    // This line is now correct because `query` resolves to the firestore import
    const chatRoomsQuery: Query<DocumentData> = query(
      chatRoomsCollectionRef,
      where('participants', 'array-contains', user.uid)
    );

    firestoreUnsubscribeRef.current = onSnapshot(chatRoomsQuery, (snapshot) => {
      const currentChatRoomIds = new Set<string>();
      snapshot.forEach(doc => {
        currentChatRoomIds.add(doc.id);
      });

      // Unsubscribe from RTDB listeners for chat rooms the user is no longer in
      rtdbUnsubscribers.current.forEach((unsub, chatRoomId) => {
        if (!currentChatRoomIds.has(chatRoomId)) {
          unsub();
          rtdbUnsubscribers.current.delete(chatRoomId);
          lastSeenPerRoom.current.delete(chatRoomId); // Also clear last seen for removed rooms
        }
      });

      // Set up new RTDB listeners for new chat rooms
      currentChatRoomIds.forEach(chatRoomId => {
        if (!rtdbUnsubscribers.current.has(chatRoomId)) {
          // Query for messages ordered by timestamp, limiting to the last few
          // This helps catch recent messages if the app was briefly offline
          
          // Change 3: Used the `rtdbQuery` alias for the Realtime Database query
          const messagesQuery = rtdbQuery(
            ref(rtdb, `chats/${chatRoomId}/messages`),
            orderByChild('timestamp'),
            limitToLast(10) // Adjust as needed to catch recent messages
          );
          
          // Use onChildAdded to listen for new messages
          const messageUnsubscribe = onChildAdded(messagesQuery, (messagesSnapshot) => {
            const messageData = messagesSnapshot.val();
            const messageId = messagesSnapshot.key;

            if (!messageId || !messageData) return;

            const message = { id: messageId, ...messageData } as ChatMessage;
            
            // Only process messages from other users
            if (message.senderId === user.uid) {
              // Update last seen for own messages too, to avoid notifying on them later
              lastSeenPerRoom.current.set(chatRoomId, message.timestamp);
              return;
            }

            // Check if this message is newer than the last one we processed for this room
            const lastSeenTimestamp = lastSeenPerRoom.current.get(chatRoomId) || 0;
            if (message.timestamp <= lastSeenTimestamp) {
              // This message was already seen or is older than the last processed message
              return;
            }

            // Update last seen timestamp for this room
            lastSeenPerRoom.current.set(chatRoomId, message.timestamp);

            // Schedule notification for both platforms
            const notificationTitle = `New message from ${message.senderName}`;
            const notificationBody = message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content;
            const notificationId = getSafeNotificationId(message.timestamp); // Use message timestamp as seed

            if (Capacitor.isNativePlatform()) {
              import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                LocalNotifications.schedule({
                  notifications: [{
                    id: notificationId, // Use the safe ID
                    title: notificationTitle,
                    body: notificationBody,
                    schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true }, // Show almost immediately
                    channelId: 'app_main_channel', // Use the main channel created in App.tsx
                    extra: {
                      type: 'chat_message',
                      senderId: message.senderId,
                      chatRoomId: chatRoomId, // Pass the chat room ID for navigation
                    }
                  }]
                }).catch(error => {
                  console.error('Failed to schedule native chat notification:', error);
                });
              });
            } else {
              // Web notification (browser Notification API)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notificationTitle, {
                  body: notificationBody,
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
                  tag: `chat-message-${message.id}`, // Use message ID as tag for web
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

    // Cleanup function for the main Firestore listener
    return () => {
      cleanupListeners();
    };
  }, [user]);

  // Helper to clean up all listeners
  const cleanupListeners = () => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }
    rtdbUnsubscribers.current.forEach(unsub => unsub());
    rtdbUnsubscribers.current.clear();
  };

  // This is a utility component, so it renders nothing.
  return null;
}