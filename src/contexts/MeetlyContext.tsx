// src/contexts/MeetlyContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  where
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MeetingRecording } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from '@capacitor/filesystem';

// Declare the global Media object from cordova-plugin-media
declare var Media: any;

interface MeetlyContextType {
  recordings: MeetingRecording[];
  loading: boolean;
  isRecording: boolean;
  recordingDuration: number;
  recordedAudio: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  deleteRecording: (recordingId: string) => Promise<void>;
  uploadRecording: (audioBlob: Blob, title: string, duration: number) => Promise<void>;
  clearRecordedAudio: () => void;
}

const MeetlyContext = createContext<MeetlyContextType | undefined>(undefined);

export function MeetlyContextProvider({ children }: { children: ReactNode }) {
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const mediaRef = React.useRef<any>(null);
  const streamRef = React.useRef<MediaStream | null>(null); // To hold the stream for cleanup

  // Set up real-time listener for recordings
  useEffect(() => {
    if (!user) {
      setRecordings([]);
      return;
    }

    setLoading(true);

    const recordingsQuery = query(
      collection(db, 'meetingRecordings'),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      recordingsQuery,
      (snapshot) => {
        const recordingsList: MeetingRecording[] = [];
        snapshot.forEach(doc => {
          recordingsList.push({ id: doc.id, ...doc.data() } as MeetingRecording);
        });

        setRecordings(recordingsList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching recordings:", error);
        toast({
          title: "Connection error",
          description: "Failed to load recordings. Please try again.",
          variant: "destructive"
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, toast]);

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, recordingStartTime]);

  const startRecording = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to start recording.",
        variant: "destructive"
      });
      return;
    }
    
    if (recordedAudio) {
      setRecordedAudio(null);
    }

    if (Capacitor.isNativePlatform()) {
      // --- NATIVE PLATFORM LOGIC (Microphone only) ---
      try {
        const fileName = `meetly_${Date.now()}.wav`;
        const filePath = Filesystem.getUri({ directory: Directory.Data, path: fileName }).uri;
        
        mediaRef.current = new Media(filePath, 
          () => console.log('Native recording success.'), 
          (err: any) => {
            console.error('Native recording error:', err);
            toast({ title: "Recording Error", description: `Code: ${err.code}`, variant: "destructive" });
          }
        );
        mediaRef.current.startRecord();
        setIsRecording(true);
        setRecordingStartTime(Date.now());
        setRecordingDuration(0);
        toast({ 
          title: "Recording started 🎙️",
          description: "Only microphone audio is captured due to platform limitations."
        });
      } catch (error) {
        console.error("Native recording failed to start:", error);
        toast({ title: "Recording Failed", description: "Could not start native recorder.", variant: "destructive" });
      }
    } else {
      // --- WEB/DESKTOP PLATFORM LOGIC (System Audio with Microphone Fallback) ---
      let stream: MediaStream | null = null;
      let isSystemAudio = false;

      try {
        // 1. Attempt to capture system audio via getDisplayMedia
        if (navigator.mediaDevices.getDisplayMedia) {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: true,
          });
          
          if (stream.getAudioTracks().length > 0) {
            isSystemAudio = true;
          }
        }
      } catch (error: any) {
        console.warn("getDisplayMedia failed or denied:", error.name);
        // If NotSupportedError or NotAllowedError, proceed to microphone fallback
      }

      // 2. Fallback to microphone if system audio failed or was not supported
      if (!stream || stream.getAudioTracks().length === 0) {
        if (stream) stream.getTracks().forEach(track => track.stop()); // Clean up failed display stream
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  sampleRate: 44100
              }
          });
          isSystemAudio = false;
        } catch (error: any) {
          console.error("getUserMedia failed:", error);
          toast({
              title: "Recording Failed",
              description: "Microphone access denied. Cannot start recording.",
              variant: "destructive"
          });
          return;
        }
      }

      // 3. Start recording with the acquired stream
      try {
        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(stream, { mimeType });

        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: mimeType });
          setRecordedAudio(audioBlob);
          streamRef.current?.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        };

        recorder.start(1000);
        setMediaRecorder(recorder);
        setIsRecording(true);
        setRecordingStartTime(Date.now());
        setRecordingDuration(0);

        toast({
          title: "Recording started 🎙️",
          description: isSystemAudio 
            ? "Recording system audio from the selected source."
            : "Recording microphone input only."
        });

      } catch (error) {
        console.error("Error starting MediaRecorder:", error);
        if (stream) stream.getTracks().forEach(track => track.stop());
        toast({
            title: "Recording Failed",
            description: "An unexpected error occurred while starting the recorder.",
            variant: "destructive"
        });
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    if (Capacitor.isNativePlatform()) {
      // --- NATIVE PLATFORM LOGIC ---
      if (mediaRef.current) {
        mediaRef.current.stopRecord();
        const filePath = mediaRef.current.src;
        mediaRef.current.release();
        mediaRef.current = null;

        try {
          const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
          
          const result = await Filesystem.readFile({ 
            path: fileName,
            directory: Directory.Data
          });
          
          const fetchRes = await fetch(`data:audio/wav;base64,${result.data}`);
          const blob = await fetchRes.blob();
          setRecordedAudio(blob);
          
          await Filesystem.deleteFile({ path: fileName, directory: Directory.Data });
          
        } catch (e) {
          console.error("Error reading recorded file or cleaning up", e);
          toast({ title: "Error saving recording", variant: "destructive" });
        }
      }
    } else {
      // --- WEB PLATFORM LOGIC ---
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }

    setIsRecording(false);
    toast({
      title: "Recording stopped ⏹️",
      description: "Ready to save your recording"
    });
  };

  const clearRecordedAudio = useCallback(() => {
    setRecordedAudio(null);
  }, []);

  const uploadRecording = async (audioBlob: Blob, title: string, duration: number) => {
    if (!user) return;

    const timestamp = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'meetingRecordings'), {
      title,
      audioUrl: '',
      duration,
      status: 'uploading',
      createdAt: timestamp,
      createdBy: user.uid,
      fileSize: audioBlob.size,
    });
    
    const firestoreId = docRef.id;
    
    try {
      const fileName = `meetly-audio/${user.uid}/${timestamp}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
      const audioRef = storageRef(storage, fileName);

      const metadata = {
        customMetadata: {
          'firestoreId': firestoreId 
        }
      };

      const uploadResult = await uploadBytes(audioRef, audioBlob, metadata);
      const audioUrl = await getDownloadURL(uploadResult.ref);
      
      await updateDoc(docRef, {
        audioUrl: audioUrl,
        status: 'processing'
      });
      
      clearRecordedAudio();

      toast({
        title: "Recording uploaded! 📤",
        description: "Your recording is being processed for transcription."
      });

    } catch (error) {
      console.error("Error uploading recording:", error);
      await deleteDoc(doc(db, 'meetingRecordings', firestoreId));
      toast({
        title: "Upload failed",
        description: "Could not upload recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteRecording = async (recordingId: string) => {
    if (!user) return;
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording) return;
      
      await deleteDoc(doc(db, 'meetingRecordings', recordingId));
      
      try {
        const audioRef = storageRef(storage, recording.audioUrl);
        await deleteObject(audioRef);
      } catch (storageError: any) {
        if (storageError.code !== 'storage/object-not-found') {
          console.warn("Could not delete audio file from storage:", storageError);
        }
      }
      
      toast({
        title: "Recording deleted",
        description: "The recording has been permanently removed.",
        variant: "destructive"
      });
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast({
        title: "Delete failed",
        description: "Could not delete recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const value = {
    recordings,
    loading,
    isRecording,
    recordingDuration,
    recordedAudio,
    startRecording,
    stopRecording,
    deleteRecording,
    uploadRecording,
    clearRecordedAudio,
  };

  return (
    <MeetlyContext.Provider value={value}>
      {children}
    </MeetlyContext.Provider>
  );
}

export function useMeetly() {
  const context = useContext(MeetlyContext);
  if (context === undefined) {
    throw new Error("useMeetly must be used within a MeetlyContextProvider");
  }
  return context;
}