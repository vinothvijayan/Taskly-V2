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
  MessageCircle // Import MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { TaskComments } from "./TaskComments";
import { SubtasksSection } from "./SubtasksSection"; // Import SubtasksSection
import { cn } from "@/lib/utils";
import { Task, UserProfile } from "@/types";
import { useTaskTimeTracker } from "@/contexts/TaskTimeTrackerContext";
import { useComments } from '@/contexts/CommentsContext'; // Import useComments to get comment count
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
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false); // State for comments expansion
  const { commentCounts } = useComments(); // Get comment counts
  const { trackingTask, isTracking, startTracking, stopTracking, getFormattedTime, trackingSubtask } = useTaskTimeTracker();

  const isCurrentlyTracking = trackingTask?.id === task.id;
  const isTrackingSubtaskForThisTask = trackingSubtask?.taskId === task.id;
  const isCompleted = task.status === "completed";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

  // Determine if the task has unread comments for highlighting
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

  const commentCount = commentCounts[task.id] || 0; // Get comment count for this task

  return (
    <div className="flex flex-col mb-3">
      <Card
        className={cn(
          "relative transition-all duration-200 cursor-pointer",
          "min-h-[120px] shadow-md hover:shadow-lg dark:shadow-lg",
          "bg-white dark:bg-gray-900",
          "border border-border/50 dark:border-gray-700",
          "rounded-xl",
          isCompleted && "opacity-75 bg-muted/50 dark:bg-gray-800",
          isCurrentlyTracking && "ring-2 ring-primary/50 border-primary/50",
          isTrackingSubtaskForThisTask && "ring-2 ring-primary/50 border-primary/50",
          isRecentlyCommented && "border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-900/10 animate-pulse-glow",
          isOverdue && "bg-destructive/5 dark:bg-red-900/20 animate-pulse-glow-destructive"
        )}
        onClick={(e) => {
          const target = e.target as Element;
          if (e.target === e.currentTarget || !target.closest("button, a, [role='menuitem']")) {
            onEdit(task);
          }
        }}
      >
        <div className="p-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Status Toggle */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(task.id);
              }}
              variant="ghost"
              size="sm"
              className="p-0 h-10 w-10 min-w-[40px] shrink-0 rounded-full hover:bg-primary/10 transition-all"
            >
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
              )}
            </Button>

            {/* Task Content */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3
                  className={cn(
                    "font-semibold text-lg leading-relaxed line-clamp-2",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </h3>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Comments Toggle Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCommentsExpanded(!isCommentsExpanded);
                      if (task.lastCommentedAt) {
                        setTaskAsViewed(task.id, task.lastCommentedAt);
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="p-0 h-10 w-10 rounded-full hover:bg-primary/10 transition-all relative"
                  >
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    {commentCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs font-bold"
                      >
                        {commentCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Priority */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePriority(task.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="p-0 h-10 w-10 rounded-full hover:bg-yellow-500/10 transition-all"
                  >
                    {task.priority === "high" ? (
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-10 w-10 rounded-full hover:bg-muted/50 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 shadow-lg">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }} >
                        <Edit className="h-4 w-4 mr-3" />
                        Edit Task
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); isCurrentlyTracking ? stopTracking() : startTracking(task); }} >
                        {isCurrentlyTracking ? ( <> <Pause className="h-4 w-4 mr-3" /> Stop Timer </> ) : ( <> <Play className="h-4 w-4 mr-3" /> Start Timer </> )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }} className="text-destructive" >
                        <Trash2 className="h-4 w-4 mr-3" />
                        Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
                {task.dueDate && (
                  <Badge variant={isOverdue ? "destructive" : "outline"} className="h-6 text-xs px-2 py-1" >
                    <Calendar className="h-3 w-3 mr-1.5" />
                    {formatDueDate(task.dueDate)}
                  </Badge>
                )}
                {task.estimatedTime && (
                  <Badge variant="secondary" className="h-6 text-xs px-2 py-1">
                    <Clock className="h-3 w-3 mr-1.5" />
                    {task.estimatedTime}m
                  </Badge>
                )}
                {task.timeSpent && task.timeSpent > 0 && (
                  <Badge variant="outline" className="h-6 text-xs px-2 py-1">
                    <Clock className="h-3 w-3 mr-1.5" />
                    {formatTimeSpent(task.timeSpent)}
                  </Badge>
                )}
                {assignedProfiles.length > 0 && (
                  <Badge variant="outline" className="h-6 text-xs px-2 py-1">
                    <Users className="h-3 w-3 mr-1.5" />
                    {assignedProfiles.length}
                  </Badge>
                )}
                <Badge variant={task.status === "completed" ? "default" : "secondary"} className="h-6 text-xs px-2 py-1" >
                  {task.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section (now always rendered, but content is conditional) */}
        <div className="px-5 py-0 border-t border-border/30">
          <TaskComments 
            taskId={task.id} 
            isExpanded={isCommentsExpanded} 
            onToggleExpanded={() => setIsCommentsExpanded(!isCommentsExpanded)} 
          />
        </div>

        {/* Subtasks Section */}
        {task.subtasks && (task.subtasks.length > 0 || !isCompleted) && (
          <div className="px-5 pt-3 py-0 border-t border-border/30"> {/* Added pt-3 here */}
            <SubtasksSection task={task} />
          </div>
        )}

        {/* Time Tracking Indicator */}
        {isCurrentlyTracking && (
          <div className="absolute top-3 right-3">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-glow" />
          </div>
        )}
      </Card>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemName={task.title}
      />
    </div>
  );
}