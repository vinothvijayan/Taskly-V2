// src/App.tsx

// React & Router Imports
import { useEffect, Suspense, lazy, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { initMsal } from "@/lib/microsoftauth";

// UI & Library Imports
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from '@capacitor/core';

// --- PUSH NOTIFICATION IMPORTS ---
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';

// App-specific Components & Pages
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageLoading } from "@/components/ui/loading-states";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute"; // Import AdminRoute
import { TaskAssignmentNotifier } from "@/components/mobile/TaskAssignmentNotifier";
import { ChatMessageNotifier } from "@/components/mobile/ChatMessageNotifier";
import { TeamChatProvider } from "@/contexts/TeamChatContext";
import { unifiedNotificationService } from "@/lib/unifiedNotificationService";
import { TeamInviteNotifier } from "@/components/mobile/TeamInviteNotifier";

// Context Providers
import { AuthContextProvider, useAuth } from "./contexts/AuthContext";
import { TasksContextProvider } from "@/contexts/TasksContext";
import { CommentsContextProvider } from "@/contexts/CommentsContext";
import { TaskTimeTrackerProvider } from "./contexts/TaskTimeTrackerContext";
import { NotificationsContextProvider, useNotifications } from "./contexts/NotificationsContext";
import { MeetlyContextProvider } from "@/contexts/MeetlyContext";
import { ConfettiProvider } from "@/contexts/ConfettiContext";
import { SalesOpportunityProvider } from "@/contexts/SalesOpportunityContext";
import { ContactsProvider } from "@/contexts/ContactsContext";
import { PictureInPictureProvider } from "@/contexts/PictureInPictureContext";

// Notification Services & Setup
import { setGlobalAddNotification } from "./lib/notifications";
import { createNotificationChannel } from './hooks/useNotificationPermission';
import { getSafeNotificationId } from './lib/notificationId'; // Import the new helper

// Lazy load page components
const SalesTrackerPage = lazy(() => import("./pages/SalesTrackerPage"));
const SalesOpportunityPage = lazy(() => import("./pages/SalesOpportunityPage"));
const SalesToolsPage = lazy(() => import("./pages/SalesToolsPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TeamChatPage = lazy(() => import("./pages/TeamChatPage"));
const MeetlyPage = lazy(() => import("./pages/MeetlyPage"));
const TimerPage = lazy(() => import("./pages/TimerPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const NotesPage = lazy(() => import("./pages/NotesPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Create QueryClient instance outside component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function NotificationSetup() {
  const { addNotification } = useNotifications();
  useEffect(() => {
    setGlobalAddNotification(addNotification);
    return () => setGlobalAddNotification(null);
  }, [addNotification]);
  return null;
}

const updateUserFCMToken = async (userId: string, token: string) => {
  if (!userId || !token) {
    console.error("updateUserFCMToken failed: userId or token is missing.");
    return;
  }
  try {
    console.log(`Attempting to save FCM token for user ${userId}...`);
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      fcmToken: token,
      lastUpdated: serverTimestamp()
    });
    console.log('SUCCESSFULLY saved FCM token to Firestore.');
  } catch (error) {
    console.error('CRITICAL ERROR saving FCM token to Firestore:', error);
  }
};

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fcmToken, setFcmToken] = useState<Token | null>(null);

  useEffect(() => {
    if (user && fcmToken) {
      console.log("User and FCM token are both available. Saving to Firestore.");
      updateUserFCMToken(user.uid, fcmToken.value);
    }
  }, [user, fcmToken]);

  useEffect(() => {
    // Enhanced notification setup for both platforms
    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        // Native platform setup
        await setupNativeNotifications();
      } else {
        // Web platform setup
        await setupWebNotifications();
      }
    };

    setupNotifications();
  }, [navigate]);

  const setupNativeNotifications = async () => {
    try {
      createNotificationChannel(); // Ensure channel is created
      const listenerHandles: PluginListenerHandle[] = [];

      // Request permissions for push notifications
      await PushNotifications.requestPermissions();
      await PushNotifications.register();

      listenerHandles.push(
        await PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success. Received token.');
          setFcmToken(token);
        })
      );

      listenerHandles.push(
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration FAILED:', error);
        })
      );
      
      listenerHandles.push(
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('SILENT/DATA-ONLY Push received:', notification);
          // Add detailed logging for chat messages
          if (notification.data?.type === 'chat_message') { console.log('Chat message push data:', notification.data); }
          
          let title = notification.data?.title || 'New Notification';
          let body = notification.data?.body || 'Check the app for details.';
          
          // Custom handling for chat messages
          if (notification.data?.type === 'chat_message') {
            const senderName = notification.data?.senderName || 'Someone';
            const messageContent = notification.data?.message || 'New chat message.';
            title = `New message from ${senderName}`;
            body = messageContent;
            console.log(`Constructed local notification: Title='${title}', Body='${body}'`);
          }

          LocalNotifications.schedule({
            notifications: [{
              id: getSafeNotificationId(), // Use getSafeNotificationId()
              title: title,
              body: body,
              schedule: { at: new Date(), allowWhileIdle: true },
              channelId: 'app_main_channel',
              extra: notification.data,
            }]
          });
        })
      );

      listenerHandles.push(
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push notification action performed:', action);
          const taskId = action.notification.data?.taskId;
          if (taskId) {
            navigate(`/tasks?taskId=${taskId}`);
          }
        })
      );

      listenerHandles.push(
        await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          console.log('Local notification action performed:', notification);
          
          const extra = notification.notification.extra;
          if (extra?.taskId) {
            navigate('/tasks');
          } else if (extra?.type === 'chat_message') {
            navigate('/team-chat');
          } else if (extra?.type === 'team_invite') {
            navigate('/dashboard');
          }
        })
      );

      return () => {
        console.log("Removing all push notification listeners...");
        listenerHandles.forEach(handle => {
          try {
            handle.remove();
          } catch (error) {
            console.warn("Failed to remove listener handle:", error);
          }
        });
      };
    } catch (error) {
      console.error("Failed to setup native notifications:", error);
    }
  };

  const setupWebNotifications = async () => {
    try {
      // Initialize unified notification service for web
      await unifiedNotificationService.init();
      
      // Request notification permission if not already granted
      if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log('Web notification permission:', permission);
      }
      
      // Setup service worker message listeners for web notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'NOTIFICATION_ACTION') {
            const { action, notificationData } = event.data;
            
            if (notificationData?.taskId) {
              navigate('/tasks');
            } else if (notificationData?.type === 'chat_message') {
              navigate('/team-chat');
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to setup web notifications:", error);
    }
  };

  // Legacy effect for backward compatibility - can be removed
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    createNotificationChannel();
    const listenerHandles: PluginListenerHandle[] = [];

    const setupPushNotifications = async () => {
      try {
        await PushNotifications.requestPermissions();
        await PushNotifications.register();

        listenerHandles.push(
          await PushNotifications.addListener('registration', (token) => {
            console.log('Push registration success. Received token.');
            setFcmToken(token);
          })
        );

        listenerHandles.push(
          await PushNotifications.addListener('registrationError', (error) => {
            console.error('Push registration FAILED:', error);
          })
        );
        
        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('SILENT/DATA-ONLY Push received:', notification);
            
            const title = notification.data?.title || 'New Notification';
            const body = notification.data?.body || 'Check the app for details.';

            LocalNotifications.schedule({
              notifications: [{
                id: getSafeNotificationId(), // Use getSafeNotificationId()
                title: title,
                body: body,
                schedule: { at: new Date(), allowWhileIdle: true },
                channelId: 'app_main_channel',
                extra: notification.data,
              }]
            });
          })
        );

        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('Push notification action performed:', action);
            const taskId = action.notification.data?.taskId;
            if (taskId) {
              navigate(`/tasks?taskId=${taskId}`);
            }
          })
        );

        listenerHandles.push(
          await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            console.log('Local notification action performed:', notification);
            
            const extra = notification.notification.extra;
            if (extra?.taskId) {
              navigate('/tasks');
            } else if (extra?.type === 'chat_message') {
              navigate('/chat');
            } else if (extra?.type === 'team_invite') {
              navigate('/dashboard');
            }
          })
        );

      } catch (error) {
        console.error("Failed to setup push notifications:", error);
      }
    };

    setupPushNotifications();
    unifiedNotificationService.init();

    return () => {
      console.log("Removing all push notification listeners...");
      listenerHandles.forEach(handle => {
        try {
          handle.remove();
        } catch (error) {
          console.warn("Failed to remove listener handle:", error);
        }
      });
    };
    
  }, [navigate]);

  return (
    <>
      <NotificationSetup />
      <TaskAssignmentNotifier />
      <ChatMessageNotifier />
      <TeamInviteNotifier />
      
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <AppLayout>
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="/team-chat" element={<TeamChatPage />} />
                    <Route path="/meetly" element={<MeetlyPage />} />
                    <Route path="/sales-tracker" element={
                      <AdminRoute>
                        <SalesTrackerPage />
                      </AdminRoute>
                    } />
                    <Route path="/sales-opportunity" element={
                      <AdminRoute>
                        <SalesOpportunityPage />
                      </AdminRoute>
                    } />
                    <Route path="/sales-tools" element={
                      <AdminRoute>
                        <SalesToolsPage />
                      </AdminRoute>
                    } />
                    <Route path="/timer" element={<TimerPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/notes" element={<NotesPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </ErrorBoundary>
          </ProtectedRoute>
        }/>
      </Routes>
    </>
  );
}

export default function App() {
  // Initialize MSAL when the application first loads
  useEffect(() => {
    initMsal();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthContextProvider>
              <ConfettiProvider>
                <NotificationsContextProvider>
                  <TasksContextProvider>
                    <TeamChatProvider>
                      <CommentsContextProvider>
                        <TaskTimeTrackerProvider>
                          <PictureInPictureProvider>
                            <MeetlyContextProvider>
                              <SalesOpportunityProvider>
                                <ContactsProvider>
                                  <BrowserRouter>
                                    <AppContent />
                                  </BrowserRouter>
                                </ContactsProvider>
                              </SalesOpportunityProvider>
                            </MeetlyContextProvider>
                          </PictureInPictureProvider>
                        </TaskTimeTrackerProvider>
                      </CommentsContextProvider>
                    </TeamChatProvider>
                  </TasksContextProvider>
                </NotificationsContextProvider>
              </ConfettiProvider>
            </AuthContextProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}