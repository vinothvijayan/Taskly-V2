import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Task, UserProfile } from '@/types';
import { KanbanTaskCard } from './KanbanTaskCard';

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
    <div ref={setNodeRef} className="w-72 flex-shrink-0 bg-muted/50 rounded-xl flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-semibold text-sm flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary">{tasks.length}</Badge>
        </h3>
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
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
            <div className="text-center text-sm text-muted-foreground py-16 px-4 border-2 border-dashed rounded-lg m-2">
              No tasks here.
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}