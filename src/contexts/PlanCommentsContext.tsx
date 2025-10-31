import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { PlanComment } from "@/types";
import { useNotifications } from "./NotificationsContext";
import { toast } from "sonner";
import { CommentToast } from "@/components/ui/CommentToast";

interface PlanCommentsContextType {
  comments: PlanComment[];
  loading: boolean;
  addComment: (planId: string, content: string, parentId?: string) => Promise<void>;
  subscribeToComments: (planId: string) => () => void;
}

const PlanCommentsContext = createContext<PlanCommentsContextType | undefined>(undefined);

export function PlanCommentsProvider({ children }: { children: ReactNode }) {
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, userProfile } = useAuth();
  const { addNotification } = useNotifications();

  const subscribeToComments = useCallback((planId: string) => {
    if (!userProfile?.teamId) return () => {};
    setLoading(true);

    const commentsQuery = query(
      collection(db, 'teams', userProfile.teamId, 'plans', planId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsList: PlanComment[] = [];
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const newComment = { id: change.doc.id, ...change.doc.data() } as PlanComment;
          commentsList.push(newComment);

          // Trigger notifications for other users
          if (newComment.authorId !== user?.uid) {
            toast.custom((t) => (
              <CommentToast
                authorName={newComment.authorName}
                authorAvatar={newComment.authorAvatar}
                commentPreview={newComment.content}
                onDismiss={() => toast.dismiss(t)}
              />
            ));
            addNotification({
              title: `New comment from ${newComment.authorName}`,
              body: newComment.content,
              type: 'general',
              read: false,
            });
          }
        }
      });
      
      setComments(prev => [...prev, ...commentsList].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching plan comments:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, userProfile?.teamId, addNotification]);

  const addComment = async (planId: string, content: string, parentId?: string) => {
    if (!user || !userProfile?.teamId) return;

    try {
      await addDoc(collection(db, 'teams', userProfile.teamId, 'plans', planId, 'comments'), {
        planId,
        parentId: parentId || null,
        authorId: user.uid,
        authorName: userProfile.displayName || user.email,
        authorAvatar: userProfile.photoURL,
        content,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to post comment.");
    }
  };

  const value = { comments, loading, addComment, subscribeToComments };

  return (
    <PlanCommentsContext.Provider value={value}>
      {children}
    </PlanCommentsContext.Provider>
  );
}

export function usePlanComments() {
  const context = useContext(PlanCommentsContext);
  if (context === undefined) {
    throw new Error("usePlanComments must be used within a PlanCommentsProvider");
  }
  return context;
}