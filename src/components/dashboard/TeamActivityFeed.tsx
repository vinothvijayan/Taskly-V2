import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, MessageSquare, PlusSquare, Users, SmilePlus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ReactionToast } from '@/components/ui/ReactionToast';
import { useTasks } from '@/contexts/TasksContext';
import { unifiedNotificationService } from '@/lib/unifiedNotificationService';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EMOJIS = ['👍', '🔥', '❤️'];

const useActivities = (
  teamId: string | undefined,
  currentUserId: string | undefined,
  teamMembers: UserProfile[],
  onNewReaction: (reactor: UserProfile, taskTitle: string, emoji: string) => void
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

      if (prevActivitiesRef.current.length > 0) {
        newActivities.forEach(newActivity => {
          const oldActivity = prevActivitiesRef.current.find(a => a.id === newActivity.id);
          if (oldActivity) {
            EMOJIS.forEach(emoji => {
              const oldReactors = new Set(oldActivity.reactions?.[emoji] || []);
              const newReactors = newActivity.reactions?.[emoji] || [];
              
              newReactors.forEach(reactorId => {
                if (!oldReactors.has(reactorId)) {
                  const reactor = teamMembers.find(m => m.uid === reactorId);
                  const activityAuthorId = newActivity.actor.uid;

                  if (reactor && newActivity.task?.title) {
                    onNewReaction(reactor, newActivity.task.title, emoji);

                    if (currentUserId === activityAuthorId && reactorId !== currentUserId) {
                      unifiedNotificationService.sendNotification({
                        title: `${emoji} New Reaction`,
                        body: `${reactor.displayName || 'Someone'} reacted to your activity on "${newActivity.task.title}"`,
                        type: 'general',
                        data: { taskId: newActivity.task.id, type: 'reaction' }
                      });
                    }
                  }
                }
              });
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

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

const ActivityItem = ({ activity, isLast }: { activity: Activity, isLast: boolean }) => {
  const { user, userProfile } = useAuth();

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
    const actorName = <strong className="font-semibold text-foreground">{activity.actor.displayName}</strong>;
    const taskLink = <span className="font-semibold text-primary truncate">"{activity.task?.title}"</span>;

    switch (activity.type) {
      case 'TASK_CREATED':
        return <p className="text-sm text-muted-foreground">{actorName} created task {taskLink}</p>;
      case 'TASK_COMPLETED':
        return <p className="text-sm text-muted-foreground">{actorName} completed task {taskLink}</p>;
      case 'COMMENT_ADDED':
        return (
          <div>
            <p className="text-sm text-muted-foreground">{actorName} commented on {taskLink}</p>
            <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-foreground/80">
              {activity.comment?.contentPreview}
            </blockquote>
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
      default: return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative pl-12 py-4"
    >
      {!isLast && <div className="absolute left-5 top-5 -ml-px mt-1 h-full w-0.5 bg-border" />}
      
      <div className="absolute left-0 top-4 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border">
          {getIcon()}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">{renderContent()}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0 ml-4">
            <Avatar className="h-5 w-5">
              <AvatarImage src={activity.actor.photoURL} />
              <AvatarFallback className="text-[10px]">{getInitials(activity.actor.displayName)}</AvatarFallback>
            </Avatar>
            <span>{activity.timestamp ? formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true }) : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap pt-1">
          {Object.entries(activity.reactions || {}).map(([emoji, reactors]) => {
            if (reactors.length > 0) {
              const hasReacted = user ? reactors.includes(user.uid) : false;
              return (
                <Button
                  key={emoji}
                  variant={hasReacted ? "secondary" : "outline"}
                  size="sm"
                  className="h-6 px-2 gap-1 rounded-full border-border/50"
                  onClick={() => toggleReaction(emoji)}
                >
                  <span className={cn("text-sm transition-transform", hasReacted && "scale-110")}>{emoji}</span>
                  <span className={cn("text-xs", hasReacted ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {reactors.length}
                  </span>
                </Button>
              );
            }
            return null;
          })}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground">
                <SmilePlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
              <div className="flex gap-1">
                {EMOJIS.map(emoji => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-lg rounded-full"
                    onClick={() => toggleReaction(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </motion.div>
  );
};

export function TeamActivityFeed() {
  const { user, userProfile } = useAuth();
  const { teamMembers } = useTasks();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleNewReaction = useCallback((reactor: UserProfile, taskTitle: string, emoji: string) => {
    toast.custom((t) => (
      <ReactionToast
        reactorName={reactor.displayName || 'A team member'}
        reactorAvatarUrl={reactor.photoURL}
        taskTitle={taskTitle}
        emoji={emoji}
      />
    ), {
      duration: 4000,
    });
  }, []);

  const { activities, loading } = useActivities(userProfile?.teamId, user?.uid, teamMembers, handleNewReaction);

  const filteredActivities = useMemo(() => {
    if (!selectedUserId) return activities;
    return activities.filter(activity => activity.actor.uid === selectedUserId);
  }, [activities, selectedUserId]);

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
        <TooltipProvider>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex items-center gap-2 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedUserId(null)} className={cn('rounded-full', !selectedUserId && 'ring-2 ring-primary')}>
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-muted"><Users className="h-4 w-4" /></AvatarFallback></Avatar>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>All Activity</p></TooltipContent>
              </Tooltip>
              {teamMembers.map(member => (
                <Tooltip key={member.uid}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedUserId(member.uid)} className={cn('rounded-full', selectedUserId === member.uid && 'ring-2 ring-primary')}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback>{getInitials(member.displayName || member.email)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{member.displayName || member.email}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground mb-2">
                {selectedUserId ? `No activity found for ${teamMembers.find(m => m.uid === selectedUserId)?.displayName}` : "No activity yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedUserId ? "This team member hasn't performed any actions yet." : "Create or complete a task to get started."}
              </p>
            </div>
          ) : (
            <div className="p-4">
              <AnimatePresence>
                {filteredActivities.map((activity, index) => (
                  <ActivityItem key={activity.id} activity={activity} isLast={index === filteredActivities.length - 1} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}