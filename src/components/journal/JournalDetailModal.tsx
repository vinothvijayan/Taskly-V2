// src/components/journal/JournalDetailModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JournalEntry } from "@/contexts/JournalContext";
import { FileText, Languages, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface JournalDetailModalProps {
  entry: JournalEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalDetailModal({ entry, open, onOpenChange }: JournalDetailModalProps) {
  if (!entry) return null;

  const formatDuration = (seconds: number): string => new Date(seconds * 1000).toISOString().substr(14, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6" />{entry.title}
          </DialogTitle>
          <DialogDescription>
            Review the details of your reflection, including the transcript and translation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Reflection Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div><p className="font-medium">Duration</p><p>{formatDuration(entry.duration)}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div><p className="font-medium">Recorded On</p><p>{format(new Date(entry.createdAt), 'MMM dd, yyyy h:mm a')}</p></div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="transcript" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transcript"><FileText className="h-4 w-4 mr-2"/>Transcript</TabsTrigger>
              <TabsTrigger value="translation"><Languages className="h-4 w-4 mr-2"/>Translation</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript">
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[300px] pr-4">
                    <p className="text-sm whitespace-pre-wrap">{entry.transcript || "Transcript not available."}</p>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="translation">
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[300px] pr-4">
                    <p className="text-sm whitespace-pre-wrap">{entry.translatedTranscript || "Translation not available."}</p>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}