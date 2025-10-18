import { useMemo, useEffect } from "react";
import { useTasks } from "@/contexts/TasksContext";
import { useAuth } from "@/contexts/AuthContext";
import { useConfetti } from "@/contexts/ConfettiContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, Clock } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { calculateUserScoreForPeriod } from "@/lib/scoring";

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `~1m`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

export function TopPerformer() {
  const { tasks, teamMembers } = useTasks();
  const { user } = useAuth();
  const { showConfetti } = useConfetti();

  const topPerformer = useMemo(() => {
    if (teamMembers.length <= 1) return null;

    const now = new Date();
    const startDate = startOfDay(now);
    const endDate = endOfDay(now);

    const scores = teamMembers.map(member => {
      const allMemberTasks = tasks.filter(task => task.createdBy === member.uid);
      
      const score = calculateUserScoreForPeriod(allMemberTasks, startDate, endDate);

      const todaysTasks = allMemberTasks.filter(task => {
        if (task.status !== "completed" || !task.completedAt) return false;
        const completedDate = new Date(task.completedAt as string);
        return completedDate >= startDate && completedDate <= endDate;
      });

      const totalTimeSpent = todaysTasks.reduce((total, task) => total + (task.timeSpent || 0), 0);

      return {
        userId: member.uid,
        name: member.displayName || member.email,
        avatarUrl: member.photoURL,
        score: score,
        totalTimeSpent: totalTimeSpent,
      };
    });

    const sorted = scores.sort((a, b) => b.score - a.score);
    
    if (sorted[0].score > 0) {
      return sorted[0];
    }
    
    return null;

  }, [tasks, teamMembers]);

  useEffect(() => {
    if (topPerformer && user && topPerformer.userId === user.uid) {
      showConfetti();
    }
  }, [topPerformer, user, showConfetti]);

  if (!topPerformer) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-2 pr-3 bg-gradient-to-r from-amber-50/50 via-background to-background border border-amber-200/60 dark:from-amber-950/30 dark:border-amber-800/50 rounded-full text-sm shadow-sm transition-all hover:shadow-md hover:border-amber-300/80">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50">
        <Award className="h-5 w-5 text-amber-500 dark:text-amber-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 -mb-1">Top Performer</span>
        <span className="font-bold text-foreground truncate">{topPerformer.name}</span>
      </div>
      {topPerformer.totalTimeSpent > 0 && (
        <Badge variant="secondary" className="text-xs font-mono flex items-center gap-1 bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
          <Clock className="h-3 w-3" />
          {formatTime(topPerformer.totalTimeSpent)}
        </Badge>
      )}
      <Avatar className="h-8 w-8 border-2 border-background">
        <AvatarImage src={topPerformer.avatarUrl} />
        <AvatarFallback className="text-xs bg-muted">
          {topPerformer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}