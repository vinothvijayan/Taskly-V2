import { useEffect, useRef } from 'react';
import { collectionGroup, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { PlanComment } from '@/types';
import { toast } from 'sonner';
import { CommentToast } from '@/components/ui/CommentToast';

export function GlobalPlanCommentNotifier() {
  const { user, userProfile } = useAuth();
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!user || !userProfile?.teamId) {
      return;
    }

    // Reset the flag to ignore the first batch of data on a new subscription
    isInitialLoadRef.current = true;

    const commentsQuery = query(
      collectionGroup(db, 'comments'),
      where('teamId', '==', userProfile.teamId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      // Ignore the initial data dump when the listener first connects
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        return;
      }

      // Process only the new changes
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newComment = { id: change.doc.id, ...change.doc.data() } as PlanComment;

          // Only show a notification if the new comment is not from the current user
          if (newComment.authorId !== user.uid) {
            toast.custom((t) => (
              <CommentToast
                authorName={newComment.authorName}
                authorAvatar={newComment.authorAvatar}
                commentPreview={newComment.content}
                onDismiss={() => toast.dismiss(t)}
              />
            ));
          }
        }
      });
    });

    // Cleanup the listener when the component unmounts or user changes
    return () => {
      unsubscribe();
    };
  }, [user, userProfile?.teamId]);

  return null; // This is a headless component that renders nothing
}