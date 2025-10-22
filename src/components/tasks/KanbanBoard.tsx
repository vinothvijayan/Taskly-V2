import { useState, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, UserProfile } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTaskCard } from './KanbanTaskCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface KanbanBoardProps {
  tasks: Task[];
  teamMembers: UserProfile[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

const columns: { id: Task['status']; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
];

export function KanbanBoard({ tasks, teamMembers, onEdit, onDelete, onStartTimer, onTaskStatusChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<Task['status'], Task[]> = {
      todo: [],
      'in-progress': [],
      completed: [],
    };
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const assignedProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfile[]>();
    tasks.forEach(task => {
      if (task.assignedTo && task.assignedTo.length > 0) {
        const profiles = task.assignedTo
          .map(uid => teamMembers.find(member => member.uid === uid))
          .filter((p): p is UserProfile => !!p);
        map.set(task.id, profiles);
      }
    });
    return map;
  }, [tasks, teamMembers]);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Task') {
      setActiveTask(event.active.data.current.task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskData = tasks.find(t => t.id === activeId);
    if (!activeTaskData) return;

    const activeContainer = activeTaskData.status;
    const overContainer = columns.find(c => c.id === overId) ? overId : tasks.find(t => t.id === overId)?.status;

    if (!overContainer || activeContainer === overContainer) {
      return;
    }

    onTaskStatusChange(activeId, overContainer as Task['status']);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ScrollArea className="w-full whitespace-nowrap h-full">
        <div className="flex gap-6 p-1 h-full">
          {columns.map(column => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={tasksByStatus[column.id]}
              assignedProfilesMap={assignedProfilesMap}
              onEdit={onEdit}
              onDelete={onDelete}
              onStartTimer={onStartTimer}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeTask ? (
          <KanbanTaskCard
            task={activeTask}
            assignedProfiles={assignedProfilesMap.get(activeTask.id) || []}
            onEdit={() => {}}
            onDelete={() => {}}
            onStartTimer={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}