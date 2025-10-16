import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MeetingRecording } from "@/types";
import { useTasks } from "@/contexts/TasksContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Languages, 
  FileDown, 
  Copy, 
  Play, 
  Pause,
  Volume2,
  Clock,
  Calendar,
  Download,
  Sparkles,
  CheckSquare,
  Clipboard,
  Plus,
  // NEW ICONS for MoM
  ListChecks,
  Gavel,
  ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RecordingDetailModalProps {
  recording: MeetingRecording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  checked: boolean;
}

// Interface for the structured MoM
interface ParsedSummary {
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
}

export function RecordingDetailModal({ recording, open, onOpenChange }: RecordingDetailModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary | null>(null);

  const { toast } = useToast();
  const { addTask } = useTasks();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Parser for DISPLAYING summary as MoM
  const parseSummaryToMoM = (summaryText: string): ParsedSummary => {
    const sections: ParsedSummary = { keyPoints: [], decisions: [], actionItems: [] };
    const lines = summaryText.split('\n').filter(line => line.trim() !== '');
    let currentSection: keyof ParsedSummary | null = null;
    const headingMappings: { [key: string]: keyof ParsedSummary } = {
      'key discussion points': 'keyPoints', 'discussion points': 'keyPoints',
      'decisions made': 'decisions', 'key decisions': 'decisions',
      'action items': 'actionItems', 'tasks': 'actionItems', 'next steps': 'actionItems'
    };
    lines.forEach(line => {
      const cleanedLine = line.replace(/^(###|\*\*|\*|-|\d+\.)\s*/, '').replace(/:\**$/, '').trim().toLowerCase();
      let isHeading = false;
      for (const heading in headingMappings) {
        if (cleanedLine === heading) {
          currentSection = headingMappings[heading];
          isHeading = true;
          break;
        }
      }
      if (!isHeading) {
        const content = line.replace(/^(\*|-|\+|•|\d+\.)\s*/, '').trim();
        if (content) {
          if (currentSection) sections[currentSection].push(content);
          else sections.keyPoints.push(content);
        }
      }
    });
    if (sections.keyPoints.length === 0 && sections.decisions.length === 0 && sections.actionItems.length === 0) {
      return { keyPoints: lines, decisions: [], actionItems: [] };
    }
    return sections;
  };

  // RESTORED: Your original, working task extraction logic
  const extractSuggestedTasks = (summary: string) => {
    const suggestions: SuggestedTask[] = [];
    const lines = summary.split('\n');
    let idCounter = 1;
    const actionKeywords = ['action:', 'action item:', 'follow-up:', 'follow up:', 'decision:', 'task:', 'todo:', 'to do:', 'next step:', 'next steps:', 'assign:', 'assigned:', 'deliverable:', 'deliverables:', 'deadline:', 'due:', 'complete:', 'finish:'];
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      let taskTitle = '';
      let isActionItem = false;
      const bulletMatch = trimmedLine.match(/^(\*|-|\+|•|\d+\.)\s*(.+)/);
      if (bulletMatch) {
        taskTitle = bulletMatch[2].trim();
        isActionItem = true;
      } else {
        const lowerLine = trimmedLine.toLowerCase();
        for (const keyword of actionKeywords) {
          if (lowerLine.startsWith(keyword)) {
            taskTitle = trimmedLine.substring(keyword.length).trim();
            isActionItem = true;
            break;
          }
        }
      }
      if (!isActionItem && trimmedLine.length > 10) {
        const taskIndicators = ['need to', 'should', 'must', 'will', 'plan to', 'going to', 'schedule', 'arrange', 'contact', 'send', 'create', 'update', 'review', 'check', 'verify', 'confirm', 'prepare', 'draft'];
        const lowerLine = trimmedLine.toLowerCase();
        if (taskIndicators.some(indicator => lowerLine.includes(indicator))) {
          taskTitle = trimmedLine;
          isActionItem = true;
        }
      }
      if (isActionItem && taskTitle && taskTitle.length > 5) {
        taskTitle = taskTitle.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove markdown bolding
        taskTitle = taskTitle.replace(/[.!?]+$/, '');
        taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);
        suggestions.push({
          id: `suggested-task-${idCounter++}`,
          title: taskTitle,
          description: `From meeting: "${recording!.title}" on ${format(new Date(recording!.createdAt), 'MMM dd, yyyy')}`,
          checked: false,
        });
      }
    });
    setSuggestedTasks(suggestions);
  };
  
  // This effect now correctly uses your original logic while also setting up the MoM display
  useEffect(() => {
    if (recording?.summary) {
      setParsedSummary(parseSummaryToMoM(recording.summary));
      extractSuggestedTasks(recording.summary); // Use original logic on the full summary
    } else {
      setParsedSummary(null);
      setSuggestedTasks([]);
    }
  }, [recording?.summary]);

  if (!recording) return null;

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard! 📋", description: `${type} has been copied.` });
    } catch (error) {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadAsText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title}_${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download started! 📥" });
  };
  
  const playAudio = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
    } else {
      const audio = new Audio(recording.audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => { setIsPlaying(false); toast({ title: "Playback failed", variant: "destructive" }); };
      audio.play();
    }
  };

  const handleCheckboxChange = (id: string) => {
    setSuggestedTasks(prevTasks => prevTasks.map(task => task.id === id ? { ...task, checked: !task.checked } : task));
  };

  const handleCreateSelectedTasks = async () => {
    if (!user) { toast({ title: "Authentication required", variant: "destructive" }); return; }
    const selected = suggestedTasks.filter(task => task.checked);
    if (selected.length === 0) { toast({ title: "No tasks selected" }); return; }
    let createdCount = 0;
    for (const task of selected) {
      try {
        await addTask({ title: task.title, description: task.description, status: 'todo', priority: 'medium', createdBy: user.uid });
        createdCount++;
      } catch (error) { console.error("Failed to create task:", error); }
    }
    if (createdCount > 0) {
      toast({ title: "Tasks created! 🎯", description: `Successfully added ${createdCount} task(s) to your list.` });
      setSuggestedTasks(prevTasks => prevTasks.filter(task => !task.checked));
    } else {
      toast({ title: "Task creation failed", variant: "destructive" });
    }
  };

  const selectedTasksCount = suggestedTasks.filter(task => task.checked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><FileText className="h-6 w-6" />{recording.title}</DialogTitle>
          <DialogDescription>Review the details of your meeting recording, including the AI-generated summary, transcript, and translation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Recording Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">Duration</p><p className="text-muted-foreground">{formatDuration(recording.duration)}</p></div></div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">Date</p><p className="text-muted-foreground">{format(new Date(recording.createdAt), 'MMM dd, yyyy')}</p></div></div>
                <div className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">File Size</p><p className="text-muted-foreground">{formatFileSize(recording.fileSize)}</p></div></div>
                <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">Audio</p><Button onClick={playAudio} size="sm" variant="outline" className="mt-1 h-7">{isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}{isPlaying ? "Pause" : "Play"}</Button></div></div>
              </div>
            </CardContent>
          </Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary" className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Summary</TabsTrigger>
              <TabsTrigger value="transcript" className="flex items-center gap-2"><FileText className="h-4 w-4" />Transcript</TabsTrigger>
              <TabsTrigger value="translation" className="flex items-center gap-2"><Languages className="h-4 w-4" />Translation</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Transcript</CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={() => recording.transcript && copyToClipboard(recording.transcript, "Transcript")} size="sm" variant="outline" disabled={!recording.transcript}>
                        <Clipboard className="h-3 w-3 mr-1" />Copy
                      </Button>
                      <Button onClick={() => recording.transcript && downloadAsText(recording.transcript, "transcript")} size="sm" variant="outline" disabled={!recording.transcript}>
                        <FileDown className="h-3 w-3 mr-1" />Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    {recording.transcript ? (
                      <p className="text-sm whitespace-pre-wrap">{recording.transcript}</p>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Transcript not available yet</p>
                        {recording.status === 'processing' && (<p className="text-xs mt-1">AI is generating transcript...</p>)}
                        {recording.status === 'failed' && (<p className="text-xs mt-1 text-destructive">Processing failed. Please try re-uploading.</p>)}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="translation" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4" />Translation</CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={() => recording.translatedTranscript && copyToClipboard(recording.translatedTranscript, "Translation")} size="sm" variant="outline" disabled={!recording.translatedTranscript}>
                        <Clipboard className="h-3 w-3 mr-1" />Copy
                      </Button>
                      <Button onClick={() => recording.translatedTranscript && downloadAsText(recording.translatedTranscript, "translation")} size="sm" variant="outline" disabled={!recording.translatedTranscript}>
                        <FileDown className="h-3 w-3 mr-1" />Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    {recording.translatedTranscript ? (
                      <p className="text-sm whitespace-pre-wrap">{recording.translatedTranscript}</p>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Languages className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Translation not available yet</p>
                        {recording.status === 'processing' && (<p className="text-xs mt-1">AI is generating translation...</p>)}
                        {recording.status === 'failed' && (<p className="text-xs mt-1 text-destructive">Processing failed. Please try re-uploading.</p>)}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Summary</CardTitle><div className="flex gap-2"><Button onClick={() => recording.summary && copyToClipboard(recording.summary, "Summary")} size="sm" variant="outline" disabled={!recording.summary}><Copy className="h-3 w-3 mr-1" />Copy</Button><Button onClick={() => recording.summary && downloadAsText(recording.summary, "summary")} size="sm" variant="outline" disabled={!recording.summary}><FileDown className="h-3 w-3 mr-1" />Download</Button></div></div></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    {recording.summary ? (
                      <div className="prose prose-sm max-w-none space-y-6">
                        {parsedSummary && (
                          <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold text-base mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Minutes of Meeting</h3>
                            {parsedSummary.keyPoints.length > 0 && (<div><h4 className="font-medium flex items-center gap-2 text-sm"><ListChecks className="h-4 w-4 text-muted-foreground" />Key Discussion Points</h4><ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">{parsedSummary.keyPoints.map((item, i) => <li key={`kp-${i}`}>{item}</li>)}</ul></div>)}
                            {parsedSummary.decisions.length > 0 && (<div className="mt-4"><h4 className="font-medium flex items-center gap-2 text-sm"><Gavel className="h-4 w-4 text-muted-foreground" />Decisions Made</h4><ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">{parsedSummary.decisions.map((item, i) => <li key={`d-${i}`}>{item}</li>)}</ul></div>)}
                            {parsedSummary.actionItems.length > 0 && (<div className="mt-4"><h4 className="font-medium flex items-center gap-2 text-sm"><ClipboardList className="h-4 w-4 text-muted-foreground" />Action Items</h4><ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">{parsedSummary.actionItems.map((item, i) => <li key={`ai-${i}`}>{item}</li>)}</ul></div>)}
                          </div>
                        )}
                        {suggestedTasks.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-dashed border-muted-foreground/30">
                            <div className="flex items-center justify-between mb-4"><h4 className="font-semibold text-base flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" />AI Task Suggestions<Badge variant="secondary" className="ml-2">{suggestedTasks.length} found</Badge></h4>{selectedTasksCount > 0 && (<Button onClick={handleCreateSelectedTasks} variant="focus" size="sm" className="hover-scale"><Plus className="h-4 w-4 mr-2" />Create {selectedTasksCount} Task{selectedTasksCount > 1 ? 's' : ''}</Button>)}</div>
                            <div className="space-y-3">
                              {suggestedTasks.map(task => (<div key={task.id} className={cn("flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50", task.checked ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border")} onClick={() => handleCheckboxChange(task.id)}>
                                <Checkbox checked={task.checked} onCheckedChange={() => handleCheckboxChange(task.id)} className="mt-0.5" /><div className="flex-1 min-w-0"><p className="font-medium text-sm leading-tight">{task.title}</p><p className="text-xs text-muted-foreground mt-1">{task.description}</p></div>
                              </div>))}
                            </div>
                            {selectedTasksCount === 0 && (<div className="text-center py-4"><p className="text-sm text-muted-foreground">Select tasks above to create them in your task list</p></div>)}
                          </div>
                        )}
                        {suggestedTasks.length === 0 && recording.summary && (
                          <div className="mt-6 pt-4 border-t border-dashed border-muted-foreground/30">
                            <div className="text-center py-6 text-muted-foreground">
                              <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No actionable items detected</p><p className="text-xs mt-1">The AI didn't find any clear action points in this summary</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground"><Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Summary not available yet</p>{recording.status === 'processing' && (<p className="text-xs mt-1">AI is generating summary...</p>)}</div>
                    )}
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