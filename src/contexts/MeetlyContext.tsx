import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
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
  retryProcessing: (recordingId: string) => Promise<void>;
  audioLevel: number;
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
  const streamRef = React.useRef<MediaStream | null>(null);
  
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!user) {
      setRecordings([]);
      return;
    }
    setLoading(true);
    const recordingsQuery = query(collection(db, 'meetingRecordings'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(recordingsQuery, (snapshot) => {
      const recordingsList: MeetingRecording[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingRecording));
      setRecordings(recordingsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching recordings:", error);
      toast({ title: "Connection error", description: "Failed to load recordings.", variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, toast]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

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
      if (!analyserRef.current || !isRecording) {
        setAudioLevel(0);
        return;
      }
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(Math.min(100, (average / 255) * 100));
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  };

  const startRecording = async () => {
    if (!user) throw new Error("Authentication required.");
    if (recordedAudio) setRecordedAudio(null);

    let systemStream: MediaStream | null = null;
    let micStream: MediaStream | null = null;

    try {
      // 1. Get System Audio (from tab)
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Your browser does not support screen recording, which is required for system audio capture.");
      }
      systemStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const systemAudioTracks = systemStream.getAudioTracks();
      if (systemAudioTracks.length === 0 || !systemAudioTracks[0].enabled || systemAudioTracks[0].muted) {
        throw new Error("To record meeting audio, you MUST select a browser TAB and check 'Share tab audio'.");
      }

      // 2. Get Microphone Audio
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });

      // 3. Mix Audio Streams
      const audioContext = new AudioContext();
      const systemSource = audioContext.createMediaStreamSource(systemStream);
      const micSource = audioContext.createMediaStreamSource(micStream);
      const destination = audioContext.createMediaStreamDestination();
      systemSource.connect(destination);
      micSource.connect(destination);
      
      const mixedStream = destination.stream;
      // Add video track to keep screen share active, but it won't be recorded
      mixedStream.addTrack(systemStream.getVideoTracks()[0]);
      streamRef.current = mixedStream;

      // 4. Start Recording the Mixed Stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(mixedStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        setRecordedAudio(audioBlob);
        // Stop all original tracks
        systemStream?.getTracks().forEach(track => track.stop());
        micStream?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingDuration(0);
      setupAudioAnalyser(mixedStream);
      toast({ title: "Recording Started 🎙️", description: "Capturing both system and microphone audio." });

    } catch (error: any) {
      // Cleanup streams if any part fails
      systemStream?.getTracks().forEach(track => track.stop());
      micStream?.getTracks().forEach(track => track.stop());
      console.error("Recording failed:", error);
      throw error; // Re-throw for the UI to catch and display
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
    // The onstop event handler for MediaRecorder will handle stopping the stream tracks.
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setIsRecording(false);
    toast({ title: "Recording stopped ⏹️", description: "Ready to save your recording" });
  };

  const clearRecordedAudio = useCallback(() => setRecordedAudio(null), []);

  const uploadRecording = async (audioBlob: Blob, title: string, duration: number) => {
    if (!user) return;
    const timestamp = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'meetingRecordings'), { title, audioUrl: '', duration, status: 'uploading', createdAt: timestamp, createdBy: user.uid, fileSize: audioBlob.size });
    const firestoreId = docRef.id;
    try {
      const fileName = `meetly-audio/${user.uid}/${timestamp}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
      const audioRef = storageRef(storage, fileName);
      const metadata = { customMetadata: { 'firestoreId': firestoreId } };
      const uploadResult = await uploadBytes(audioRef, audioBlob, metadata);
      const audioUrl = await getDownloadURL(uploadResult.ref);
      await updateDoc(docRef, { audioUrl: audioUrl, filePath: fileName, status: 'processing' });
      clearRecordedAudio();
      toast({ title: "Recording uploaded! 📤", description: "Your recording is being processed." });
    } catch (error) {
      console.error("Error uploading recording:", error);
      await deleteDoc(doc(db, 'meetingRecordings', firestoreId));
      toast({ title: "Upload failed", variant: "destructive" });
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
        if (storageError.code !== 'storage/object-not-found') console.warn("Could not delete audio file:", storageError);
      }
      toast({ title: "Recording deleted", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const retryProcessing = async (recordingId: string) => {
    const loadingToastId = showLoading("Retrying processing...");
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording || !recording.filePath) throw new Error("File path not found.");
      setRecordings(prev => prev.map(r => r.id === recordingId ? { ...r, status: 'processing', error: undefined } : r));
      const docRef = doc(db, 'meetingRecordings', recordingId);
      await updateDoc(docRef, { status: 'processing', error: deleteField() });
      const fileRef = storageRef(storage, recording.filePath);
      const existingMetadata = await getMetadata(fileRef);
      await updateMetadata(fileRef, { customMetadata: { ...existingMetadata.customMetadata, retry_timestamp: new Date().toISOString() } });
      dismissToast(loadingToastId);
      toast({ title: "Reprocessing Started", description: "The AI is analyzing your recording again." });
    } catch (error: any) {
      dismissToast(loadingToastId);
      console.error("Error retrying processing:", error);
      const originalRecording = recordings.find(r => r.id === recordingId);
      setRecordings(prev => prev.map(r => r.id === recordingId ? { ...originalRecording!, status: 'failed', error: error.message } : r));
      toast({ title: "Retry Failed", description: error.message, variant: "destructive" });
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
    audioLevel,
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