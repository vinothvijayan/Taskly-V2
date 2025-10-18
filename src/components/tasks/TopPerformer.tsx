import { useMemo } from "react";
import { useTasks } from "@/contexts/TasksContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { Task } from "@/types";

const calculateScore = (tasks: Task[]): number => {
  return tasks.reduce((totalScore, task) => {
    let score = 10; // Base score
    if (task.priority === "high") score += 5;
    if (task.priority === "medium") score += 2;
    return totalScore + score;
  }, 0);
};

export function TopPerformer() {
  const { tasks, teamMembers } = useTasks();

  const topPerformer = useMemo(() => {
    if (teamMembers.length <= 1) return null;

    const now = new Date();
    const startDate = startOfDay(now);
    const endDate = endOfDay(now);

    const todaysTasks = tasks.filter(task => {
      if (task.status !== "completed" || !task.completedAt) return false;
      const completedDate = new Date(task.completedAt as string);
      return completedDate >= startDate && completedDate <= endDate;
    });

    if (todaysTasks.length === 0) return null;

    const scores = teamMembers.map(member => {
      const memberTasks = todaysTasks.filter(task => task.createdBy === member.uid);
      return {
        userId: member.uid,
        name: member.displayName || member.email,
        avatarUrl: member.photoURL,
        score: calculateScore(memberTasks),
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
    <div className="flex items-center gap-2 p-2 pr-3 bg-yellow-400/10 border border-yellow-400/20 rounded-full text-yellow-700 dark:text-yellow-300">
      <Award className="h-5 w-5 text-yellow-500" />
      <span className="text-sm font-medium">Today's Top Performer:</span>
      <Avatar className="h-6 w-6">
        <AvatarImage src={topPerformer.avatarUrl} />
        <AvatarFallback className="text-xs bg-yellow-400/20">
          {topPerformer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-bold text-sm">{topPerformer.name}</span>
    </div>
  );
}