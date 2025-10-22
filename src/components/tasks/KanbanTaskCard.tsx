import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Task, UserProfile } from '@/types';
import { cn } from '@/lib/utils';
import { Calendar, Clock, MoreVertical, Edit, Trash2, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface KanbanTaskCardProps {
  task: Task;
  assignedProfiles: UserProfile[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
}

export function KanbanTaskCard({ task, assignedProfiles, onEdit, onDelete, onStartTimer }: KanbanTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const isCompleted = task.status === 'completed';

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "mb-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50 ring-2 ring-primary",
          isCompleted && "bg-muted/50 opacity-70"
        )}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <p className={cn(
              "font-semibold text-sm leading-snug pr-2",
              isCompleted && "line-through text-muted-foreground"
            )}>{task.title}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStartTimer(task.id)}><Play className="mr-2 h-4 w-4" />Start Timer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.priority === 'high' && <Badge variant="destructive">High</Badge>}
            {task.priority === 'medium' && <Badge variant="secondary">Medium</Badge>}
            {task.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(task.dueDate).toLocaleDateString()}</span>}
            {task.estimatedTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.estimatedTime}m</span>}
          </div>
          {assignedProfiles.length > 0 && (
            <div className="flex items-center justify-end pt-2">
              <div className="flex -space-x-2 overflow-hidden">
                {assignedProfiles.map(profile => (
                  <Avatar key={profile.uid} className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={profile.photoURL} />
                    <AvatarFallback className="text-[10px]">{getInitials(profile.displayName)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}