import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
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
      const fullCommentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanComment));
      
      const sortedList = fullCommentsList.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || Date.now();
        const bTime = b.createdAt?.toMillis() || Date.now();
        return aTime - bTime;
      });

      setComments(sortedList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching plan comments:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, userProfile?.teamId]);

  const addComment = async (planId: string, content: string, parentId?: string) => {
    if (!user || !userProfile?.teamId) return;

    try {
      await addDoc(collection(db, 'teams', userProfile.teamId, 'plans', planId, 'comments'), {
        planId,
        teamId: userProfile.teamId, // Add teamId for global queries
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