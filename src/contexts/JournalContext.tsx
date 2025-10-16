// src/contexts/JournalContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MeetingRecording as JournalEntry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export type { JournalEntry };

interface JournalContextType {
  entries: JournalEntry[];
  loading: boolean;
  isRecording: boolean;
  recordingDuration: number;
  recordedAudio: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  deleteEntry: (entryId: string) => Promise<void>;
  uploadEntry: (audioBlob: Blob, title: string, duration: number, journalDate: Date) => Promise<void>;
  clearRecordedAudio: () => void;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalContextProvider({ children, selectedDate }: { children: ReactNode; selectedDate?: Date }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetches entries for the selected date from Firestore
  useEffect(() => {
    if (!user || !selectedDate) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const entriesQuery = query(
      collection(db, 'journalEntries'),
      where('createdBy', '==', user.uid),
      where('journalDate', '==', formattedDate),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(entriesQuery, (snapshot) => {
      const entryList: JournalEntry[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      setEntries(entryList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching journal entries:", error);
      toast({ title: "Connection Error", description: "Failed to load entries.", variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, selectedDate, toast]);

  // Manages the recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // Starts the audio recording
  const startRecording = async () => {
    if (isRecording) return;
    if (!user) { toast({ title: "Please sign in to record.", variant: "destructive" }); return; }
    if (recordedAudio) setRecordedAudio(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: recorder.mimeType });
        setRecordedAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingDuration(0);
      toast({ title: "Recording started 🎙️" });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({ title: "Recording Failed", description: "Please check microphone permissions.", variant: "destructive" });
    }
  };

  // Stops the audio recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    mediaRecorderRef.current = null;
    toast({ title: "Recording stopped ⏹️", description: "Your reflection is ready to save." });
  };

  const clearRecordedAudio = useCallback(() => setRecordedAudio(null), []);

  // --- THIS IS THE CORRECTED UPLOAD FUNCTION ---
  const uploadEntry = async (audioBlob: Blob, title: string, duration: number, journalDate: Date) => {
    if (!user) {
      console.error("Upload failed: No user is logged in.");
      toast({ title: "Authentication Error", description: "You must be signed in to save entries.", variant: "destructive" });
      return;
    }

    console.log(`Starting upload for user: ${user.uid}`);
    const formattedDate = format(journalDate, "yyyy-MM-dd");
    const timestamp = new Date();
    
    let docRef;

    try {
      // Step 1: Create the Firestore document first to get its unique ID
      console.log("Step 1: Creating Firestore document...");
      docRef = await addDoc(collection(db, 'journalEntries'), {
        title,
        duration,
        status: 'uploading',
        createdAt: timestamp.toISOString(),
        journalDate: formattedDate,
        createdBy: user.uid,
        fileSize: audioBlob.size,
        filePath: '', // Will be updated after upload
        audioUrl: '',
      });
      const firestoreId = docRef.id; // Get the unique ID from the created document
      console.log(`Firestore document created with ID: ${firestoreId}`);

      // Step 2: Prepare storage location and metadata
      // The filePath MUST match the structure your backend expects
      const filePath = `journal-audio/${user.uid}/${firestoreId}.webm`;
      const audioStorageRef = storageRef(storage, filePath);
      
      // CRITICAL: Create the metadata object to link the file to the Firestore document
      const metadata = {
        customMetadata: {
          'firestoreId': firestoreId
        }
      };

      // Step 3: Upload the file to Storage WITH the metadata
      console.log("Step 2: Uploading file to Storage with metadata...");
      const uploadResult = await uploadBytes(audioStorageRef, audioBlob, metadata);
      const audioUrl = await getDownloadURL(uploadResult.ref);
      console.log("File successfully uploaded to Storage.");

      // Step 4: Update the Firestore document with the final URLs and set status to 'processing'
      console.log("Step 3: Updating Firestore document with URLs and status...");
      await updateDoc(docRef, {
        audioUrl: audioUrl,
        filePath: filePath, // Also save the final file path for easy deletion
        status: 'processing' // This will trigger your backend function
      });
      console.log("Firestore document updated successfully.");
      
      clearRecordedAudio();
      toast({ title: "Reflection uploaded! 📤", description: "AI is now analyzing your entry." });

    } catch (error) {
      console.error("!!! UPLOAD FAILED IN CATCH BLOCK !!!", error);
      if (docRef) {
        await deleteDoc(doc(db, 'journalEntries', docRef.id));
        console.log("Cleaned up failed Firestore document.");
      }
      toast({ title: "Upload Failed", description: "Please check security rules or your network.", variant: "destructive" });
    }
  };

  // --- COMPLETE AND CORRECTED DELETE FUNCTION ---
  const deleteEntry = async (entryId: string) => {
    if (!user) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    try {
      const entryToDelete = entries.find(e => e.id === entryId);
      if (!entryToDelete) {
        console.warn(`Attempted to delete an entry not found in state: ${entryId}`);
        return;
      }
      
      console.log(`Deleting entry: ${entryId}`);
      // Delete the Firestore document first
      await deleteDoc(doc(db, 'journalEntries', entryId));
      
      // If a filePath exists, delete the corresponding file from Storage
      if (entryToDelete.filePath) {
        console.log(`Deleting file from Storage: ${entryToDelete.filePath}`);
        const audioStorageRef = storageRef(storage, entryToDelete.filePath);
        await deleteObject(audioStorageRef);
      }
      
      toast({ title: "Entry deleted", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({ title: "Delete Failed", description: "Could not delete the entry.", variant: "destructive" });
    }
  };

  const value = {
    entries,
    loading,
    isRecording,
    recordingDuration,
    recordedAudio,
    startRecording,
    stopRecording,
    deleteEntry,
    uploadEntry,
    clearRecordedAudio,
  };

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error("useJournal must be used within a JournalContextProvider");
  }
  return context;
}