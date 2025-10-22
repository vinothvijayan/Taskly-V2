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
import { VoiceRecorder } from '@capacitor-community/voice-recorder';

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
  } = useMeetly();
  const { toast } = useToast();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

  const checkMicrophonePermission = async () => {
    if (Capacitor.isNativePlatform()) {
      const { value: permission } = await VoiceRecorder.getAudioRecordingPermission();
      setHasPermission(permission === 'granted');
    } else {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setHasPermission(result.state === 'granted');
        result.onchange = () => {
          setHasPermission(result.state === 'granted');
        };
      } catch (error) {
        console.warn("Permission API not supported or error querying permission:", error);
        setHasPermission(null);
      }
    }
  };

  const requestMicrophonePermission = async () => {
    if (Capacitor.isNativePlatform()) {
      const { value: permission } = await VoiceRecorder.requestAudioRecordingPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      if (granted) {
        toast({ title: "Microphone access granted! 🎙️" });
      } else {
        toast({ title: "Microphone access denied", variant: "destructive" });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        toast({
          title: "Microphone access granted! 🎙️",
          description: "You can now start recording meetings."
        });
      } catch (error) {
        setHasPermission(false);
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access to record meetings.",
          variant: "destructive"
        });
      }
    }
  };

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    if (hasPermission === false) {
      await requestMicrophonePermission();
      // Re-check after request
      const { value: permission } = Capacitor.isNativePlatform() 
        ? await VoiceRecorder.getAudioRecordingPermission()
        : await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permission !== 'granted') return;
    }
    try {
      await startRecording();
      if (!Capacitor.isNativePlatform()) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setupAudioAnalyser(stream);
      }
    } catch (error) {
      console.error("Failed to start recording after permission check:", error);
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioLevel(0);
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
          {hasPermission === false && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Microphone Access Required</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">Please allow microphone access to record meetings.</p>
              <Button onClick={requestMicrophonePermission} size="sm" variant="outline">Grant Permission</Button>
            </div>
          )}

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
                  disabled={hasPermission === false} 
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
    </>
  );
}