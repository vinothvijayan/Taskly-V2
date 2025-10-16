import React, { useState, useEffect } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Phone, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";

interface DailyCallDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  data: {
    date: string;
    calls: { contact: Contact; log: CallLog }[];
  } | null;
  onSelectContact: (contact: Contact) => void;
  onUpdateCallLogFeedback: (contactId: string, logId: string, newFeedback: CallLog['feedback']) => Promise<void>;
}

const getFeedbackBadge = (feedback: CallLog['feedback']) => {
  switch (feedback) {
    case 'Interested': return <Badge className="bg-green-100 text-green-800">Interested</Badge>;
    case 'Follow Up': return <Badge className="bg-blue-100 text-blue-800">Follow-up</Badge>;
    case 'Callback': return <Badge className="bg-yellow-100 text-yellow-800">Callback</Badge>;
    case 'Send Details': return <Badge className="bg-indigo-100 text-indigo-800">Send Details</Badge>;
    case 'Not Interested': return <Badge variant="destructive">Not Interested</Badge>;
    case 'Not Picked': return <Badge variant="outline">Not Picked</Badge>;
    default: return <Badge variant="secondary">{feedback}</Badge>;
  }
};

const DraggableContactCard = ({ call, isOverlay = false, onSelectContact }: { call: { contact: Contact; log: CallLog }, isOverlay?: boolean, onSelectContact?: (contact: Contact) => void }) => {
  return (
    <button
      onClick={() => onSelectContact && onSelectContact(call.contact)}
      className={cn(
        "w-full text-left p-3 rounded-lg border bg-background shadow-sm",
        isOverlay ? "cursor-grabbing" : "cursor-grab",
        !isOverlay && "hover:bg-muted/50 transition-colors"
      )}
    >
      <p className="font-medium text-sm flex items-center gap-2">
        <User className="h-3.5 w-3.5" /> {call.contact.name}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
        <Phone className="h-3 w-3" /> {call.contact.phone}
      </p>
    </button>
  );
};

const SortableCallItem = ({ call, onSelectContact }: { call: { contact: Contact; log: CallLog }, onSelectContact: (contact: Contact) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: call.log.originalIndex });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(isDragging && "opacity-50")}>
      <DraggableContactCard call={call} onSelectContact={onSelectContact} />
    </div>
  );
};

const KanbanContent: React.FC<Omit<DailyCallDetailModalProps, 'isOpen' | 'onOpenChange'>> = ({ data, onSelectContact, onUpdateCallLogFeedback }) => {
  const [columns, setColumns] = useState<Record<string, { contact: Contact; log: CallLog }[]>>({});
  const [activeDragItem, setActiveDragItem] = useState<{ contact: Contact; log: CallLog } | null>(null);

  useEffect(() => {
    if (data) {
      const grouped = data.calls.reduce((acc, call) => {
        const { feedback } = call.log;
        if (!acc[feedback]) {
          acc[feedback] = [];
        }
        acc[feedback].push(call);
        return acc;
      }, {} as Record<string, { contact: Contact; log: CallLog }[]>);
      setColumns(grouped);
    }
  }, [data]);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

  const findColumnForCall = (callId: string): string | undefined => {
    return Object.keys(columns).find(columnId =>
      columns[columnId].some(call => call.log.originalIndex === callId)
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    const columnId = findColumnForCall(activeId);
    if (columnId) {
      const item = columns[columnId].find(c => c.log.originalIndex === activeId);
      setActiveDragItem(item || null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumnId = findColumnForCall(activeId);
    const overIsColumn = feedbackOrder.includes(overId as any);
    const overColumnId = overIsColumn ? overId : findColumnForCall(overId);

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
      return;
    }

    const callToMove = columns[activeColumnId].find(c => c.log.originalIndex === activeId);
    if (!callToMove) return;

    // Optimistic update
    setColumns(prev => {
      const newColumns = { ...prev };
      newColumns[activeColumnId] = newColumns[activeColumnId].filter(c => c.log.originalIndex !== activeId);
      if (!newColumns[overColumnId]) {
        newColumns[overColumnId] = [];
      }
      newColumns[overColumnId] = [...newColumns[overColumnId], callToMove];
      return newColumns;
    });

    // Persist change to Firebase
    const newFeedback = overColumnId as CallLog['feedback'];
    onUpdateCallLogFeedback(callToMove.contact.id, callToMove.log.originalIndex, newFeedback);
  };

  const feedbackOrder: CallLog['feedback'][] = ['Interested', 'Follow Up', 'Callback', 'Not Interested', 'Not Picked', 'Send Details'];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ScrollArea className="h-full w-full">
        <div className="flex space-x-4 pb-4">
          {feedbackOrder.map((feedback) => {
            const calls = columns[feedback] || [];
            const { setNodeRef } = useSortable({ id: feedback });
            return (
              <div key={feedback} ref={setNodeRef} className="w-72 flex-shrink-0 bg-muted/30 rounded-lg p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  {getFeedbackBadge(feedback)}
                  <span className="font-semibold text-sm text-muted-foreground">({calls.length})</span>
                </div>
                <SortableContext items={calls.map(c => c.log.originalIndex)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {calls.map((call) => (
                      <SortableCallItem key={call.log.originalIndex} call={call} onSelectContact={onSelectContact} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeDragItem ? <DraggableContactCard call={activeDragItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export const DailyCallDetailModal: React.FC<DailyCallDetailModalProps> = (props) => {
  const { isOpen, onOpenChange, data } = props;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="p-4 h-[85vh]">
          <DrawerHeader className="flex-shrink-0 text-left">
            <DrawerTitle>
              Call Details for {data ? format(new Date(data.date), 'MMMM d, yyyy') : ''}
            </DrawerTitle>
            <DrawerDescription>
              Drag and drop contacts to update their status.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden mt-4">
            <KanbanContent {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            Call Details for {data ? format(new Date(data.date), 'MMMM d, yyyy') : ''}
          </DialogTitle>
          <DialogDescription>
            Drag and drop contacts between columns to update their status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden mt-4">
          <KanbanContent {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
};