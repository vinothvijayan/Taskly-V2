import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTasks } from '@/contexts/TasksContext';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Plus, MessageSquare, Clock, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ActivityItem {
  id: string;
  type: 'completed' | 'created' | 'commented' | 'assigned';
  timestamp: string;
  taskTitle: string;
  userName: string;
  userId: string;
  userAvatar?: string;
}

const getInitials = (name?: string, email?: string) => {
  if (name && name.trim()) {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  }
  if (email) {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  }
  return "U";
};

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'created': return <Plus className="h-4 w-4 text-primary" />;
    case 'commented': return <MessageSquare className="h-4 w-4 text-focus" />;
    case 'assigned': return <Users className="h-4 w-4 text-info" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export function TeamActivityFeed() {
  const { tasks, teamMembers } = useTasks();
  const { user } = useAuth();

  const activityFeed = useMemo(() => {
    if (teamMembers.length <= 1) return [];

    const memberMap = new Map(teamMembers.map(m => [m.uid, m]));
    const activities: ActivityItem[] = [];

    tasks.forEach(task => {
      const creator = memberMap.get(task.createdBy || '');
      if (!creator) return;

      const userName = creator.displayName || creator.email;
      const userAvatar = creator.photoURL;
      const isCurrentUser = task.createdBy === user?.uid;
      const userLabel = isCurrentUser ? 'You' : userName;

      // 1. Task Completed
      if (task.status === 'completed' && task.completedAt) {
        activities.push({
          id: `${task.id}-completed`,
          type: 'completed',
          timestamp: task.completedAt as string,
          taskTitle: task.title,
          userName: userLabel,
          userId: task.createdBy!,
          userAvatar,
        });
      }

      // 2. Task Created (Use createdAt if not immediately completed)
      if (task.createdAt && task.status !== 'completed') {
        activities.push({
          id: `${task.id}-created`,
          type: 'created',
          timestamp: task.createdAt,
          taskTitle: task.title,
          userName: userLabel,
          userId: task.createdBy!,
          userAvatar,
        });
      }
      
      // 3. Task Commented (Use lastCommentedAt)
      if (task.lastCommentedAt) {
        activities.push({
          id: `${task.id}-commented`,
          type: 'commented',
          timestamp: task.lastCommentedAt,
          taskTitle: task.title,
          userName: userLabel,
          userId: task.createdBy!,
          userAvatar,
        });
      }
      
      // 4. Task Assigned (Only log if assigned to someone else)
      if (task.assignedTo && task.assignedTo.length > 0 && !isCurrentUser) {
        activities.push({
          id: `${task.id}-assigned`,
          type: 'assigned',
          timestamp: task.createdAt, // Use creation time for assignment event
          taskTitle: task.title,
          userName: userLabel,
          userId: task.createdBy!,
          userAvatar,
        });
      }
    });

    // Sort by timestamp (newest first) and limit to 15
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [tasks, teamMembers, user?.uid]);

  if (teamMembers.length <= 1) {
    return null;
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {activityFeed.length > 0 ? activityFeed.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={activity.userAvatar} />
                  <AvatarFallback className="text-xs bg-muted">
                    {getInitials(activity.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn("font-semibold", activity.userName === 'You' && "text-primary")}>
                      {activity.userName}
                    </span>
                    <span className="text-muted-foreground">
                      {activity.type === 'completed' ? 'completed' : 
                       activity.type === 'created' ? 'created' : 
                       activity.type === 'commented' ? 'commented on' : 
                       activity.type === 'assigned' ? 'assigned' : 'updated'}
                    </span>
                    <span className="font-medium truncate">{activity.taskTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {getActivityIcon(activity.type)}
                    <span>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No recent team activity.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}