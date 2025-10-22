// src/components/journal/JournalRecorder.tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useJournal } from "@/contexts/JournalContext";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Clock,
  Volume2,
  VolumeX,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Capacitor } from "@capacitor/core";

export function JournalRecorder({ selectedDate }: { selectedDate?: Date }) {
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    uploadEntry,
    recordedAudio,
    clearRecordedAudio,
  } = useJournal();
  const { toast } = useToast();

  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [entryTitle, setEntryTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);
  
  useEffect(() => {
    if (recordedAudio && !showUploadDialog) {
        const now = new Date();
        const defaultTitle = `Reflection on ${format(now, 'MMM dd')} at ${format(now, 'h:mm a')}`;
        setEntryTitle(defaultTitle);
        setShowUploadDialog(true);
    }
  }, [recordedAudio, showUploadDialog]);

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      monitorAudioLevel();
    } catch (error) {
      console.warn("Could not set up audio analyser:", error);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(Math.min(100, (average / 255) * 100));
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
      if (!Capacitor.isNativePlatform()) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setupAudioAnalyser(stream);
      }
    } catch (error) {
      toast({ title: "Recording failed", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const handleStopRecording = async () => {
    await stopRecording();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };
  
  const handleUpload = async () => {
    if (!recordedAudio || !entryTitle.trim() || !selectedDate) {
      toast({ title: "Missing information", description: "Please provide a title and ensure a date is selected.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await uploadEntry(recordedAudio, entryTitle.trim(), recordingDuration, selectedDate);
      handleDialogClose(false);
    } finally {
      setUploading(false);
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      clearRecordedAudio();
      setEntryTitle("");
    }
  };

  const formatDuration = (seconds: number): string => new Date(seconds * 1000).toISOString().substr(14, 5);
  
  const playRecording = () => {
    if (!recordedAudio) return;
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else {
      const audio = new Audio(URL.createObjectURL(recordedAudio));
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Record a Reflection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            {isRecording && (
                <>
                <Badge variant="destructive" className="animate-pulse">Recording</Badge>
                <div className="text-3xl font-mono">{formatDuration(recordingDuration)}</div>
                <Progress value={audioLevel} className="h-2 w-32 mx-auto" />
                </>
            )}

            <div className="flex justify-center">
              {!isRecording ? (
                <Button onClick={handleStartRecording} size="lg" className="rounded-full h-16 w-16 bg-red-500 hover:bg-red-600">
                  <Mic className="h-6 w-6" />
                </Button>
              ) : (
                <Button onClick={handleStopRecording} size="lg" variant="outline" className="rounded-full h-16 w-16 border-red-500 text-red-500">
                  <Square className="h-6 w-6" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {!isRecording ? "Press the microphone to start" : "Recording in progress..."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Save Reflection
            </DialogTitle>
            <DialogDescription>
              Provide a title for your reflection before saving and analyzing it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="entryTitle">Title *</Label>
            <Input id="entryTitle" value={entryTitle} onChange={(e) => setEntryTitle(e.target.value)} autoFocus />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Duration: {formatDuration(recordingDuration)}</span>
              <span>Size: {recordedAudio ? `${Math.round(recordedAudio.size / 1024)} KB` : '0 KB'}</span>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => handleDialogClose(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleUpload} disabled={!entryTitle.trim() || uploading} className="flex-1">
                {uploading ? "Uploading..." : "Save & Analyze"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}