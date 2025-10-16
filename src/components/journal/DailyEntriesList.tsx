// src/components/journal/DailyEntriesList.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useJournal, JournalEntry } from "@/contexts/JournalContext";
import { JournalDetailModal } from "./JournalDetailModal"; // Import the modal
import { 
  FileAudio, 
  Loader2, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import { format } from "date-fns";

export function DailyEntriesList() {
  const { entries, loading, deleteEntry } = useJournal();
  
  // State to manage which entry is selected for the modal
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to open the modal with the clicked entry's data
  const handleViewEntry = (entry: JournalEntry) => {
    if (entry.status !== 'completed') return; // Only allow viewing completed entries
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  // Helper function to format duration (MM:SS)
  const formatDuration = (seconds: number): string => {
    return new Date(seconds * 1000).toISOString().substr(14, 5);
  };

  // Helper function to display an icon based on the entry's status
  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileAudio className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              Today's Reflections
            </span>
            <Badge variant="outline">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[250px]">
            {loading ? (
              <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground h-full flex items-center justify-center">
                <p>No reflections recorded for this day.</p>
              </div>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <div 
                    key={entry.id} 
                    className={`p-4 flex items-center justify-between group transition-colors ${entry.status === 'completed' ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-70'}`}
                    onClick={() => handleViewEntry(entry)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getStatusIcon(entry.status)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm leading-tight truncate">{entry.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(entry.duration)}</span>
                          <span className="capitalize">&#8226; {entry.status || 'Ready'}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent the modal from opening when deleting
                        deleteEntry(entry.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* The Modal component, controlled by our state variables */}
      <JournalDetailModal 
        entry={selectedEntry}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}