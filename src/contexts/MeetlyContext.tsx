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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

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
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingDuration(0);

      toast({
        title: "Recording started 🎙️",
        description: "Your meeting is being recorded."
      });

    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorder || !isRecording) return;
    mediaRecorder.stop();
    setIsRecording(false);
    setMediaRecorder(null);
    toast({
      title: "Recording stopped ⏹️",
      description: "Ready to save your recording"
    });
  };

  const clearRecordedAudio = useCallback(() => {
    setRecordedAudio(null);
  }, []);

  // --- THIS IS THE CORRECTED UPLOAD FUNCTION ---
  const uploadRecording = async (audioBlob: Blob, title: string, duration: number) => {
    if (!user) return;

    // 1. Create the Firestore document first to get a unique ID.
    // We start with an empty audioUrl and a status of 'uploading' to show in the UI.
    const timestamp = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'meetingRecordings'), {
      title,
      audioUrl: '', // Will be updated after upload
      duration,
      status: 'uploading', // Initial status
      createdAt: timestamp,
      createdBy: user.uid,
      fileSize: audioBlob.size,
    });
    
    // This is the unique ID for our new document.
    const firestoreId = docRef.id;
    
    try {
      // 2. Prepare the storage location and metadata.
      const fileName = `meetly-audio/${user.uid}/${timestamp}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
      const audioRef = storageRef(storage, fileName);

      // This is the crucial part: we embed the Firestore ID in the file's metadata.
      const metadata = {
        customMetadata: {
          'firestoreId': firestoreId 
        }
      };

      // 3. Upload the file with the new metadata.
      const uploadResult = await uploadBytes(audioRef, audioBlob, metadata);

      // 4. Get the download URL and update the original Firestore document.
      const audioUrl = await getDownloadURL(uploadResult.ref);
      
      // Now we update the document with the final URL and set status to 'processing'
      // so the backend function can take over.
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
      
      // If the upload fails, delete the Firestore document we created.
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
      
      // Delete the Firestore document first
      await deleteDoc(doc(db, 'meetingRecordings', recordingId));
      
      // Then, attempt to delete the file from storage
      try {
        // We need to get a reference from the download URL, which is not direct.
        // It's better to store the file path for easier deletion, but for now, this works if the URL is predictable.
        const audioRef = storageRef(storage, recording.audioUrl);
        await deleteObject(audioRef);
      } catch (storageError: any) {
        // If the file is already gone or the URL is invalid, we don't want the whole operation to fail.
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