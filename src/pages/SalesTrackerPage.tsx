import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react"; // Import React for forwardRef
import { useAuth } from "@/contexts/AuthContext";
import { rtdb } from "@/lib/firebase";
import { ref, onValue, set, update, push } from "firebase/database";
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { AnalyticsView } from "@/components/sales-tracker/AnalyticsView";
import { ContactDetailPanel } from "@/components/sales-tracker/ContactDetailPanel";
import { FilterPanel, FilterState } from "@/components/sales-tracker/FilterPanel";
import { DailyCallDetailModal } from "@/components/sales-tracker/DailyCallDetailModal";
import { ExportFilterDialog, ExportFilterState } from "@/components/sales-tracker/ExportFilterDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Search, Phone, Calendar, ChevronRight, Loader2, Filter, FileDown, PhoneCall, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { startOfDay, endOfDay, format } from "date-fns";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { SalesTrackerSkeleton, ContactListItemSkeleton } from "@/components/skeletons";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { useDebounce } from "@/hooks/usePerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveCallView } from "@/components/sales-tracker/LiveCallView";
import { DialerSetupView } from "@/components/sales-tracker/DialerSetupView";
import { useContacts } from "@/contexts/ContactsContext";
import { useSalesOpportunity } from "@/contexts/SalesOpportunityContext";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteConfirmationDialog } from "@/components/sales-tracker/BulkDeleteConfirmationDialog";

const ITEMS_PER_PAGE = 30;

const FilterTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & { activeFilterCount: number }
>(({ activeFilterCount, ...props }, ref) => (
  <Button ref={ref} variant="outline" className="gap-2" {...props}>
    <Filter className="h-4 w-4" />
    Filters
    {activeFilterCount > 0 && (
      <Badge variant="secondary" className="rounded-full px-2">{activeFilterCount}</Badge>
    )}
  </Button>
));
FilterTrigger.displayName = 'FilterTrigger';

interface ContactsListViewProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (isOpen: boolean) => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  loading: boolean;
  visibleContacts: Contact[];
  handleSelectContact: (contact: Contact) => void;
  selectedContact: Contact | null;
  visibleCount: number;
  filteredContacts: Contact[];
  setVisibleCount: (updater: (prev: number) => number) => void;
  isMobile: boolean;
  activeFilterCount: number;
  selectedForOppIds: Set<string>;
  onToggleSelection: (contactId: string) => void;
}

const ContactsListView: React.FC<ContactsListViewProps> = ({
  searchTerm, setSearchTerm, isFilterOpen, setIsFilterOpen, filters, setFilters, loading,
  visibleContacts, handleSelectContact, selectedContact, visibleCount, filteredContacts,
  setVisibleCount, isMobile, activeFilterCount, selectedForOppIds, onToggleSelection
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {isMobile ? (
          <Drawer open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DrawerTrigger asChild><FilterTrigger activeFilterCount={activeFilterCount} /></DrawerTrigger>
            <DrawerContent>
              <FilterPanel filters={filters} onFiltersChange={setFilters} />
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild><FilterTrigger activeFilterCount={activeFilterCount} /></PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <FilterPanel filters={filters} onFiltersChange={setFilters} />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <ScrollArea className="flex-1 -mx-4">
        <div className="px-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => <ContactListItemSkeleton key={i} />)}
            </div>
          ) : visibleContacts.length > 0 ? (
            <>
              {visibleContacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  className={cn(
                    "w-full text-left p-4 bg-background rounded-lg border hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer",
                    selectedContact?.id === contact.id && "bg-muted/50 border-primary",
                    selectedForOppIds.has(contact.id) && "ring-2 ring-primary border-primary"
                  )}
                >
                  <Checkbox
                    checked={selectedForOppIds.has(contact.id)}
                    onCheckedChange={() => onToggleSelection(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{contact.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {contact.phone}</span>
                      {contact.callHistory.length > 0 && (
                        <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {new Date(contact.callHistory[0].timestamp).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
              {visibleCount < filteredContacts.length && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No contacts found.</p>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default function SalesTrackerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { contacts, loading } = useContacts();
  const { addOpportunitiesFromContacts } = useSalesOpportunity();
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'contacts' | 'analytics' | 'live-call' | 'dialer'>('contacts');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: undefined,
    initialCallFeedback: [],
    followUpCallFeedback: [],
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isMobile = useIsMobile();
  const [detailModalData, setDetailModalData] = useState<{ date: string; calls: { contact: Contact; log: CallLog }[] } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [liveCallData, setLiveCallData] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedForOppIds, setSelectedForOppIds] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ date: string; count: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    const liveCallRef = ref(rtdb, 'liveCallStatus');

    const unsubscribeLiveCall = onValue(liveCallRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.currentContact) {
            const processContactData = (contactData: any): Contact => {
                const callHistoryArray: CallLog[] = contactData.callHistory 
                  ? Object.entries(contactData.callHistory as Record<string, any>)
                      .map(([key, value]) => ({ ...(value as object), originalIndex: key }))
                      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((log: any, index: number, array: any[]) => ({
                        ...log,
                        type: index === array.length - 1 ? 'New Call' : 'Follow-up',
                      }))
                  : [];
                
                const latestCall = callHistoryArray[0] || null;

                return {
                    id: contactData.phoneNumber,
                    name: contactData.name || 'N/A',
                    phone: contactData.phoneNumber,
                    callHistory: callHistoryArray,
                    status: latestCall?.feedback || 'No History',
                    lastContacted: latestCall?.timestamp || new Date().toISOString(),
                    callCount: contactData.callCount || 0,
                };
            };

            const processedCurrentContact = processContactData(data.currentContact);
            const processedNextContact = data.nextContact ? processContactData(data.nextContact) : undefined;

            setLiveCallData({
                ...data,
                currentContact: processedCurrentContact,
                nextContact: processedNextContact,
            });

            if (activeView !== 'live-call') {
              setActiveView('live-call');
            }
        } else {
            setLiveCallData(null);
            if (activeView === 'live-call') {
                setActiveView('contacts');
            }
        }
    });

    return () => {
      unsubscribeLiveCall();
    };
  }, [user, activeView]);

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
  
      if (initialCallFeedback.length > 0) {
          const initialCall = contact.callHistory.find(log => log.type === 'New Call');
          if (!initialCall || !initialCallFeedback.includes(initialCall.feedback)) {
              return false;
          }
      }
  
      if (followUpCallFeedback.length > 0) {
          const hasMatchingFollowUp = contact.callHistory.some(log => 
              log.type === 'Follow-up' && followUpCallFeedback.includes(log.feedback)
          );
          if (!hasMatchingFollowUp) {
              return false;
          }
      }
  
      return true;
    });
  }, [contacts, debouncedSearchTerm, filters]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [debouncedSearchTerm, filters]);

  const visibleContacts = useMemo(() => {
    return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  const handleExportContacts = (exportFilters: ExportFilterState) => {
    const { dateRange, initialCallFeedback, followUpCallFeedback } = exportFilters;

    const includesNewContacts = initialCallFeedback.includes('New Contact');
    const otherInitialFeedbacks = initialCallFeedback.filter(f => f !== 'New Contact');

    const isAnyFilterActive = includesNewContacts || otherInitialFeedbacks.length > 0 || followUpCallFeedback.length > 0 || dateRange?.from;
    if (!isAnyFilterActive) {
        toast({
            title: "No Filters Selected",
            description: "Please select at least one filter to export contacts.",
        });
        return;
    }

    const filtered = contacts.filter(contact => {
        const hasCallHistory = contact.callHistory && contact.callHistory.length > 0;

        if (includesNewContacts && !hasCallHistory) {
            if (dateRange?.from) return false;
            return true;
        }

        if (!hasCallHistory) {
            return false;
        }

        if (includesNewContacts && otherInitialFeedbacks.length === 0 && followUpCallFeedback.length === 0 && !dateRange?.from) {
            return false;
        }

        const matchesOtherCriteria = contact.callHistory.some(log => {
            let dateMatch = true;
            if (dateRange?.from) {
                const from = startOfDay(dateRange.from);
                const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                const logDate = new Date(log.timestamp);
                dateMatch = logDate >= from && logDate <= to;
            }
            if (!dateMatch) return false;

            const initialMatch = log.type === 'New Call' && otherInitialFeedbacks.includes(log.feedback);
            const followupMatch = log.type === 'Follow-up' && followUpCallFeedback.includes(log.feedback);

            if (otherInitialFeedbacks.length === 0 && followUpCallFeedback.length === 0) {
                return true;
            }

            return initialMatch || followupMatch;
        });

        return matchesOtherCriteria;
    });

    if (filtered.length === 0) {
        toast({
            title: "No Contacts Found",
            description: "No contacts match the selected filters.",
            variant: "destructive",
        });
        return;
    }

    const dataToExport = filtered.map(contact => {
      const latestCall = contact.callHistory && contact.callHistory.length > 0 ? contact.callHistory[0] : null;
      return {
        'Company Name': contact.name,
        'Phone Number': contact.phone,
        'Spoke To': latestCall?.spokenTo || 'N/A',
        'Last Status': contact.status,
        'Last Contacted': contact.lastContacted ? format(new Date(contact.lastContacted), 'PPp') : 'N/A'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

    worksheet['!cols'] = [ { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 } ];

    XLSX.writeFile(workbook, "Filtered_Contacts.xlsx");

    toast({
        title: "Export Successful",
        description: `Exported ${filtered.length} contacts.`,
    });
  };

  const handleSelectContact = (contact: Contact) => {
    const fullContactDetails = contacts.find(c => c.id === contact.id);
    setSelectedContact(fullContactDetails || contact);
    if (activeView === 'live-call') {
      setIsDetailModalOpen(true);
    }
  };

  const handleDateClick = (date: string, filter: 'New Call' | 'Follow-up' | 'all') => {
    const relevantCalls = contacts.flatMap(contact => 
        contact.callHistory
            .filter(log => {
                const logDate = format(startOfDay(new Date(log.timestamp)), 'yyyy-MM-dd');
                const typeMatch = filter === 'all' || log.type === filter;
                return logDate === date && typeMatch;
            })
            .map(log => ({ contact, log }))
    );
    
    setDetailModalData({ date, calls: relevantCalls });
  };

  const handleSelectContactFromDetail = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);
  };

  const handleUpdateCallLogMessage = async (contactId: string, callLogIndex: string, newMessage: string) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    const logMessageRef = ref(rtdb, `contacts/${contactId}/callHistory/${callLogIndex}/message`);
    try {
      await set(logMessageRef, newMessage);
      toast({ title: "Note updated successfully!" });
    } catch (error) {
      console.error("Error updating call log message:", error);
      toast({ title: "Failed to update note", variant: "destructive" });
    }
  };

  const handleUpdateCallLogFeedback = async (contactId: string, callLogIndex: string, newFeedback: CallLog['feedback']) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    const logFeedbackRef = ref(rtdb, `contacts/${contactId}/callHistory/${callLogIndex}/feedback`);
    try {
      await set(logFeedbackRef, newFeedback);
      toast({ title: "Contact status updated!" });
    } catch (error) {
      console.error("Error updating call log feedback:", error);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDeleteCallLog = async (contactId: string, logId: string) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    const logRef = ref(rtdb, `contacts/${contactId}/callHistory/${logId}`);
    try {
      await set(logRef, null);
      toast({ title: "Call log deleted." });
      if (detailModalData) {
        const updatedCalls = detailModalData.calls.filter(call => call.log.originalIndex !== logId);
        setDetailModalData({ ...detailModalData, calls: updatedCalls });
      }
    } catch (error) {
      console.error("Error deleting call log:", error);
      toast({ title: "Failed to delete log", variant: "destructive" });
    }
  };

  const handleDeleteMultipleCallLogs = async (logsToDelete: { contactId: string; logId: string }[]) => {
    if (!user || logsToDelete.length === 0) return;

    const updates: { [key: string]: null } = {};
    logsToDelete.forEach(({ contactId, logId }) => {
      updates[`contacts/${contactId}/callHistory/${logId}`] = null;
    });

    try {
      await update(ref(rtdb), updates);
      toast({ title: `${logsToDelete.length} call log(s) deleted.` });
      if (detailModalData) {
        const deletedLogIds = new Set(logsToDelete.map(l => l.logId));
        const updatedCalls = detailModalData.calls.filter(call => !deletedLogIds.has(call.log.originalIndex));
        setDetailModalData({ ...detailModalData, calls: updatedCalls });
      }
    } catch (error) {
      console.error("Error deleting multiple call logs:", error);
      toast({ title: "Failed to delete logs", variant: "destructive" });
    }
  };

  const handleMarkAsSent = async (contactId: string) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }

    const contact = contacts.find(c => c.id === contactId);
    const latestLog = contact?.callHistory?.[0];

    if (!contact || !latestLog || latestLog.feedback !== 'Send Details') {
      toast({ title: "Invalid Action", description: "This action is only for contacts awaiting details.", variant: "destructive" });
      return;
    }

    const logIndex = latestLog.originalIndex;
    if (!logIndex) {
        toast({ title: "Data Error", description: "Cannot find the original call log to update.", variant: "destructive" });
        return;
    }

    const logRef = ref(rtdb, `contacts/${contactId}/callHistory/${logIndex}`);
    
    const originalMessage = latestLog.message || "";
    const updateMessage = `[Details Sent on ${new Date().toLocaleDateString()}] ${originalMessage}`.trim();

    const updates = {
      feedback: 'Interested',
      message: updateMessage,
    };

    try {
      await update(logRef, updates);
      toast({ title: "Status Updated!", description: `${contact.name} is now marked as Interested.` });
    } catch (error) {
      console.error("Error marking as sent:", error);
      toast({ title: "Update Failed", variant: "destructive" });
    }
  };

  const handleToggleSelection = (contactId: string) => {
    setSelectedForOppIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleCreateOpportunities = () => {
    const selected = contacts.filter(c => selectedForOppIds.has(c.id));
    addOpportunitiesFromContacts(selected);
    setSelectedForOppIds(new Set());
  };

  const handleSaveImportedContacts = async (importedContacts: Contact[]) => {
    if (!user || importedContacts.length === 0) return;

    const existingPhones = new Set(contacts.map(c => c.phone));
    const updates: { [key: string]: any } = {};
    let newContactsCount = 0;

    importedContacts.forEach(contact => {
      if (!existingPhones.has(contact.phone)) {
        const contactPath = `contacts/${contact.phone}`;
        updates[contactPath] = {
          name: contact.name,
          phoneNumber: contact.phone,
          callCount: 0,
          callHistory: {},
        };
        newContactsCount++;
      }
    });

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No New Contacts to Save",
        description: "All imported contacts already exist in your master list.",
      });
      return;
    }

    try {
      await update(ref(rtdb), updates);
      toast({
        title: "Contacts Saved!",
        description: `${newContactsCount} new contacts have been saved to your master list.`,
      });
    } catch (error) {
      console.error("Error saving imported contacts:", error);
      toast({
        title: "Save Failed",
        description: "Could not save the imported contacts to Firebase.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFinishSession = async () => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    try {
      const updates: { [key: string]: null } = {};
      updates['liveCallStatus'] = null;
      updates['dialerBridge/activeWebUser'] = null;
      await update(ref(rtdb), updates);
      toast({ title: "Call session finished." });
    } catch (error) {
      console.error("Failed to finish session:", error);
      toast({ title: "Error", description: "Could not finish the session.", variant: "destructive" });
    }
  };

  const handleDeleteDateSummary = (date: string, count: number) => {
    setDeleteConfirmation({ date, count });
  };

  const handleConfirmDeleteDateSummary = async () => {
    if (!deleteConfirmation || !user) return;
    const { date } = deleteConfirmation;

    const updates: { [key: string]: null } = {};
    let logsDeletedCount = 0;

    contacts.forEach(contact => {
      contact.callHistory.forEach(log => {
        const logDate = format(startOfDay(new Date(log.timestamp)), 'yyyy-MM-dd');
        if (logDate === date) {
          updates[`contacts/${contact.phone}/callHistory/${log.originalIndex}`] = null;
          logsDeletedCount++;
        }
      });
    });

    if (Object.keys(updates).length > 0) {
      try {
        await update(ref(rtdb), updates);
        toast({ title: `Successfully deleted ${logsDeletedCount} call logs for ${format(new Date(date), 'PP')}.` });
      } catch (error) {
        console.error("Error deleting date summary:", error);
        toast({ title: "Deletion failed", variant: "destructive" });
      }
    }

    setDeleteConfirmation(null);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const activeFilterCount = 
    (filters.dateRange?.from ? 1 : 0) + 
    filters.initialCallFeedback.length + 
    filters.followUpCallFeedback.length;

  if (loading && contacts.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-background">
        <header className="flex-shrink-0 bg-background border-b p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Sales Tracker
          </h1>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-48" />
          </div>
        </header>
        <SalesTrackerSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-background">
      <header className="flex-shrink-0 bg-background border-b p-2 md:p-4 flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <span className="hidden sm:inline">Sales Tracker</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size={isMobile ? "icon" : "default"} onClick={() => setIsExportDialogOpen(true)}>
            <FileDown className={cn("h-4 w-4", !isMobile && "mr-2")} />
            <span className="hidden md:inline">Export</span>
          </Button>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button size="sm" variant={activeView === 'live-call' ? 'default' : 'ghost'} onClick={() => setActiveView('live-call')} className="gap-2 px-2 md:px-3 relative">
                {liveCallData && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-ping"></span>}
                <Phone className="h-4 w-4" />
                <span className="hidden md:inline">Live Call</span>
            </Button>
            <Button size="sm" variant={activeView === 'dialer' ? 'default' : 'ghost'} onClick={() => setActiveView('dialer')} className="gap-2 px-2 md:px-3">
              <PhoneCall className="h-4 w-4" />
              <span className="hidden md:inline">Dialer</span>
            </Button>
            <Button size="sm" variant={activeView === 'contacts' ? 'default' : 'ghost'} onClick={() => setActiveView('contacts')} className="gap-2 px-2 md:px-3">
              <Users className="h-4 w-4" />
              <span className="hidden md:inline">Contacts</span>
            </Button>
            <Button size="sm" variant={activeView === 'analytics' ? 'default' : 'ghost'} onClick={() => setActiveView('analytics')} className="gap-2 px-2 md:px-3">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Analytics</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={containerVariants}
            className="p-4 md:p-6 h-full"
          >
            {activeView === 'live-call' ? (
              <LiveCallView liveCallData={liveCallData} onUpdateCallLogMessage={handleUpdateCallLogMessage} onMarkAsSent={handleMarkAsSent} onFinishSession={handleFinishSession} />
            ) : activeView === 'dialer' ? (
              <DialerSetupView contacts={contacts} onSaveImportedContacts={handleSaveImportedContacts} />
            ) : activeView === 'contacts' ? (
              isMobile ? (
                <ContactsListView 
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  isFilterOpen={isFilterOpen}
                  setIsFilterOpen={setIsFilterOpen}
                  filters={filters}
                  setFilters={setFilters}
                  loading={loading}
                  visibleContacts={visibleContacts}
                  handleSelectContact={handleSelectContact}
                  selectedContact={selectedContact}
                  visibleCount={visibleCount}
                  filteredContacts={filteredContacts}
                  setVisibleCount={setVisibleCount}
                  isMobile={isMobile}
                  activeFilterCount={activeFilterCount}
                  selectedForOppIds={selectedForOppIds}
                  onToggleSelection={handleToggleSelection}
                />
              ) : (
                <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
                  <ResizablePanel defaultSize={40} minSize={30}>
                    <div className="p-4 h-full">
                      <ContactsListView 
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        isFilterOpen={isFilterOpen}
                        setIsFilterOpen={setIsFilterOpen}
                        filters={filters}
                        setFilters={setFilters}
                        loading={loading}
                        visibleContacts={visibleContacts}
                        handleSelectContact={handleSelectContact}
                        selectedContact={selectedContact}
                        visibleCount={visibleCount}
                        filteredContacts={filteredContacts}
                        setVisibleCount={setVisibleCount}
                        isMobile={isMobile}
                        activeFilterCount={activeFilterCount}
                        selectedForOppIds={selectedForOppIds}
                        onToggleSelection={handleToggleSelection}
                      />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={60} minSize={40}>
                    {selectedContact ? (
                      <ContactDetailPanel contact={selectedContact} onUpdateCallLogMessage={handleUpdateCallLogMessage} onMarkAsSent={handleMarkAsSent} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p>Select a contact to view details</p>
                        </div>
                      </div>
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              )
            ) : (
              <ScrollArea className="h-full -m-4 md:-m-6">
                <div className="p-4 md:p-6">
                  <AnalyticsView contacts={contacts} onDateClick={handleDateClick} onDeleteDate={handleDeleteDateSummary} />
                </div>
              </ScrollArea>
            )}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {selectedForOppIds.size > 0 && activeView === 'contacts' && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
            >
              <div className="flex items-center gap-4 bg-background p-3 rounded-lg shadow-lg border">
                <span className="text-sm font-medium">{selectedForOppIds.size} contact(s) selected</span>
                <Button onClick={handleCreateOpportunities}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Opportunities
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isMobile && (
        <Drawer
          open={!!selectedContact}
          onOpenChange={(isOpen) => !isOpen && setSelectedContact(null)}
        >
          <DrawerPortal>
            <DrawerOverlay className="fixed inset-0 bg-black/40" />
            <DrawerContent className="bg-background flex flex-col outline-none h-[90%] mt-24 fixed bottom-0 left-0 right-0 rounded-t-lg">
              <ContactDetailPanel contact={selectedContact} onUpdateCallLogMessage={handleUpdateCallLogMessage} onMarkAsSent={handleMarkAsSent} />
            </DrawerContent>
          </DrawerPortal>
        </Drawer>
      )}

      <DailyCallDetailModal
        isOpen={!!detailModalData}
        onOpenChange={(isOpen) => !isOpen && setDetailModalData(null)}
        data={detailModalData}
        onSelectContact={handleSelectContactFromDetail}
        onUpdateCallLogFeedback={handleUpdateCallLogFeedback}
        onDeleteCallLog={handleDeleteCallLog}
        onDeleteMultipleCallLogs={handleDeleteMultipleCallLogs}
      />

      <ExportFilterDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExportContacts}
      />

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <ContactDetailPanel contact={selectedContact} onUpdateCallLogMessage={handleUpdateCallLogMessage} onMarkAsSent={handleMarkAsSent} />
        </DialogContent>
      </Dialog>

      <BulkDeleteConfirmationDialog
        open={!!deleteConfirmation}
        onOpenChange={(isOpen) => !isOpen && setDeleteConfirmation(null)}
        onConfirm={handleConfirmDeleteDateSummary}
        itemCount={deleteConfirmation?.count || 0}
        itemName={`call logs for ${deleteConfirmation ? format(new Date(deleteConfirmation.date), 'PP') : ''}`}
      />
    </div>
  );
}