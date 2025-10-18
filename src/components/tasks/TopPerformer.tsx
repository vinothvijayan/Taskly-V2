import { useMemo } from "react";
import { useTasks } from "@/contexts/TasksContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, Clock } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { calculateUserScoreForPeriod } from "@/lib/scoring"; // Import the new scoring function

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

  if (!topPerformer) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 pr-3 bg-background border border-border rounded-lg text-sm shadow-sm">
      <Award className="h-5 w-5 text-primary" />
      <span className="text-muted-foreground font-medium">Top Performer:</span>
      <Avatar className="h-6 w-6">
        <AvatarImage src={topPerformer.avatarUrl} />
        <AvatarFallback className="text-xs bg-muted">
          {topPerformer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold text-foreground">{topPerformer.name}</span>
      {topPerformer.totalTimeSpent > 0 && (
        <Badge variant="secondary" className="text-xs font-mono flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(topPerformer.totalTimeSpent)}
        </Badge>
      )}
    </div>
  );
}