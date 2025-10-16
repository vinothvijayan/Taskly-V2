import { memo, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
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
} from 'lucide-react';
import { Task, UserProfile } from '../../types';
import { useSwipeGestures, useHapticFeedback } from '../../hooks/useTouchGestures';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { DeleteConfirmationDialog } from '../common/DeleteConfirmationDialog';
import { cn } from '../../lib/utils';
import { TaskComments } from './TaskComments';
import { SubtasksSection } from './SubtasksSection'; // Import SubtasksSection
import { useComments } from '@/contexts/CommentsContext'; // Import useComments to get comment count
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { setTaskAsViewed, hasUnreadComments } from '@/lib/viewedTimestamps';

interface MobileTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onTogglePriority: (taskId: string) => void;
  onStartTimer?: (taskId: string) => void;
  assignedProfiles?: UserProfile[];
}

export const MobileTaskCard = memo(function MobileTaskCard({
  task,
  onEdit,
  onDelete,
  onToggleStatus,
  onTogglePriority,
  onStartTimer,
  assignedProfiles = [],
}: MobileTaskCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false); // State for comments expansion
  const { commentCounts } = useComments(); // Get comment counts
  const { impact, notification } = useHapticFeedback();
  const { trackingTask, startTracking, stopTracking, trackingSubtask } = useTaskTimeTracker();

  const isTimeTracking = trackingTask?.id === task.id;
  const isTrackingSubtaskForThisTask = trackingSubtask?.taskId === task.id;

  const swipeRef = useSwipeGestures({
    onSwipeLeft: () => {
      impact('medium');
      setShowDeleteDialog(true);
    },
    onSwipeRight: () => {
      impact('light');
      onToggleStatus(task.id);
    },
  }, {
    threshold: 60,
    velocityThreshold: 0.15,
    ignoreTapFromInteractive: true
  });

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';

  // Determine if the task has unread comments for highlighting
  const isRecentlyCommented = hasUnreadComments(task);

  const handleDeleteConfirm = () => {
    onDelete(task.id);
    notification('error');
    setShowDeleteDialog(false);
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
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
        ref={swipeRef as any}
        className={cn(
          "relative transition-all duration-200 touch-manipulation touch-pan-y z-10 mx-1",
          "shadow-md hover:shadow-lg",
          isCompleted && "opacity-75 bg-muted/50",
          isOverdue && !isCompleted && "border-destructive/50 bg-destructive/5",
          isTimeTracking && "ring-2 ring-primary/50 border-primary/50",
          isTrackingSubtaskForThisTask && "ring-2 ring-primary/50 border-primary/50",
          isRecentlyCommented && "border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-900/10 animate-pulse-glow",
          "border border-border/50 rounded-xl"
        )}
      >
        <div 
          className="p-3 sm:p-4"
          onClick={(e) => {
            const target = e.target as Element;
            if (e.target === e.currentTarget || !target.closest('button, a, [role="menuitem"]')) {
              onEdit(task);
            }
          }}
        >
          <div className="flex items-start gap-3">
            {/* Status Toggle */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(task.id);
                impact('light');
              }}
              variant="ghost"
              size="sm"
              className="p-0 h-9 w-9 min-w-[36px] shrink-0 rounded-full hover:bg-primary/10 transition-all"
            >
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              )}
            </Button>

            {/* Task Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className={cn(
                  "font-semibold text-sm leading-snug line-clamp-2",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h3>
                
                <div className="flex items-center gap-1 shrink-0">
                  {/* Comments Toggle Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCommentsExpanded(!isCommentsExpanded);
                      if (task.lastCommentedAt) {
                        setTaskAsViewed(task.id, task.lastCommentedAt);
                      }
                      impact('light');
                    }}
                    variant="ghost"
                    size="sm"
                    className="p-0 h-8 w-8 rounded-full hover:bg-primary/10 transition-all relative"
                  >
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {commentCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center p-0 text-[10px] font-bold"
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
                      impact('light');
                    }}
                    variant="ghost"
                    size="sm"
                    className="p-0 h-8 w-8 rounded-full hover:bg-yellow-500/10 transition-all"
                  >
                    {task.priority === 'high' ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-8 w-8 rounded-full hover:bg-muted/50 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          impact('light');
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 shadow-lg">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(task);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-3" />
                        Edit Task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          isTimeTracking ? stopTracking() : startTracking(task);
                        }}
                      >
                        {isTimeTracking ? (
                          <>
                            <Pause className="h-4 w-4 mr-3" />
                            Stop Timer
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-3" />
                            Start Timer
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-3" />
                        Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs mt-2">
                {task.dueDate && (
                  <Badge variant={isOverdue ? "destructive" : "outline"} className="h-5 text-[10px] px-1.5 py-0.5">
                    <Calendar className="h-2.5 w-2.5 mr-1" />{formatDueDate(task.dueDate)}
                  </Badge>
                )}
                {task.estimatedTime && (
                  <Badge variant="secondary" className="h-5 text-[10px] px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5 mr-1" />{task.estimatedTime}m
                  </Badge>
                )}
                {task.timeSpent && task.timeSpent > 0 && (
                  <Badge variant="outline" className="h-5 text-[10px] px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5 mr-1" />{formatTimeSpent(task.timeSpent)}
                  </Badge>
                )}
                {assignedProfiles.length > 0 && (
                  <Badge variant="outline" className="h-5 text-[10px] px-1.5 py-0.5">
                    <Users className="h-2.5 w-2.5 mr-1" />{assignedProfiles.length}
                  </Badge>
                )}
                <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="h-5 text-[10px] px-1.5 py-0.5">
                  {task.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-3 py-0 border-t border-border/30">
          <TaskComments 
            taskId={task.id} 
            isExpanded={isCommentsExpanded} 
            onToggleExpanded={() => setIsCommentsExpanded(!isCommentsExpanded)} 
          />
        </div>

        {/* Subtasks Section */}
        {task.subtasks && (task.subtasks.length > 0 || !isCompleted) && (
          <div className="px-3 pt-2 py-0 border-t border-border/30">
            <SubtasksSection task={task} />
          </div>
        )}

        {/* Time Tracking Indicator */}
        {isTimeTracking && (
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
});