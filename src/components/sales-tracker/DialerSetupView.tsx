import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, Users, PlayCircle, ArrowRight, Trash2, Loader2, Filter, Calendar as CalendarIcon, X, ChevronDown, Upload, Save, Download, FileDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { rtdb } from "@/lib/firebase";
import { ref, update, push } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { arrayMove, CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import * as XLSX from 'xlsx';
import { UserProfile } from '@/types'; // Import UserProfile

const DIALER_ITEMS_PER_PAGE = 20;

interface DialerSetupViewProps {
  contacts: Contact[];
  onSaveImportedContacts: (contacts: Contact[]) => Promise<void>;
  userProfile: UserProfile | null; // <-- ADDED
}

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

export const DialerSetupView: React.FC<DialerSetupViewProps> = ({ contacts, onSaveImportedContacts, userProfile }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [callQueue, setCallQueue] = useState<Contact[]>([]);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleAvailableCount, setVisibleAvailableCount] = useState(DIALER_ITEMS_PER_PAGE);
  
  const isSuperAdmin = userProfile?.role === 'superadmin'; // <-- SUPERADMIN CHECK

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

  const availableContacts = useMemo(() => {
    const queueIds = new Set(callQueue.map(c => c.id));
    const importedIds = new Set(importedContacts.map(c => c.id));
    return contacts.filter(c => 
      !queueIds.has(c.id) && 
      !importedIds.has(c.id) &&
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
    );
  }, [contacts, callQueue, importedContacts, searchTerm]);

  const visibleAvailableContacts = useMemo(() => {
    return availableContacts.slice(0, visibleAvailableCount);
  }, [availableContacts, visibleAvailableCount]);

  useEffect(() => {
    setVisibleAvailableCount(DIALER_ITEMS_PER_PAGE);
  }, [searchTerm]);

  const handleToggleContact = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) newSet.delete(contactId);
      else newSet.add(contactId);
      return newSet;
    });
  };

  const handleAddToQueue = () => {
    const allContacts = [...contacts, ...importedContacts];
    const contactsToAdd = allContacts.filter(c => selectedContactIds.has(c.id));
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
    
    const allContacts = [...availableContacts, ...importedContacts];
    const contactToMove = allContacts.find(c => c.id === activeId);
    if (!contactToMove) return;

    if (over.id === 'call-queue-droppable' || callQueue.some(c => c.id === overId)) {
      if (!callQueue.some(c => c.id === activeId)) {
        setCallQueue(prev => [...prev, contactToMove]);
      }
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      const phonesInThisFile = new Set<string>();
      let duplicateCountInFile = 0;
      const newContactsFromFile: Contact[] = [];

      json.forEach((row: any) => {
        // Check for common column names for phone and name
        const phone = String(row['Phone Number'] || row.Phone || row.phone || '').trim();
        const name = String(row['Company Name'] || row.Name || row.name || 'Unknown').trim();
        
        if (!phone || !name) return;

        if (phonesInThisFile.has(phone)) {
          duplicateCountInFile++;
          return;
        }
        
        phonesInThisFile.add(phone);

        // --- NEW: Parse rich call log data ---
        const feedback = String(row.Feedback || row['Last Status'] || '').trim();
        const message = String(row.Message || row['Last Message'] || '').trim();
        const duration = parseInt(String(row.Duration || row['Last Duration(s)'] || 0), 10);
        const spokenToName = String(row['Spoken To'] || row['Last Spoken To'] || '').trim();
        const timestamp = String(row.Timestamp || row['Last Contacted'] || new Date().toISOString()).trim();
        
        const newLog: CallLog = {
            originalIndex: crypto.randomUUID(), // Temporary client-side ID
            type: 'Follow-up', // Assume imported logs are follow-ups for simplicity
            timestamp: new Date(timestamp).toISOString(),
            duration: isNaN(duration) ? 0 : duration,
            feedback: feedback as CallLog['feedback'],
            message: message,
            spokenToName: spokenToName,
        };
        // --- END NEW PARSING ---

        newContactsFromFile.push({
          id: phone,
          name,
          phone,
          callHistory: [newLog], // Store the new log temporarily
          status: feedback || 'New',
          lastContacted: new Date(timestamp).toISOString(),
          callCount: 1,
        });
      });

      setImportedContacts(newContactsFromFile);
      
      toast({
        title: "Import Complete",
        description: `${newContactsFromFile.length} unique contacts loaded from file. ${duplicateCountInFile > 0 ? `${duplicateCountInFile} duplicates within the file were ignored.` : ''}`,
      });
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (!user) {
      setIsSaving(false);
      return;
    }

    const updates: { [key: string]: any } = {};
    let newContactsCount = 0;
    let updatedLogsCount = 0;

    try {
      importedContacts.forEach(importedContact => {
        const existingContact = contacts.find(c => c.phone === importedContact.phone);
        const phoneKey = importedContact.phone;

        if (existingContact) {
          // 1. Contact exists: Add the new call log(s)
          importedContact.callHistory.forEach(newLog => {
            // Use Firebase push key generation locally for the new log entry
            const callHistoryRef = ref(rtdb, `contacts/${phoneKey}/callHistory`);
            const newLogKey = push(callHistoryRef).key; // <-- CORRECTED SYNTAX
            if (newLogKey) {
              updates[`contacts/${phoneKey}/callHistory/${newLogKey}`] = {
                feedback: newLog.feedback,
                message: newLog.message,
                timestamp: newLog.timestamp,
                duration: newLog.duration,
                spokenToName: newLog.spokenToName,
              };
              updatedLogsCount++;
            }
          });
          
          // Update top-level fields and increment call count
          updates[`contacts/${phoneKey}/name`] = importedContact.name;
          updates[`contacts/${phoneKey}/phoneNumber`] = importedContact.phone;
          // CRITICAL FIX: Calculate the new total call count correctly
          const existingCallCount = existingContact.callHistory.length;
          const newCallCount = existingCallCount + importedContact.callHistory.length;
          updates[`contacts/${phoneKey}/callCount`] = newCallCount;

        } else {
          // 2. Contact is truly new: Create the full contact structure
          const newContactData = {
            name: importedContact.name,
            phoneNumber: importedContact.phone,
            callCount: importedContact.callHistory.length,
            callHistory: importedContact.callHistory.reduce((acc, log) => {
                // Generate a unique key for the new log entry
                const callHistoryRef = ref(rtdb, 'contacts'); // Use a generic ref for key generation
                const newLogKey = push(callHistoryRef).key; // <-- CORRECTED SYNTAX
                if (newLogKey) {
                    acc[newLogKey] = {
                        feedback: log.feedback,
                        message: log.message,
                        timestamp: log.timestamp,
                        duration: log.duration,
                        spokenToName: log.spokenToName,
                    };
                }
                return acc;
            }, {} as Record<string, any>),
          };
          updates[`contacts/${phoneKey}`] = newContactData;
          newContactsCount++;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(ref(rtdb), updates);
        toast({
          title: "Import Successful!",
          description: `Added ${newContactsCount} new contacts and merged ${updatedLogsCount} call logs into existing contacts.`,
        });
        setImportedContacts([]);
      } else {
        toast({ title: "No New Data", description: "No new contacts or call logs found to save." });
      }
    } catch (error) {
      console.error("Error saving imported contacts:", error);
      toast({
        title: "Save Failed",
        description: "Could not save the imported contacts to Firebase.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleSelectAllImported = () => {
    const importedIds = importedContacts.map(c => c.id);
    const allSelected = importedIds.every(id => selectedContactIds.has(id));

    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        importedIds.forEach(id => newSet.delete(id));
      } else {
        importedIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const allImportedSelected = useMemo(() => {
    if (importedContacts.length === 0) return false;
    return importedContacts.every(c => selectedContactIds.has(c.id));
  }, [importedContacts, selectedContactIds]);

  return (
    <DndContext sensors={sensors} onDragStart={() => {}} onDragEnd={handleDragEnd}>
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
        <ResizablePanel defaultSize={30} minSize={20}>
          <Card className="flex flex-col h-full border-0 shadow-none rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Imported Contacts</CardTitle>
              
              {/* --- SUPERADMIN MASTER DATA IMPORT SECTION --- */}
              {isSuperAdmin && (
                <div className="space-y-3 p-3 border rounded-lg bg-background">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-primary" /> Master Data Import
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Upload a CSV/Excel file to update the master contact list.
                  </p>
                  <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".xlsx, .xls, .csv" className="hidden" />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                      <Upload className="h-4 w-4 mr-2" /> Upload File
                    </Button>
                    <a href="/sample_call_import.csv" download>
                      <Button variant="ghost" size="icon" title="Download Sample CSV">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving || importedContacts.length === 0} 
                    className="w-full"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save {importedContacts.length} New/Updated Contacts
                  </Button>
                </div>
              )}
              {/* --- END SUPERADMIN MASTER DATA IMPORT SECTION --- */}

            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {importedContacts.map(contact => (
                    <DraggableContactItem key={contact.id} contact={contact} isSelected={selectedContactIds.has(contact.id)} onToggle={handleToggleContact} onAdd={handleClickToAdd} />
                  ))}
                  {importedContacts.length === 0 && <div className="text-center py-16 text-muted-foreground"><p>Import contacts to get started.</p></div>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={40} minSize={30}>
          <Card className="flex flex-col h-full border-0 shadow-none rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Available Contacts</CardTitle>
              <Input placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {visibleAvailableContacts.map(contact => (
                    <DraggableContactItem key={contact.id} contact={contact} isSelected={selectedContactIds.has(contact.id)} onToggle={handleToggleContact} onAdd={handleClickToAdd} />
                  ))}
                  {visibleAvailableCount < availableContacts.length && (
                    <div className="flex justify-center py-2">
                      <Button
                        variant="outline"
                        onClick={() => setVisibleAvailableCount(prev => prev + DIALER_ITEMS_PER_PAGE)}
                      >
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
        <ResizablePanel defaultSize={30} minSize={20}>
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
                  {callQueue.length === 0 && (<div className="text-center py-16 text-muted-foreground"><p>Drag contacts here to build your queue.</p></div>)}
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