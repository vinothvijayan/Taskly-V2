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
  where,
  deleteField
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  updateMetadata,
  getMetadata
} from "firebase/storage";
import { db, storage, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import { MeetingRecording } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { showLoading, dismissToast } from "@/utils/toast";

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
  retryProcessing: (recordingId: string) => Promise<void>; // New function
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

  // Helper function to contain the MediaRecorder logic
  const startRecorderWithStream = async (stream: MediaStream, isSystemAudio: boolean) => {
    try {
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        setRecordedAudio(audioBlob);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      recorder.start(1000); // This is where the NotSupportedError can happen
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingDuration(0);

      if (isSystemAudio) {
        toast({
          title: "Recording Started 🎙️",
          description: "Recording system audio from the selected tab/screen.",
        });
      }
    } catch (error) {
      console.error("Error starting MediaRecorder:", error);
      if (stream) stream.getTracks().forEach(track => track.stop());
      
      // Re-throw a more specific error to be caught by the main function
      if (error instanceof DOMException && error.name === 'NotSupportedError' && isSystemAudio) {
        throw new Error("Could not record audio from the selected screen/window. Please try sharing a 'Chrome Tab' with audio enabled instead.");
      } else {
        throw error; // re-throw other errors
      }
    }
  };

  const startRecording = async () => {
    if (!user) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }
    if (recordedAudio) setRecordedAudio(null);

    if (Capacitor.isNativePlatform()) {
      // --- NATIVE PLATFORM LOGIC (Microphone only) ---
      try {
        const fileName = `meetly_${Date.now()}.wav`;
        const internalPath = `records/${fileName}`;
        mediaRef.current = new Media(internalPath, 
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
      // --- WEB/DESKTOP PLATFORM LOGIC ---
      const systemAudioToastId = showLoading("A browser prompt will appear. To record system audio, please select 'Share system audio' or 'Share tab audio' in the prompt.");
      let systemStream: MediaStream | null = null;

      try {
        // --- ATTEMPT 1: SYSTEM AUDIO ---
        if (!navigator.mediaDevices.getDisplayMedia || !window.isSecureContext) {
          throw new Error("getDisplayMedia not supported.");
        }

        systemStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        if (systemStream.getAudioTracks().length === 0 || !systemStream.getAudioTracks()[0].enabled || systemStream.getAudioTracks()[0].muted) {
          systemStream.getTracks().forEach(track => track.stop()); // Clean up
          throw new Error("No usable audio track found in screen share.");
        }
        
        dismissToast(systemAudioToastId);
        await startRecorderWithStream(systemStream, true); // Try to record with system audio

      } catch (systemError: any) {
        // This block catches failures from getDisplayMedia OR startRecorderWithStream
        dismissToast(systemAudioToastId);
        console.warn(`System audio attempt failed: ${systemError.message}. Falling back to microphone.`);
        
        if (systemStream) systemStream.getTracks().forEach(track => track.stop());

        // --- ATTEMPT 2: MICROPHONE FALLBACK ---
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
          });
          
          if (systemError.name === 'NotAllowedError') {
            toast({
              title: "Microphone Only 🎤",
              description: "Screen share was cancelled. Recording microphone input instead.",
            });
          } else {
            toast({
              title: "Microphone Only 🎤",
              description: systemError.message,
            });
          }

          await startRecorderWithStream(micStream, false); // Record with microphone

        } catch (micError: any) {
          console.error("Microphone fallback also failed:", micError);
          toast({
              title: "Recording Failed",
              description: "Could not access microphone. Please check permissions.",
              variant: "destructive"
          });
        }
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
            path: `records/${fileName}`, // Read from the 'records' subdirectory
            directory: Directory.Data
          });
          
          const fetchRes = await fetch(`data:audio/wav;base64,${result.data}`);
          const blob = await fetchRes.blob();
          setRecordedAudio(blob);
          
          await Filesystem.deleteFile({ path: `records/${fileName}`, directory: Directory.Data });
          
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
        filePath: fileName, // Save the file path for retries
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

  const retryProcessing = async (recordingId: string) => {
    const loadingToastId = showLoading("Retrying processing...");
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording || !recording.filePath) {
        throw new Error("Recording file path not found. Cannot retry.");
      }

      // 1. Optimistically update the UI
      setRecordings(prev => prev.map(r => r.id === recordingId ? { ...r, status: 'processing', error: undefined } : r));

      // 2. Update the Firestore document to 'processing' and clear the error
      const docRef = doc(db, 'meetingRecordings', recordingId);
      await updateDoc(docRef, {
        status: 'processing',
        error: deleteField()
      });

      // 3. Trigger the storage function by updating metadata
      const fileRef = storageRef(storage, recording.filePath);
      const existingMetadata = await getMetadata(fileRef);

      await updateMetadata(fileRef, {
        customMetadata: {
          ...existingMetadata.customMetadata,
          retry_timestamp: new Date().toISOString()
        }
      });

      dismissToast(loadingToastId);
      toast({
        title: "Reprocessing Started",
        description: "The AI is analyzing your recording again. This may take a few minutes."
      });
    } catch (error: any) {
      dismissToast(loadingToastId);
      console.error("Error retrying processing:", error);
      // Revert optimistic update on failure
      const originalRecording = recordings.find(r => r.id === recordingId);
      setRecordings(prev => prev.map(r => r.id === recordingId ? { ...originalRecording!, status: 'failed', error: error.message } : r));
      toast({
        title: "Retry Failed",
        description: error.message || "Could not start reprocessing.",
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
    retryProcessing,
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