import React, { useState, useMemo, useEffect } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, Users, PlayCircle, ArrowRight, Trash2, Loader2, Filter, Calendar as CalendarIcon, X, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { rtdb } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FilterPanel } from './FilterPanel';
import { useDebounce } from '@/hooks/usePerformance';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

interface DialerSetupViewProps {
  contacts: Contact[];
}

const ITEMS_PER_PAGE = 30;

const SortableContactItem = ({ id, contact, children, onRemove }: { id: string, contact: Contact, children: React.ReactNode, onRemove: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border cursor-grab">
      {children}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemove(id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const DraggableContactItem = ({ contact, isSelected, onToggle, onAdd }: { contact: Contact, isSelected: boolean, onToggle: (id: string) => void, onAdd: (contact: Contact) => void }) => {
  const { attributes, listeners, setNodeRef } = useSortable({ id: contact.id });
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => onAdd(contact)}>
      <Checkbox id={`contact-${contact.id}`} checked={isSelected} onCheckedChange={() => onToggle(contact.id)} onClick={(e) => e.stopPropagation()} />
      <label htmlFor={`contact-${contact.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
        <Avatar className="h-10 w-10 border"><AvatarFallback>{getInitials(contact.name)}</AvatarFallback></Avatar>
        <div>
          <p className="font-medium">{contact.name}</p>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
        </div>
      </label>
    </div>
  );
};

export const DialerSetupView: React.FC<DialerSetupViewProps> = ({ contacts }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [callQueue, setCallQueue] = useState<Contact[]>([]);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [filters, setFilters] = useState<{ dateRange: DateRange | undefined; initialCallFeedback: string[]; followUpCallFeedback: string[] }>({
    dateRange: undefined, initialCallFeedback: [], followUpCallFeedback: []
  });
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      if (debouncedSearchTerm && !(contact.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || contact.phone.includes(debouncedSearchTerm))) {
        return false;
      }

      const { dateRange, initialCallFeedback, followUpCallFeedback } = filters;

      if (dateRange?.from || dateRange?.to) {
        const from = dateRange.from ? startOfDay(dateRange.from) : null;
        const to = dateRange.to ? endOfDay(dateRange.to) : null;
        const isInRange = contact.callHistory.some(log => {
          const logDate = new Date(log.timestamp);
          return (!from || logDate >= from) && (!to || logDate <= to);
        });
        if (!isInRange) return false;
      }

      const hasInitialFilter = initialCallFeedback.length > 0;
      const hasFollowUpFilter = followUpCallFeedback.length > 0;

      if (!hasInitialFilter && !hasFollowUpFilter) {
        return true;
      }

      let matchesInitial = false;
      if (hasInitialFilter) {
        const initialCall = contact.callHistory.find(log => log.type === 'New Call');
        if (initialCall && initialCallFeedback.includes(initialCall.feedback)) {
          matchesInitial = true;
        }
      }

      let matchesFollowUp = false;
      if (hasFollowUpFilter) {
        const hasMatchingFollowUp = contact.callHistory.some(log =>
          log.type === 'Follow-up' && followUpCallFeedback.includes(log.feedback)
        );
        if (hasMatchingFollowUp) {
          matchesFollowUp = true;
        }
      }

      if (hasInitialFilter && hasFollowUpFilter) {
        return matchesInitial || matchesFollowUp;
      }
      if (hasInitialFilter) {
        return matchesInitial;
      }
      if (hasFollowUpFilter) {
        return matchesFollowUp;
      }

      return true;
    });
  }, [contacts, debouncedSearchTerm, filters]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [filteredContacts]);

  const availableContacts = useMemo(() => {
    const queueIds = new Set(callQueue.map(c => c.id));
    return filteredContacts.filter(c => !queueIds.has(c.id));
  }, [filteredContacts, callQueue]);

  const visibleContacts = useMemo(() => {
    return availableContacts.slice(0, visibleCount);
  }, [availableContacts, visibleCount]);

  const handleToggleContact = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) newSet.delete(contactId);
      else newSet.add(contactId);
      return newSet;
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedContactIds(checked ? new Set(availableContacts.map(c => c.id)) : new Set());
  };

  const handleAddToQueue = () => {
    const contactsToAdd = contacts.filter(c => selectedContactIds.has(c.id));
    const newQueue = [...callQueue];
    contactsToAdd.forEach(contact => {
      if (!newQueue.some(c => c.id === contact.id)) newQueue.push(contact);
    });
    setCallQueue(newQueue);
    setSelectedContactIds(new Set());
    toast({ title: `${contactsToAdd.length} contact(s) added to queue.` });
  };

  const handleClickToAdd = (contact: Contact) => {
    if (!callQueue.some(c => c.id === contact.id)) setCallQueue(prev => [...prev, contact]);
  };

  const handleRemoveFromQueue = (contactId: string) => {
    setCallQueue(prev => prev.filter(c => c.id !== contactId));
  };

  const handleStartDialing = async () => {
    if (!user || callQueue.length === 0) return;
    setIsStartingSession(true);
    try {
      const updates: { [key: string]: any } = {};
      updates[`dialingQueue/${user.uid}`] = callQueue;
      updates['dialerBridge/activeWebUser'] = user.uid;
      await update(ref(rtdb), updates);
      toast({ title: "Dialing Queue Sent!", description: "Open the Sales Dialer app and press 'Start Dialing' to begin." });
      setCallQueue([]);
    } catch (error) {
      console.error("Failed to send dialing queue:", error);
      toast({ title: "Failed to send queue", variant: "destructive" });
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeIsInQueue = callQueue.some(c => c.id === activeId);
    const overIsInQueue = callQueue.some(c => c.id === overId);

    if (activeIsInQueue && overIsInQueue && activeId !== overId) {
      setCallQueue(items => {
        const oldIndex = items.findIndex(item => item.id === activeId);
        const newIndex = items.findIndex(item => item.id === overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    } else if (!activeIsInQueue && (overIsInQueue || over.id === 'call-queue-droppable')) {
      const contactToMove = availableContacts.find(c => c.id === activeId);
      if (contactToMove) {
        setCallQueue(prev => {
          const newQueue = [...prev];
          if (overIsInQueue) {
            const overIndex = newQueue.findIndex(c => c.id === overId);
            newQueue.splice(overIndex, 0, contactToMove);
          } else {
            newQueue.push(contactToMove);
          }
          return newQueue;
        });
      }
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
        <ResizablePanel defaultSize={55} minSize={30}>
          <Card className="flex flex-col h-full border-0 shadow-none rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Available Contacts</CardTitle>
              <Input placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mt-2"><Filter className="h-4 w-4 mr-2" /> Advanced Filters <ChevronDown className="h-4 w-4 ml-auto" /></Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FilterPanel filters={filters} onFiltersChange={setFilters} />
                </CollapsibleContent>
              </Collapsible>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="select-all" checked={selectedContactIds.size > 0 && selectedContactIds.size === availableContacts.length} onCheckedChange={handleToggleSelectAll} />
                <label htmlFor="select-all" className="text-sm font-medium">Select All ({availableContacts.length})</label>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  <SortableContext items={visibleContacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {visibleContacts.map(contact => (
                      <DraggableContactItem key={contact.id} contact={contact} isSelected={selectedContactIds.has(contact.id)} onToggle={handleToggleContact} onAdd={handleClickToAdd} />
                    ))}
                  </SortableContext>
                  {visibleCount < availableContacts.length && (
                    <div className="flex justify-center py-4">
                      <Button variant="outline" onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}>
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={30}>
          <Card className="flex flex-col h-full border-0 shadow-none rounded-none">
            <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Call Queue</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2" id="call-queue-droppable">
                  <SortableContext items={callQueue.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <AnimatePresence>
                      {callQueue.map((contact, index) => (
                        <motion.div key={contact.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                          <SortableContactItem id={contact.id} contact={contact} onRemove={handleRemoveFromQueue}>
                            <span className="font-mono text-sm text-muted-foreground cursor-grab">{index + 1}.</span>
                            <Avatar className="h-10 w-10 border"><AvatarFallback>{getInitials(contact.name)}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="font-medium">{contact.name}</p><p className="text-sm text-muted-foreground">{contact.phone}</p></div>
                          </SortableContactItem>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                  {callQueue.length === 0 && (<div className="text-center py-16 text-muted-foreground"><p>Click or drag contacts here to build your queue.</p></div>)}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="p-4 border-t flex flex-col gap-4 flex-shrink-0">
              <Button onClick={handleAddToQueue} disabled={selectedContactIds.size === 0} variant="outline"><ArrowRight className="h-4 w-4 mr-2" />Add {selectedContactIds.size > 0 ? `(${selectedContactIds.size})` : ''} to Queue</Button>
              <Button onClick={handleStartDialing} disabled={callQueue.length === 0 || isStartingSession}>{isStartingSession ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}Send Queue to Dialer ({callQueue.length})</Button>
            </div>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </DndContext>
  );
};