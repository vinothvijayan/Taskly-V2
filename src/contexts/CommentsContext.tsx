import React, { createContext, useContext, useState } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TaskComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext'; // Import useTasks
import { unifiedNotificationService } from '@/lib/unifiedNotificationService';
import { toast } from 'sonner';

interface CommentsContextType {
  comments: { [taskId: string]: TaskComment[] };
  commentCounts: { [taskId: string]: number };
  loading: { [taskId: string]: boolean };
  addComment: (taskId: string, content: string, taskTitle?: string) => Promise<void>;
  updateComment: (commentId: string, taskId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string, taskId: string) => Promise<void>;
  subscribeToTaskComments: (taskId: string) => (() => void) | null;
  unsubscribeFromTaskComments: (taskId: string) => void;
}

const CommentsContext = createContext<CommentsContextType | null>(null);

export function CommentsContextProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tasksContext = useTasks(); // Use the TasksContext
  const [comments, setComments] = useState<{ [taskId: string]: TaskComment[] }>({});
  const [commentCounts, setCommentCounts] = useState<{ [taskId: string]: number }>({});
  const [loading, setLoading] = useState<{ [taskId: string]: boolean }>({});
  const [unsubscribers, setUnsubscribers] = useState<{ [taskId: string]: () => void }>({});

  const addComment = async (taskId: string, content: string, taskTitle?: string) => {
    if (!user || !content.trim()) return;

    const newCommentTimestamp = new Date().toISOString(); // Get timestamp before adding
    try {
      const commentsRef = collection(db, 'taskComments', taskId, 'comments');
      await addDoc(commentsRef, {
        taskId,
        userId: user.uid,
        userDisplayName: user.displayName || user.email,
        userPhotoURL: user.photoURL,
        content: content.trim(),
        createdAt: newCommentTimestamp, // Use ISO string for consistency
        isEdited: false
      });

      // Update the parent task's lastCommentedAt to trigger re-sorting
      await tasksContext.updateTaskLastCommentedAt(taskId, newCommentTimestamp);
      
      // Send notification for new comment (only if task title is provided)
      if (taskTitle) {
        await unifiedNotificationService.sendCommentNotification(
          taskTitle,
          user.displayName || user.email || 'Anonymous',
          content.trim(),
          taskId
        );
      }
      
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const updateComment = async (commentId: string, taskId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const commentRef = doc(db, 'taskComments', taskId, 'comments', commentId);
      await updateDoc(commentRef, {
        content: content.trim(),
        updatedAt: new Date().toISOString(), // Use ISO string
        isEdited: true
      });
      
      // Update the parent task's lastCommentedAt to trigger re-sorting
      await tasksContext.updateTaskLastCommentedAt(taskId, new Date().toISOString());

      toast.success('Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const deleteComment = async (commentId: string, taskId: string) => {
    if (!user) return;

    try {
      const commentRef = doc(db, 'taskComments', taskId, 'comments', commentId);
      await deleteDoc(commentRef);
      
      // Re-evaluate lastCommentedAt for the task (could be set to previous comment or null)
      // For simplicity, we'll just update it to now, which will re-sort if needed.
      // A more robust solution would re-fetch the latest comment's timestamp.
      await tasksContext.updateTaskLastCommentedAt(taskId, new Date().toISOString());

      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const subscribeToTaskComments = (taskId: string) => {
    if (!taskId || unsubscribers[taskId]) return null;

    setLoading(prev => ({ ...prev, [taskId]: true }));

    const commentsRef = collection(db, 'taskComments', taskId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskComment[];

      setComments(prev => ({ ...prev, [taskId]: taskComments }));
      setCommentCounts(prev => ({ ...prev, [taskId]: taskComments.length }));
      setLoading(prev => ({ ...prev, [taskId]: false }));

      // Check for new comments from other users and update task's lastCommentedAt
      snapshot.docChanges().forEach(change => {
        if (change.type === "added" || change.type === "modified") {
          const comment = change.doc.data() as TaskComment;
          // Only update if the comment is from another user or if it's a new comment
          if (comment.userId !== user?.uid) {
            tasksContext.updateTaskLastCommentedAt(taskId, comment.createdAt);
          }
        }
      });

    }, (error) => {
      console.error('Error fetching comments:', error);
      setLoading(prev => ({ ...prev, [taskId]: false }));
    });

    setUnsubscribers(prev => ({ ...prev, [taskId]: unsubscribe }));
    return unsubscribe;
  };

  const unsubscribeFromTaskComments = (taskId: string) => {
    if (unsubscribers[taskId]) {
      unsubscribers[taskId]();
      setUnsubscribers(prev => {
        const newUnsubscribers = { ...prev };
        delete newUnsubscribers[taskId];
        return newUnsubscribers;
      });
    }
  };

  return (
    <CommentsContext.Provider value={{
      comments,
      commentCounts,
      loading,
      addComment,
      updateComment,
      deleteComment,
      subscribeToTaskComments,
      unsubscribeFromTaskComments
    }}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments() {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error('useComments must be used within a CommentsContextProvider');
  }
  return context;
}