import { useState, useMemo, useEffect } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, IndianRupee, User, Calendar, MoreVertical, Edit, Trash2, MessageSquare, Send, Award, Download, Search, Phone, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSalesOpportunity } from "@/contexts/SalesOpportunityContext";
import { Opportunity, Note } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OpportunityForm } from "@/components/sales-tracker/OpportunityForm";
import { SalesTrackerSkeleton } from "@/components/skeletons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useContacts } from "@/contexts/ContactsContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const stages = ['Interested Lead', 'Meeting', 'Follow-ups', 'Negotiation', 'Closed Won', 'Closed Lost'];

const OpportunityCard = ({ opportunity, onEdit, onDelete, isExpanded, onExpand }: { opportunity: Opportunity, onEdit: (opp: Opportunity) => void, onDelete: (opp: Opportunity) => void, isExpanded: boolean, onExpand: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opportunity.id });
  const { addNoteToOpportunity, updateOpportunity } = useSalesOpportunity();
  const { userProfile } = useAuth();
  const [newNote, setNewNote] = useState("");
  const [meetingDateInput, setMeetingDateInput] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  const handleAddNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (newNote.trim()) {
      addNoteToOpportunity(opportunity.id, newNote);
      setNewNote("");
    }
  };

  const handleScheduleMeeting = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meetingDateInput) {
      updateOpportunity(opportunity.id, {
        meetingDate: new Date(meetingDateInput).toISOString(),
        meetingStatus: 'scheduled'
      });
    }
  };

  const handleMeetingFinished = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateOpportunity(opportunity.id, { meetingStatus: 'done' });
  };

  const getFirstName = (name: string) => {
    if (!name) return '';
    return name.split(' ')[0];
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className={cn(
          "mb-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-grab active:cursor-grabbing group",
          isDragging && "opacity-50",
          isExpanded && "ring-2 ring-primary"
        )}
        onClick={(e) => {
          const target = e.target as Element;
          if (!target.closest('button, a, [role="menuitem"], textarea, input')) {
            onExpand();
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <p className="font-semibold text-sm mb-2 pr-2 flex-1">{opportunity.title}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(opportunity)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(opportunity)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {opportunity.contact}</div>
            {opportunity.phone && (
              <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {opportunity.phone}</div>
            )}
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><IndianRupee className="h-3 w-3" />{opportunity.value.toLocaleString()}</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{new Date(opportunity.closeDate).toLocaleDateString()}</span>
            </div>
          </div>
          {opportunity.stage === 'Meeting' && (
            <div className="mt-3 pt-3 border-t border-dashed space-y-2">
              {!opportunity.meetingDate ? (
                <div className="space-y-2">
                  <Label htmlFor={`meeting-date-${opportunity.id}`} className="text-xs text-muted-foreground">Schedule Meeting</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`meeting-date-${opportunity.id}`}
                      type="datetime-local"
                      className="h-8 text-xs"
                      value={meetingDateInput}
                      onChange={(e) => setMeetingDateInput(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button size="sm" className="h-8 px-2" onClick={handleScheduleMeeting} disabled={!meetingDateInput}>Set</Button>
                  </div>
                </div>
              ) : opportunity.meetingStatus !== 'done' ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold">Meeting Scheduled:</p>
                    <p>{format(new Date(opportunity.meetingDate), 'PPp')}</p>
                  </div>
                  <Button size="sm" className="w-full h-8 bg-green-600 hover:bg-green-700" onClick={handleMeetingFinished}>
                    Meeting Finished
                  </Button>
                </div>
              ) : (
                <Badge className="bg-green-100 text-green-800 border-green-200 w-full justify-center py-1">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Meeting Done
                </Badge>
              )}
            </div>
          )}
        </CardContent>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t p-4 space-y-4">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</h4>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {opportunity.notes && opportunity.notes.length > 0 ? (
                    [...opportunity.notes].reverse().map(note => (
                      <div key={note.id} className="flex items-start gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{getInitials(note.authorName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted/50 p-2 rounded-md">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{getFirstName(note.authorName)}</span>
                            <span className="text-muted-foreground">{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm mt-1">{note.content}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
                  )}
                </div>
                <div className="flex gap-2 items-start" onClick={e => e.stopPropagation()}>
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="text-xs">{userProfile?.displayName ? getInitials(userProfile.displayName) : 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea 
                      placeholder="Add a note..." 
                      className="text-sm" 
                      rows={2}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <Button size="sm" className="mt-2" onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Send className="h-3 w-3 mr-2" /> Add Note
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};

interface StageColumnProps {
  title: string;
  opportunities: Opportunity[];
  onEdit: (opp: Opportunity) => void;
  onDelete: (opp: Opportunity) => void;
  expandedOppId: string | null;
  setExpandedOppId: (id: string | null) => void;
  isSearchable?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
}

const StageColumn = ({ title, opportunities, onEdit, onDelete, expandedOppId, setExpandedOppId, isSearchable, searchTerm, onSearchChange, hasMore, onLoadMore, totalCount }: StageColumnProps) => {
  const { setNodeRef } = useSortable({ id: title });
  return (
    <div ref={setNodeRef} className="w-72 flex-shrink-0 bg-muted/50 rounded-xl flex flex-col h-full">
      <div className="p-4 border-b space-y-2">
        <h3 className="font-semibold text-sm flex items-center justify-between">
          {title}
          <Badge variant="secondary">{totalCount !== undefined ? totalCount : opportunities.length}</Badge>
        </h3>
        {isSearchable && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        )}
      </div>
      <SortableContext items={opportunities.map(o => o.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2 flex-1 overflow-y-auto">
          {opportunities.map(opp => (
            <OpportunityCard 
              key={opp.id} 
              opportunity={opp} 
              onEdit={onEdit} 
              onDelete={onDelete}
              isExpanded={expandedOppId === opp.id}
              onExpand={() => setExpandedOppId(expandedOppId === opp.id ? null : opp.id)}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center mt-2">
              <Button variant="ghost" size="sm" onClick={onLoadMore}>Load More</Button>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default function SalesOpportunityPage() {
  const { opportunities, updateOpportunity, addOpportunity, deleteOpportunity, loading: opportunitiesLoading, addOpportunitiesFromContacts } = useSalesOpportunity();
  const { contacts: allContacts, loading: contactsLoading } = useContacts();
  const { toast } = useToast();
  const [activeOpp, setActiveOpp] = useState<Opportunity | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [opportunityToEdit, setOpportunityToEdit] = useState<Opportunity | null>(null);
  const [opportunityToDelete, setOpportunityToDelete] = useState<Opportunity | null>(null);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const [interestedLeadSearch, setInterestedLeadSearch] = useState("");
  const [visibleInterestedLeads, setVisibleInterestedLeads] = useState(15);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (opportunitiesLoading || contactsLoading) {
      return;
    }

    if (allContacts.length > 0) {
      const interestedContacts = allContacts.filter(contact => 
        contact.callHistory && contact.callHistory.some(log => log.feedback === 'Interested')
      );
      
      if (interestedContacts.length > 0) {
        addOpportunitiesFromContacts(interestedContacts);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContacts, opportunitiesLoading, contactsLoading]);

  const totalValue = useMemo(() => 
    opportunities
      .filter(opp => opp.stage !== 'Closed Won' && opp.stage !== 'Closed Lost')
      .reduce((sum, opp) => sum + opp.value, 0),
    [opportunities]
  );

  const wonValue = useMemo(() =>
    opportunities
      .filter(opp => opp.stage === 'Closed Won')
      .reduce((sum, opp) => sum + opp.value, 0),
    [opportunities]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveOpp(opportunities.find(o => o.id === active.id) || null);
    setExpandedOppId(null); // Collapse any open card on drag start
  };

  const handleDragCancel = () => {
    setActiveOpp(null);
  };

  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOpp(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeOpp = opportunities.find(o => o.id === activeId);
    if (!activeOpp) return;

    const overIsColumn = stages.includes(overId);
    const overOpp = opportunities.find(o => o.id === overId);
    const newStage = overIsColumn ? overId : overOpp?.stage;

    if (newStage && activeOpp.stage !== newStage) {
      updateOpportunity(activeId, { stage: newStage as Opportunity['stage'] });
    }
  };

  const handleFormSubmit = async (data: Omit<Opportunity, "id" | "teamId" | "createdBy" | "createdAt">) => {
    if (opportunityToEdit) {
      await updateOpportunity(opportunityToEdit.id, data);
    } else {
      await addOpportunity(data);
    }
    setIsFormOpen(false);
    setOpportunityToEdit(null);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setOpportunityToEdit(null);
  };

  const handleEdit = (opp: Opportunity) => {
    setOpportunityToEdit(opp);
    setIsFormOpen(true);
  };

  const handleDelete = (opp: Opportunity) => {
    setOpportunityToDelete(opp);
  };

  const handleConfirmDelete = () => {
    if (opportunityToDelete) {
      deleteOpportunity(opportunityToDelete.id);
      setOpportunityToDelete(null);
    }
  };

  if (opportunitiesLoading || contactsLoading) {
    return <SalesTrackerSkeleton />;
  }

  return (
    <div className="h-full flex flex-col p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Sales Opportunities</h1>
            <p className="text-muted-foreground">Manage your sales pipeline from lead to close.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid gap-4 grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">from {opportunities.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost').length} opportunities</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Won Value</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">₹{wonValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">from {opportunities.filter(o => o.stage === 'Closed Won').length} deals</p>
                </CardContent>
              </Card>
            </div>
            <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) handleFormCancel(); else setIsFormOpen(true); }}>
              <DialogTrigger asChild>
                <Button variant="focus"><Plus className="h-4 w-4 mr-2" /> New Opportunity</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{opportunityToEdit ? "Edit Opportunity" : "Create New Opportunity"}</DialogTitle>
                </DialogHeader>
                <OpportunityForm
                  opportunity={opportunityToEdit || undefined}
                  onSubmit={handleFormSubmit}
                  onCancel={handleFormCancel}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={closestCenter}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageOpportunities = opportunities.filter(o => o.stage === stage);

            if (stage === 'Interested Lead') {
              const filteredLeads = stageOpportunities.filter(opp =>
                opp.title.toLowerCase().includes(interestedLeadSearch.toLowerCase()) ||
                opp.contact.toLowerCase().includes(interestedLeadSearch.toLowerCase())
              );
              const visibleLeads = filteredLeads.slice(0, visibleInterestedLeads);

              return (
                <StageColumn
                  key={stage}
                  title={stage}
                  opportunities={visibleLeads}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  expandedOppId={expandedOppId}
                  setExpandedOppId={setExpandedOppId}
                  isSearchable={true}
                  searchTerm={interestedLeadSearch}
                  onSearchChange={setInterestedLeadSearch}
                  hasMore={filteredLeads.length > visibleInterestedLeads}
                  onLoadMore={() => setVisibleInterestedLeads(prev => prev + 15)}
                  totalCount={filteredLeads.length}
                />
              );
            }

            return (
              <StageColumn
                key={stage}
                title={stage}
                opportunities={stageOpportunities}
                onEdit={handleEdit}
                onDelete={handleDelete}
                expandedOppId={expandedOppId}
                setExpandedOppId={setExpandedOppId}
              />
            );
          })}
        </div>
        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeOpp ? <OpportunityCard opportunity={activeOpp} onEdit={() => {}} onDelete={() => {}} isExpanded={false} onExpand={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <DeleteConfirmationDialog
        open={!!opportunityToDelete}
        onOpenChange={(open) => !open && setOpportunityToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Opportunity"
        itemName={opportunityToDelete?.title}
      />
    </div>
  );
}