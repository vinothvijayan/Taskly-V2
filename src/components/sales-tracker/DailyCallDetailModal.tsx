import React, { useState, useEffect, useMemo } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Plus, CheckCircle, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { useSalesOpportunity } from '@/contexts/SalesOpportunityContext';
import { DeleteLogConfirmationDialog } from './DeleteLogConfirmationDialog';
import { BulkDeleteConfirmationDialog } from './BulkDeleteConfirmationDialog';

interface DailyCallDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  data: {
    date: string;
    calls: { contact: Contact; log: CallLog }[];
  } | null;
  onSelectContact: (contact: Contact) => void;
  onUpdateCallLogFeedback: (contactId: string, logId: string, newFeedback: CallLog['feedback']) => Promise<void>;
  onDeleteCallLog: (contactId: string, logId: string) => Promise<void>;
  onDeleteMultipleCallLogs: (logsToDelete: { contactId: string; logId: string }[]) => Promise<void>;
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

const DraggableContactCard = ({ call, isOverlay = false, onSelectContact, isSelected, onDelete }: { call: { contact: Contact; log: CallLog }, isOverlay?: boolean, onSelectContact?: (contact: Contact) => void, isSelected?: boolean, onDelete?: () => void }) => {
  return (
    <div
      className={cn(
        "w-full text-left p-3 rounded-lg border bg-background shadow-sm relative group",
        isOverlay ? "cursor-grabbing" : "cursor-grab",
        !isOverlay && "hover:bg-muted/50 transition-colors",
        isSelected && "ring-2 ring-primary border-primary"
      )}
    >
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <div onClick={() => onSelectContact && onSelectContact(call.contact)}>
        {isSelected && <CheckCircle className="h-4 w-4 text-white bg-primary rounded-full absolute -top-1.5 -left-1.5" />}
        <p className="font-medium text-sm flex items-center gap-2 pr-6">
          <User className="h-3.5 w-3.5" /> {call.contact.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
          <Phone className="h-3 w-3" /> {call.contact.phone}
        </p>
      </div>
    </div>
  );
};

const SortableCallItem = ({ call, onSelectContact, onToggleSelect, isSelected, onDelete }: { call: { contact: Contact; log: CallLog }, onSelectContact: (contact: Contact) => void, onToggleSelect: (logId: string) => void, isSelected: boolean, onDelete: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: call.log.originalIndex });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(isDragging && "opacity-50")} onClick={() => onToggleSelect(call.log.originalIndex)}>
      <DraggableContactCard call={call} onSelectContact={onSelectContact} isSelected={isSelected} onDelete={onDelete} />
    </div>
  );
};

const KanbanColumn = ({
  feedback,
  calls,
  onSelectContact,
  onToggleSelect,
  selectedLogIds,
  onDelete,
}: {
  feedback: CallLog['feedback'];
  calls: { contact: Contact; log: CallLog }[];
  onSelectContact: (contact: Contact) => void;
  onToggleSelect: (logId: string) => void;
  selectedLogIds: Set<string>;
  onDelete: (call: { contact: Contact; log: CallLog }) => void;
}) => {
  const { setNodeRef } = useSortable({ id: feedback });

  return (
    <div ref={setNodeRef} className="w-72 flex-shrink-0 bg-muted/30 rounded-lg p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        {getFeedbackBadge(feedback)}
        <span className="font-semibold text-sm text-muted-foreground">({calls.length})</span>
      </div>
      <SortableContext items={calls.map(c => c.log.originalIndex)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {calls.map((call) => (
            <SortableCallItem
              key={call.log.originalIndex}
              call={call}
              onSelectContact={onSelectContact}
              onToggleSelect={onToggleSelect}
              isSelected={selectedLogIds.has(call.log.originalIndex)}
              onDelete={() => onDelete(call)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanContent: React.FC<Omit<DailyCallDetailModalProps, 'isOpen' | 'onOpenChange'>> = ({ data, onSelectContact, onUpdateCallLogFeedback, onDeleteCallLog, onDeleteMultipleCallLogs }) => {
  const [columns, setColumns] = useState<Record<string, { contact: Contact; log: CallLog }[]>>({});
  const [activeDragItem, setActiveDragItem] = useState<{ contact: Contact; log: CallLog } | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [logToDelete, setLogToDelete] = useState<{ contact: Contact; log: CallLog } | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const { addOpportunitiesFromContacts } = useSalesOpportunity();

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
      setSelectedLogIds(new Set());
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

    setColumns(prev => {
      const newColumns = { ...prev };
      newColumns[activeColumnId] = newColumns[activeColumnId].filter(c => c.log.originalIndex !== activeId);
      if (!newColumns[overColumnId]) {
        newColumns[overColumnId] = [];
      }
      newColumns[overColumnId] = [...newColumns[overColumnId], callToMove];
      return newColumns;
    });

    const newFeedback = overColumnId as CallLog['feedback'];
    onUpdateCallLogFeedback(callToMove.contact.id, callToMove.log.originalIndex, newFeedback);
  };

  const handleToggleSelect = (logId: string) => {
    setSelectedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const handleCreateOpportunities = () => {
    if (selectedLogIds.size === 0 || !data) return;
    const selectedContacts = data.calls
      .filter(call => selectedLogIds.has(call.log.originalIndex))
      .map(call => call.contact);
    
    const uniqueContacts = Array.from(new Map(selectedContacts.map(c => [c.id, c])).values());
    
    addOpportunitiesFromContacts(uniqueContacts);
    setSelectedLogIds(new Set());
  };

  const handleDeleteConfirm = () => {
    if (logToDelete) {
      onDeleteCallLog(logToDelete.contact.id, logToDelete.log.originalIndex);
      setLogToDelete(null);
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedLogIds.size === 0 || !data) return;
    const logsToDelete = data.calls
      .filter(call => selectedLogIds.has(call.log.originalIndex))
      .map(call => ({ contactId: call.contact.id, logId: call.log.originalIndex }));
    
    onDeleteMultipleCallLogs(logsToDelete);
    setSelectedLogIds(new Set());
    setIsBulkDeleteOpen(false);
  };

  const allLogIdsInModal = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.calls.map(call => call.log.originalIndex));
  }, [data]);

  const handleSelectAll = () => {
    if (selectedLogIds.size === allLogIdsInModal.size) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(allLogIdsInModal);
    }
  };

  const feedbackOrder: CallLog['feedback'][] = ['Interested', 'Follow Up', 'Callback', 'Not Interested', 'Not Picked', 'Send Details'];

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="flex space-x-4 pb-4">
              {feedbackOrder.map((feedback) => (
                <KanbanColumn
                  key={feedback}
                  feedback={feedback}
                  calls={columns[feedback] || []}
                  onSelectContact={onSelectContact}
                  onToggleSelect={handleToggleSelect}
                  selectedLogIds={selectedLogIds}
                  onDelete={setLogToDelete}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <DragOverlay>
            {activeDragItem ? <DraggableContactCard call={activeDragItem} isOverlay /> : null}
          </DragOverlay>
        </div>
        {data && data.calls.length > 0 && (
          <div className="flex-shrink-0 p-4 border-t bg-background flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedLogIds.size === allLogIdsInModal.size ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm font-medium">{selectedLogIds.size} log(s) selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsBulkDeleteOpen(true)} disabled={selectedLogIds.size === 0} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button onClick={handleCreateOpportunities} disabled={selectedLogIds.size === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add to Opportunities
              </Button>
            </div>
          </div>
        )}
      </DndContext>
      <DeleteLogConfirmationDialog
        open={!!logToDelete}
        onOpenChange={(open) => !open && setLogToDelete(null)}
        onConfirm={handleDeleteConfirm}
        logDetails={logToDelete ? { contactName: logToDelete.contact.name, log: logToDelete.log } : null}
      />
      <BulkDeleteConfirmationDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        itemCount={selectedLogIds.size}
        itemName="call logs"
      />
    </>
  );
};

export const DailyCallDetailModal: React.FC<DailyCallDetailModalProps> = (props) => {
  const { isOpen, onOpenChange, data } = props;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="p-4 h-[85vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0 text-left">
            <DrawerTitle>
              Call Details for {data ? format(new Date(data.date), 'MMMM d, yyyy') : ''}
            </DrawerTitle>
            <DrawerDescription>
              Drag and drop contacts to update their status. Tap to select.
            </DrawerDescription>
          </DrawerHeader>
          <KanbanContent {...props} />
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
            Drag and drop contacts between columns to update their status. Click to select.
          </DialogDescription>
        </DialogHeader>
        <KanbanContent {...props} />
      </DialogContent>
    </Dialog>
  );
};