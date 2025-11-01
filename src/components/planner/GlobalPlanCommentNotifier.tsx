import { useEffect } from 'react';
import { collectionGroup, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { PlanComment } from '@/types';
import { toast } from 'sonner';
import { CommentToast } from '@/components/ui/CommentToast';

export function GlobalPlanCommentNotifier() {
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (!user || !userProfile?.teamId) {
      return;
    }

    // Create a timestamp for when the listener starts. We only want comments created after this point.
    const listenerStartTime = Timestamp.now();

    const commentsQuery = query(
      collectionGroup(db, 'comments'),
      where('teamId', '==', userProfile.teamId),
      where('createdAt', '>', listenerStartTime) // <-- The key change
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      // No need for an initial load flag, as the query itself filters out old documents.
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
    }, (error) => {
      // This error handler is important. It will catch missing index errors.
      console.error("Error listening for global plan comments:", error);
    });

    // Cleanup the listener when the component unmounts or user changes
    return () => {
      unsubscribe();
    };
  }, [user, userProfile?.teamId]);

  return null; // This is a headless component that renders nothing
}