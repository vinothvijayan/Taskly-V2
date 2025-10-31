import { useTasks } from "@/contexts/TasksContext";
import { Task } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isTomorrow } from "date-fns";

interface PlannerTaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function PlannerTaskItem({ task, onEdit }: PlannerTaskItemProps) {
  const { teamMembers, toggleTaskStatus } = useTasks();

  const assignee = teamMembers.find(m => m.uid === task.assignedTo?.[0]);

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "dd MMM");
  };

  const projectColor = (projectName?: string) => {
    if (!projectName) return "bg-gray-200 text-gray-800";
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) {
      hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 85%)`;
  };

  return (
    <div 
      onClick={() => onEdit(task)}
      className={cn(
        "grid grid-cols-[2fr,1fr,1fr,1fr] items-center p-2 rounded-lg border border-transparent hover:bg-muted/50 cursor-pointer",
        task.status === 'completed' && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <button onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}>
          {task.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <span className={cn("text-sm", task.status === 'completed' && "line-through text-muted-foreground")}>
          {task.title}
        </span>
      </div>
      
      <div className="flex justify-center">
        {assignee && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={assignee.photoURL} />
                  <AvatarFallback className="text-xs">{getInitials(assignee.displayName)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{assignee.displayName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        {formatDate(task.dueDate)}
      </div>

      <div className="flex justify-center">
        {task.project && (
          <Badge style={{ backgroundColor: projectColor(task.project) }} className="text-xs font-medium text-gray-800">
            {task.project}
          </Badge>
        )}
      </div>
    </div>
  );
}