import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, MessageSquare, PlusSquare, ThumbsUp, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ReactionToast } from '@/components/ui/ReactionToast';
import { useTasks } from '@/contexts/TasksContext';

const useActivities = (
  teamId: string | undefined,
  currentUserId: string | undefined,
  teamMembers: UserProfile[],
  onNewReaction: (reactor: UserProfile, taskTitle: string) => void
) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const prevActivitiesRef = useRef<Activity[]>([]);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      setActivities([]);
      return;
    }

    const q = query(
      collection(db, 'teams', teamId, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newActivities: Activity[] = [];
      snapshot.forEach(doc => {
        newActivities.push({ id: doc.id, ...doc.data() } as Activity);
      });

      // Detect new reactions
      if (prevActivitiesRef.current.length > 0) {
        newActivities.forEach(newActivity => {
          const oldActivity = prevActivitiesRef.current.find(a => a.id === newActivity.id);
          if (oldActivity) {
            const oldReactors = new Set(oldActivity.reactions?.['👍'] || []);
            const newReactors = newActivity.reactions?.['👍'] || [];
            
            newReactors.forEach(reactorId => {
              // REMOVED: && reactorId !== currentUserId
              if (!oldReactors.has(reactorId)) {
                const reactor = teamMembers.find(m => m.uid === reactorId);
                if (reactor && newActivity.task?.title) {
                  onNewReaction(reactor, newActivity.task.title);
                }
              }
            });
          }
        });
      }

      setActivities(newActivities);
      prevActivitiesRef.current = newActivities;
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId, currentUserId, teamMembers, onNewReaction]);

  return { activities, loading };
};

const ActivityItem = ({ activity }: { activity: Activity }) => {
  const { user, userProfile } = useAuth();

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const toggleReaction = async (emoji: string) => {
    if (!user || !userProfile?.teamId) return;
    const activityRef = doc(db, 'teams', userProfile.teamId, 'activities', activity.id);
    
    const currentReactors = activity.reactions?.[emoji] || [];
    const hasReacted = currentReactors.includes(user.uid);

    await updateDoc(activityRef, {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  };

  const renderContent = () => {
    const actorName = <strong>{activity.actor.displayName}</strong>;
    const taskLink = <span className="font-semibold text-primary truncate">"{activity.task?.title}"</span>;

    switch (activity.type) {
      case 'TASK_CREATED':
        return <p>{actorName} created task {taskLink}</p>;
      case 'TASK_COMPLETED':
        return <p>{actorName} completed task {taskLink}</p>;
      case 'COMMENT_ADDED':
        return (
          <div>
            <p>{actorName} commented on {taskLink}</p>
            <p className="text-xs text-muted-foreground italic mt-1 border-l-2 pl-2">
              "{activity.comment?.contentPreview}"
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const getIcon = () => {
    switch (activity.type) {
      case 'TASK_CREATED': return <PlusSquare className="h-4 w-4 text-blue-500" />;
      case 'TASK_COMPLETED': return <CheckSquare className="h-4 w-4 text-green-500" />;
      case 'COMMENT_ADDED': return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const reactions = activity.reactions?.['👍'] || [];
  const hasReacted = user ? reactions.includes(user.uid) : false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-4 p-3"
    >
      <div className="mt-1">{getIcon()}</div>
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div className="text-sm">{renderContent()}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0 ml-4">
            <Avatar className="h-5 w-5">
              <AvatarImage src={activity.actor.photoURL} />
              <AvatarFallback className="text-[10px]">{getInitials(activity.actor.displayName)}</AvatarFallback>
            </Avatar>
            <span>{activity.timestamp ? formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true }) : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={hasReacted ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => toggleReaction('👍')}
          >
            <ThumbsUp className={cn("h-4 w-4", hasReacted && "text-primary")} />
            <span className={cn("text-xs", hasReacted ? "text-primary font-semibold" : "text-muted-foreground")}>
              {reactions.length > 0 ? reactions.length : ''}
            </span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export function TeamActivityFeed() {
  const { user, userProfile } = useAuth();
  const { teamMembers } = useTasks();

  const handleNewReaction = useCallback((reactor: UserProfile, taskTitle: string) => {
    toast.custom((t) => (
      <ReactionToast
        reactorName={reactor.displayName || 'A team member'}
        reactorAvatarUrl={reactor.photoURL}
        taskTitle={taskTitle}
      />
    ), {
      duration: 4000,
    });
  }, []);

  const { activities, loading } = useActivities(userProfile?.teamId, user?.uid, teamMembers, handleNewReaction);

  if (!userProfile?.teamId) {
    return (
      <Card className="shadow-elegant h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Team Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full text-center py-16">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-medium text-muted-foreground mb-2">No Team Found</h3>
          <p className="text-sm text-muted-foreground">Join or create a team to see your activity feed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Team Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground mb-2">No activity yet</h3>
              <p className="text-sm text-muted-foreground">Create or complete a task to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              <AnimatePresence>
                {activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}