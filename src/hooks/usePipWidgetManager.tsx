import { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PipWidget } from '@/components/pip/PipWidget';
import { useTasks } from '@/contexts/TasksContext';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { useTeamChat } from '@/contexts/TeamChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { rtdb, db } from '@/lib/firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import { doc, setDoc, serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';
import { ChatMessage } from '@/types';

interface PipWindow extends Window {
  reactRoot?: Root;
}

export function usePipWidgetManager() {
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<PipWindow | null>(null);
  
  const tasksContext = useTasks();
  const timeTrackerContext = useTaskTimeTracker();
  const chatContext = useTeamChat();
  const authContext = useAuth();

  useEffect(() => {
    setIsPipSupported('documentPictureInPicture' in window);
  }, []);

  const closePip = useCallback(() => {
    if (pipWindow) {
      pipWindow.reactRoot?.unmount();
      pipWindow.close();
      setPipWindow(null);
      setIsPipOpen(false);
    }
  }, [pipWindow]);

  const sendMessageInPip = useCallback(async (receiverId: string, content: string) => {
    const { user, userProfile } = authContext;
    if (!user || !userProfile) return;

    const chatRoomId = [user.uid, receiverId].sort().join('_');
    const messagesRef = ref(rtdb, `chats/${chatRoomId}/messages`);
    const messageData: Omit<ChatMessage, 'id' | 'timestamp'> & { timestamp: any } = {
      senderId: user.uid,
      senderName: userProfile.displayName || user.email || 'Unknown',
      senderEmail: user.email || '',
      senderAvatar: userProfile.photoURL,
      message: content,
      timestamp: serverTimestamp(),
      type: 'text',
    };
    await push(messagesRef, messageData);

    const chatRoomInfoRef = doc(db, `chatRooms/${chatRoomId}`);
    await setDoc(chatRoomInfoRef, { 
      participants: [user.uid, receiverId], 
      lastActivity: firestoreServerTimestamp(),
      lastMessage: messageData 
    }, { merge: true });

  }, [authContext]);

  const openPip = useCallback(async () => {
    if (!isPipSupported || isPipOpen) return;

    try {
      const newPipWindow: PipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 480,
      });

      const styleElements = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      styleElements.forEach(el => {
        newPipWindow.document.head.appendChild(el.cloneNode(true));
      });

      if (document.documentElement.classList.contains('dark')) {
        newPipWindow.document.documentElement.classList.add('dark');
      }
      
      const bodyStyle = newPipWindow.document.createElement('style');
      bodyStyle.textContent = `body { margin: 0; overflow: hidden; } #root { height: 100vh; width: 100vw; }`;
      newPipWindow.document.head.appendChild(bodyStyle);

      const mountPoint = newPipWindow.document.createElement('div');
      mountPoint.id = 'root';
      newPipWindow.document.body.appendChild(mountPoint);

      const reactRoot = createRoot(mountPoint);
      
      const pipContent = (
        <PipWidget
          tasks={tasksContext.tasks}
          onToggleStatus={tasksContext.toggleTaskStatus}
          onClose={closePip}
          onAddTask={tasksContext.addTask}
          trackingTask={timeTrackerContext.trackingTask}
          isTracking={timeTrackerContext.isTracking}
          currentSessionElapsedSeconds={timeTrackerContext.currentSessionElapsedSeconds}
          onPlayPause={() => timeTrackerContext.isTracking ? timeTrackerContext.pauseTracking() : timeTrackerContext.resumeTracking()}
          onStop={timeTrackerContext.stopTracking}
          getFormattedTime={timeTrackerContext.getFormattedTime}
          onStartTracking={timeTrackerContext.startTracking}
          teamMembers={tasksContext.teamMembers}
          onlineStatus={chatContext.onlineStatus}
          unreadCounts={chatContext.unreadCounts}
          userProfile={authContext.userProfile}
          onSendMessage={sendMessageInPip}
        />
      );

      reactRoot.render(pipContent);
      newPipWindow.reactRoot = reactRoot;

      setPipWindow(newPipWindow);
      setIsPipOpen(true);

      newPipWindow.addEventListener('pagehide', () => {
        if (newPipWindow.reactRoot) newPipWindow.reactRoot.unmount();
        setPipWindow(null);
        setIsPipOpen(false);
      });
    } catch (error) {
      console.error("Error opening Picture-in-Picture window:", error);
    }
  }, [isPipSupported, isPipOpen, tasksContext, timeTrackerContext, chatContext, authContext, closePip, sendMessageInPip]);

  useEffect(() => {
    if (isPipOpen && pipWindow?.reactRoot) {
      const pipContent = (
        <PipWidget
          tasks={tasksContext.tasks}
          onToggleStatus={tasksContext.toggleTaskStatus}
          onClose={closePip}
          onAddTask={tasksContext.addTask}
          trackingTask={timeTrackerContext.trackingTask}
          isTracking={timeTrackerContext.isTracking}
          currentSessionElapsedSeconds={timeTrackerContext.currentSessionElapsedSeconds}
          onPlayPause={() => timeTrackerContext.isTracking ? timeTrackerContext.pauseTracking() : timeTrackerContext.resumeTracking()}
          onStop={timeTrackerContext.stopTracking}
          getFormattedTime={timeTrackerContext.getFormattedTime}
          onStartTracking={timeTrackerContext.startTracking}
          teamMembers={tasksContext.teamMembers}
          onlineStatus={chatContext.onlineStatus}
          unreadCounts={chatContext.unreadCounts}
          userProfile={authContext.userProfile}
          onSendMessage={sendMessageInPip}
        />
      );
      pipWindow.reactRoot.render(pipContent);
    }
  }, [isPipOpen, pipWindow, tasksContext, timeTrackerContext, chatContext, authContext, closePip, sendMessageInPip]);

  return { isPipSupported, isPipOpen, openPip, closePip };
}