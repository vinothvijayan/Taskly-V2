import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const ITEMS_PER_LOAD = 15;

export function KanbanColumn({ id, title, tasks, assignedProfilesMap, onEdit, onDelete, onStartTimer }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_LOAD);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_LOAD);
  };

  const visibleTasks = tasks.slice(0, visibleCount);

  return (
    <Card ref={setNodeRef} className="w-96 flex-shrink-0 h-full flex flex-col bg-muted/30">
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
              <>
                {visibleTasks.map(task => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    assignedProfiles={assignedProfilesMap.get(task.id) || []}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStartTimer={onStartTimer}
                  />
                ))}
                {tasks.length > visibleCount && (
                  <div className="flex justify-center mt-2">
                    <Button variant="ghost" size="sm" onClick={handleLoadMore}>
                      Load More ({tasks.length - visibleCount} more)
                    </Button>
                  </div>
                )}
              </>
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