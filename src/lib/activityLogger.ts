import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Task } from '@/types';

type ActivityType = 'TASK_CREATED' | 'TASK_COMPLETED' | 'COMMENT_ADDED';

interface Actor {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export const logActivity = async (
  teamId: string,
  type: ActivityType,
  actor: Actor,
  data: {
    task?: { id: string; title: string };
    comment?: { contentPreview: string };
  }
) => {
  if (!teamId) return;

  try {
    const activitiesRef = collection(db, 'teams', teamId, 'activities');
    await addDoc(activitiesRef, {
      teamId,
      type,
      actor,
      ...data,
      timestamp: serverTimestamp(),
      reactions: {},
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};