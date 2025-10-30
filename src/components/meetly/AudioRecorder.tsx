import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMeetly } from "@/contexts/MeetlyContext";
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
import { Capacitor } from "@capacitor/core";

interface AudioRecorderProps {
  className?: string;
}

export function AudioRecorder({ className }: AudioRecorderProps) {
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    uploadRecording,
    recordedAudio,
    clearRecordedAudio,
    audioLevel,
  } = useMeetly();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);
  
  useEffect(() => {
    if (recordedAudio) {
      setShowUploadDialog(true);
    }
  }, [recordedAudio]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error: any) {
      console.error("Failed to start recording:", error);
      setErrorMessage(error.message || "An unknown recording error occurred.");
      setShowErrorDialog(true);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleUpload = async () => {
    if (!recordedAudio || !meetingTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a meeting title.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      await uploadRecording(recordedAudio, meetingTitle.trim(), recordingDuration);
      setShowUploadDialog(false);
      setMeetingTitle("");
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      clearRecordedAudio();
      setMeetingTitle("");
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const playRecording = () => {
    if (!recordedAudio) return;
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
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
      <Card className={cn("shadow-elegant", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Audio Recorder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            {isRecording && (
              <div className="space-y-3">
                <Badge variant="destructive" className="animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                  Recording
                </Badge>
                <div className="text-3xl font-mono font-bold text-primary">{formatDuration(recordingDuration)}</div>
                {!Capacitor.isNativePlatform() && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {audioLevel > 10 ? <Volume2 className="h-4 w-4 text-success" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground">Audio Level</span>
                    </div>
                    <Progress value={audioLevel} className="h-2 w-32 mx-auto" />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center">
              {!isRecording ? (
                <Button 
                  onClick={handleStartRecording} 
                  size="lg" 
                  className="rounded-full h-16 w-16 bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Mic className="h-6 w-6" />
                </Button>
              ) : (
                <Button 
                  onClick={handleStopRecording} 
                  size="lg" 
                  variant="outline" 
                  className="rounded-full h-16 w-16 border-red-500 text-red-500 hover:bg-red-50 shadow-lg hover:shadow-xl transition-all"
                >
                  <Square className="h-6 w-6" />
                </Button>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {!isRecording ? (
                <p>Click the microphone to start recording your meeting</p>
              ) : (
                <p>Click the stop button when your meeting is finished</p>
              )}
            </div>
          </div>

          {recordedAudio && !isRecording && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Recording Preview</span>
                <Badge variant="secondary">{formatDuration(recordingDuration)}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={playRecording} size="sm" variant="outline" className="rounded-full">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button onClick={() => setShowUploadDialog(true)} size="sm" variant="default" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Save Recording
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Save Meeting Recording
            </DialogTitle>
            <DialogDescription>
              Provide a title for your meeting recording before saving and processing it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meetingTitle">Meeting Title *</Label>
              <Input 
                id="meetingTitle" 
                value={meetingTitle} 
                onChange={(e) => setMeetingTitle(e.target.value)} 
                placeholder="e.g., Weekly Team Standup" 
                autoFocus 
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Duration: {formatDuration(recordingDuration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Volume2 className="h-4 w-4" />
                <span>Audio: {recordedAudio ? Math.round(recordedAudio.size / 1024) : 0} KB</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => handleDialogClose(false)} 
                className="flex-1" 
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={!meetingTitle.trim() || uploading} 
                className="flex-1"
              >
                {uploading ? "Uploading..." : "Save & Process"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Recording Error
            </DialogTitle>
            <DialogDescription className="pt-4 text-base text-foreground">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowErrorDialog(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}