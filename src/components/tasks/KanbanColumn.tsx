import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Task, UserProfile } from '@/types';
import { KanbanTaskCard } from './KanbanTaskCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  assignedProfilesMap: Map<string, UserProfile[]>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
}

export function KanbanColumn({ id, title, tasks, assignedProfilesMap, onEdit, onDelete, onStartTimer }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <Card ref={setNodeRef} className="w-80 flex-shrink-0 h-full flex flex-col bg-muted/30">
      <CardHeader className="p-4 border-b">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="p-4">
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.length > 0 ? (
              tasks.map(task => (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  assignedProfiles={assignedProfilesMap.get(task.id) || []}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStartTimer={onStartTimer}
                />
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                No tasks here.
              </div>
            )}
          </SortableContext>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}