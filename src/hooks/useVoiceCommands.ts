import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/contexts/TasksContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTimer } from '@/contexts/TimerContext';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { Task } from '@/types';

// Extend Window interface for Webkit compatibility
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const WAKE_WORD = 'taskly';
const COMMAND_COOLDOWN_MS = 2000;

export function useVoiceCommands() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tasks, addTask, getActiveTasksCount } = useTasks();
  const { startTaskTimer, stopTimer } = useTimer();
  const { startTracking, stopTracking, trackingTask, isTracking } = useTaskTimeTracker();

  const [isListening, setIsListening] = useState(false);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastCommandTimeRef = useRef(0);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    // 1. Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 2. Wait for voices to load (necessary for some browsers)
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Prioritize a male, English, or Google voice
      const preferredVoice = voices.find(v => 
        (v.name.toLowerCase().includes('male') && v.lang.startsWith('en')) || 
        v.name.toLowerCase().includes('google us english')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      } else if (voices.length > 0) {
        // Fallback to the first available voice (which might be female, but we can't control that)
        // The key is that we only set ONE voice.
        utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
      
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    };

    // If voices are already loaded, set immediately. Otherwise, wait for the event.
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }
  }, []);

  const processCommand = useCallback((transcript: string) => {
    const now = Date.now();
    if (now - lastCommandTimeRef.current < COMMAND_COOLDOWN_MS) {
      console.log('Command ignored due to cooldown.');
      return;
    }
    lastCommandTimeRef.current = now;

    const lowerTranscript = transcript.toLowerCase().trim();
    console.log('Processing command:', lowerTranscript);

    if (lowerTranscript.includes('open tasks') || lowerTranscript.includes('go to tasks') || lowerTranscript.includes('show my tasks')) {
      speak('Affirmative. Navigating to Task Manager.');
      navigate('/tasks');
    } else if (lowerTranscript.includes('open dashboard') || lowerTranscript.includes('go home')) {
      speak('Acknowledged. Displaying primary dashboard.');
      navigate('/');
    } else if (lowerTranscript.includes('open chat') || lowerTranscript.includes('open assistant')) {
      speak('Accessing AI Wellness Coach.');
      navigate('/chat');
    } else if (lowerTranscript.includes('open timer') || lowerTranscript.includes('start focus')) {
      speak('Initiating focus timer interface.');
      navigate('/timer');
    } else if (lowerTranscript.includes('how many tasks') || lowerTranscript.includes('pending tasks')) {
      const activeCount = getActiveTasksCount();
      speak(`Current active task count is ${activeCount}.`);
    } else if (lowerTranscript.includes('create task') || lowerTranscript.includes('add task')) {
      // Extract command after 'create task' or 'add task'
      const commandRegex = /(create task|add task)\s+(.+)/;
      const taskMatch = lowerTranscript.match(commandRegex);
      
      if (taskMatch && taskMatch[2]) {
        const title = taskMatch[2].trim();
        if (user) {
          addTask({ title, priority: 'medium', status: 'todo', createdBy: user.uid, createdAt: new Date().toISOString() } as Omit<Task, 'id' | 'createdAt'>);
          speak(`Task created: ${title}`);
        } else {
          speak('Authentication required to log new tasks.');
        }
      } else {
        speak('What should the task be called?');
      }
    } else if (lowerTranscript.includes('start tracking')) {
      if (isTracking && trackingTask) {
        speak(`Tracking already active for ${trackingTask.title}. Terminating current session.`);
        stopTracking();
      }
      const firstTodo = tasks.find(t => t.status === 'todo');
      if (firstTodo) {
        startTracking(firstTodo);
        speak(`Commencing time tracking for ${firstTodo.title}.`);
      } else {
        speak('No pending tasks available for tracking.');
      }
    } else if (lowerTranscript.includes('stop tracking')) {
      if (isTracking) {
        stopTracking();
        speak('Time tracking session terminated.');
      } else {
        speak('No active tracking session detected.');
      }
    } else {
      speak('Command not recognized. Please try again.');
    }
  }, [navigate, speak, getActiveTasksCount, addTask, user, tasks, isTracking, trackingTask, startTracking, stopTracking]);

  const startRecognition = useCallback(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      console.error('Speech Recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      console.log('Voice recognition started.');
    };

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      let lowerTranscript = transcript.toLowerCase().trim();
      console.log('Raw Transcript:', lowerTranscript);

      // Clear the wake word timeout if we receive any result
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
        wakeWordTimeoutRef.current = null;
      }

      // 1. Check if the wake word is present in the transcript
      if (lowerTranscript.includes(WAKE_WORD)) {
        // Remove the wake word and any leading/trailing spaces/punctuation for processing
        const command = lowerTranscript.replace(WAKE_WORD, '').trim();
        
        // If a command exists immediately after the wake word, process it now
        if (command.length > 0) {
            setIsWakeWordDetected(false);
            processCommand(command);
            return; // Command processed, exit handler
        }
        
        // 2. If only the wake word was detected, enter AWAITING COMMAND state
        if (!isWakeWordDetected) {
            setIsWakeWordDetected(true);
            speak('Yes?');
            
            // Set a timeout to reset the state if no command follows quickly
            wakeWordTimeoutRef.current = setTimeout(() => {
                setIsWakeWordDetected(false);
                speak('Request timed out. Listening for wake word.');
            }, 4000); // 4 seconds to issue a command
        }
      } else if (isWakeWordDetected) {
        // 3. If we are already in AWAITING COMMAND state, process the transcript as the command
        setIsWakeWordDetected(false);
        processCommand(lowerTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      // Auto-restart if not explicitly stopped
      if (recognitionRef.current) {
        try {
            recognitionRef.current.start();
        } catch (e) {
            console.warn('Recognition failed to auto-restart.');
        }
      }
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('Recognition start failed. Requires user activation.');
    }
  }, [processCommand, speak, addTask, user, tasks, isTracking, trackingTask, startTracking, stopTracking]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      setIsWakeWordDetected(false);
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
        wakeWordTimeoutRef.current = null;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return stopRecognition;
  }, [stopRecognition]);

  return {
    isListening,
    isWakeWordDetected,
    startRecognition,
    stopRecognition,
    speak,
  };
}