import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMeetly } from "@/contexts/MeetlyContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileAudio, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AudioUploaderProps {
  className?: string;
}

export function AudioUploader({ className }: AudioUploaderProps) {
  const { uploadRecording } = useMeetly();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Invalid File Type",
          description: "Please select an audio file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      getAudioDuration(file);
      setMeetingTitle(file.name.replace(/\.[^/.]+$/, "")); // Pre-fill title from filename
      setShowUploadDialog(true);
    }
  };

  const getAudioDuration = (file: File) => {
    const audio = new Audio(URL.createObjectURL(file));
    audio.onloadedmetadata = () => {
      setDuration(Math.round(audio.duration));
      URL.revokeObjectURL(audio.src); // Clean up
    };
    audio.onerror = () => {
      toast({
        title: "Error Reading File",
        description: "Could not determine audio duration. Please check the file.",
        variant: "destructive",
      });
      URL.revokeObjectURL(audio.src);
    };
  };

  const handleUpload = async () => {
    if (!selectedFile || !meetingTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a meeting title.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      await uploadRecording(selectedFile, meetingTitle.trim(), duration);
      handleDialogClose(false);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      setSelectedFile(null);
      setMeetingTitle("");
      setDuration(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Card className={cn("shadow-elegant", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full hover-scale"
          >
            <FileAudio className="h-4 w-4 mr-2" />
            Choose Audio File
          </Button>
          <p className="text-xs text-muted-foreground">
            Upload an existing audio file to transcribe and summarize.
          </p>
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
                <span>Duration: {formatDuration(duration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileAudio className="h-4 w-4" />
                <span>Size: {selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : 0} MB</span>
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
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Save & Process"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}