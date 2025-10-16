import { useState } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Phone, Calendar, Clock, UserCheck, Edit, Save, X, Loader2, MessageSquare, TrendingUp, Hash } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from "framer-motion";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onUpdateCallLogMessage: (contactId: string, callLogIndex: string, newMessage: string) => Promise<void>;
}

const getFeedbackBadge = (feedback: CallLog['feedback']) => {
  switch (feedback) {
    case 'Interested': return <Badge className="bg-green-100 text-green-800 border-green-200">Interested</Badge>;
    case 'Follow Up': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Follow-up</Badge>;
    case 'Callback': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Callback</Badge>;
    case 'Send Details': return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Send Details</Badge>;
    case 'Not Interested': return <Badge variant="destructive">Not Interested</Badge>;
    case 'Not Picked': return <Badge variant="outline">Not Picked</Badge>;
    default: return <Badge variant="secondary">{feedback}</Badge>;
  }
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

export const ContactDetailPanel: React.FC<ContactDetailPanelProps> = ({ contact, onUpdateCallLogMessage }) => {
  const [editingLog, setEditingLog] = useState<{ originalIndex: string; content: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!contact) return null;

  const sortedHistory = contact.callHistory 
    ? Object.values(contact.callHistory).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];
    
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleSave = async () => {
    if (!editingLog || !contact) return;
    setIsSaving(true);
    await onUpdateCallLogMessage(contact.id, editingLog.originalIndex, editingLog.content);
    setIsSaving(false);
    setEditingLog(null);
  };

  return (
    <div className="p-4 md:p-6 flex-1 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-shrink-0">
        <Avatar className="h-16 w-16 border">
          <AvatarFallback className="text-2xl bg-muted">{getInitials(contact.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">{contact.name}</h2>
          <p className="text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />{contact.phone}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left Column: Key Info */}
        <div className="md:w-1/3 space-y-4 flex-shrink-0">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Key Info</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Status</span>
                {getFeedbackBadge(contact.status as CallLog['feedback'])}
              </div>
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><Hash className="h-4 w-4" />Total Calls</span>
                <span className="font-medium">{contact.callCount}</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Last Contact</span>
                <span className="font-medium text-right">{format(new Date(contact.lastContacted), 'PP')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Call History Timeline */}
        <div className="md:w-2/3 flex flex-col overflow-hidden min-h-0">
          <h3 className="text-lg font-semibold mb-4 flex-shrink-0">Call History</h3>
          <ScrollArea className="flex-1 -mr-6 pr-6">
            <div className="relative pl-8 border-l-2 border-dashed border-border">
              <AnimatePresence>
                {sortedHistory.map((log, index) => (
                  <motion.div
                    key={log.originalIndex}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="relative mb-8"
                  >
                    <div className="absolute -left-[calc(0.5rem+1px)] top-1 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
                    <div className="pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            {getFeedbackBadge(log.feedback)}
                            {log.type === 'New Call' && <Badge variant="outline" className="border-green-500 text-green-600">New Call</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(log.timestamp), 'PP, p')}</p>
                        </div>
                        {editingLog?.originalIndex !== log.originalIndex && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingLog({ originalIndex: log.originalIndex, content: log.message })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 space-y-3">
                        {editingLog?.originalIndex === log.originalIndex ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingLog.content}
                              onChange={(e) => setEditingLog({ ...editingLog, content: e.target.value })}
                              className="text-sm"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setEditingLog(null)} disabled={isSaving}>
                                <X className="h-4 w-4 mr-1" /> Cancel
                              </Button>
                              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          log.message && (
                            <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md border">"{log.message}"</p>
                          )
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {log.spokenTo && <div className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> Spoke to: <span className="font-medium text-foreground">{log.spokenTo}</span></div>}
                          <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Duration: <span className="font-medium text-foreground">{formatDuration(log.duration)}</span></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {sortedHistory.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No call history recorded for this contact.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};