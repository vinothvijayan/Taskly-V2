import { useState } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  Users, 
  Star, 
  StarOff,
  Play,
  Pause,
  Edit,
  Trash2,
  MoreVertical,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { TaskComments } from "./TaskComments";
import { SubtasksSection } from "./SubtasksSection";
import { cn } from "@/lib/utils";
import { Task, UserProfile } from "@/types";
import { useTaskTimeTracker } from "@/contexts/TaskTimeTrackerContext";
import { useComments } from '@/contexts/CommentsContext';
import { setTaskAsViewed, hasUnreadComments } from '@/lib/viewedTimestamps';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onTogglePriority: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  assignedProfiles: UserProfile[];
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleStatus,
  onTogglePriority,
  onStartTimer,
  assignedProfiles
}: TaskCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const { commentCounts } = useComments();
  const { trackingTask, isTracking, startTracking, stopTracking, trackingSubtask } = useTaskTimeTracker();

  const isCurrentlyTracking = trackingTask?.id === task.id;
  const isTrackingSubtaskForThisTask = trackingSubtask?.taskId === task.id;
  const isCompleted = task.status === "completed";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  const isRecentlyCommented = hasUnreadComments(task);

  const handleDeleteConfirm = () => {
    onDelete(task.id);
    setShowDeleteDialog(false);
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `${diffDays} days`;
  };

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const commentCount = commentCounts[task.id] || 0;

  const priorityColorClass = {
    high: "border-l-destructive",
    medium: "border-l-primary",
    low: "border-l-muted-foreground",
  };

  return (
    <>
      <Card
        className={cn(
          "relative transition-all duration-200 group cursor-pointer border-l-4",
          "shadow-sm hover:shadow-md dark:shadow-none",
          "bg-card",
          priorityColorClass[task.priority],
          isCompleted && "opacity-60 bg-muted/50",
          isCurrentlyTracking && "ring-2 ring-primary/50",
          isTrackingSubtaskForThisTask && "ring-2 ring-primary/50",
          isRecentlyCommented && "bg-blue-500/5",
          isOverdue && "bg-destructive/5"
        )}
        onClick={(e) => {
          const target = e.target as Element;
          if (e.target === e.currentTarget || !target.closest("button, a, [role='menuitem'], [data-no-edit-on-click]")) {
            onEdit(task);
          }
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(task.id); }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary/10 transition-all shrink-0"
            >
              {isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />}
            </Button>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className={cn("font-medium text-base leading-snug", isCompleted && "line-through text-muted-foreground")}>
                  {task.title}
                </h3>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button onClick={(e) => { e.stopPropagation(); onTogglePriority(task.id); }} variant="ghost" size="icon" className="h-7 w-7">
                    {task.priority === "high" ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => isCurrentlyTracking ? stopTracking() : startTracking(task)}>{isCurrentlyTracking ? <><Pause className="h-4 w-4 mr-2" />Stop Timer</> : <><Play className="h-4 w-4 mr-2" />Start Timer</>}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {task.description && <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {task.dueDate && <Badge variant={isOverdue ? "destructive" : "outline"}><Calendar className="h-3 w-3 mr-1" />{formatDueDate(task.dueDate)}</Badge>}
                {task.estimatedTime && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{task.estimatedTime}m</Badge>}
                {task.timeSpent && task.timeSpent > 0 && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{formatTimeSpent(task.timeSpent)}</Badge>}
                {assignedProfiles.length > 0 && <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{assignedProfiles.length}</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 border-t border-border/50" data-no-edit-on-click>
          {(!isCompleted || (task.subtasks && task.subtasks.length > 0)) && <SubtasksSection task={task} />}
          
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsCommentsExpanded(!isCommentsExpanded);
              if (task.lastCommentedAt) {
                setTaskAsViewed(task.id, task.lastCommentedAt);
              }
            }}
            className="w-full justify-between py-1 px-2 h-auto hover:bg-muted/30 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Comments {commentCount > 0 && `(${commentCount})`}
              </span>
              {isRecentlyCommented && !isCommentsExpanded && <div className="w-2 h-2 bg-primary rounded-full" />}
            </div>
            {isCommentsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          <TaskComments 
            taskId={task.id} 
            isExpanded={isCommentsExpanded} 
            onToggleExpanded={() => setIsCommentsExpanded(!isCommentsExpanded)} 
          />
        </div>
      </Card>
      <DeleteConfirmationDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} onConfirm={handleDeleteConfirm} itemName={task.title} />
    </>
  );
}