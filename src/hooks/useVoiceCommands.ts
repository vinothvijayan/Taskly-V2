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
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      // Attempt to find a deep/robotic voice (OS dependent)
      const voices = window.speechSynthesis.getVoices();
      const jarvisVoice = voices.find(v => v.name.toLowerCase().includes('google us english') || v.name.toLowerCase().includes('male'));
      
      if (jarvisVoice) {
        utterance.voice = jarvisVoice;
      }
      
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
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

    if (lowerTranscript.includes('open tasks') || lowerTranscript.includes('go to tasks')) {
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
      const taskMatch = lowerTranscript.match(/(create task|add task) (.+)/);
      if (taskMatch && taskMatch[2]) {
        const title = taskMatch[2].trim();
        if (user) {
          addTask({ title, priority: 'medium', status: 'todo', createdBy: user.uid, createdAt: new Date().toISOString() } as Omit<Task, 'id' | 'createdAt'>);
          speak(`Task ${title} successfully logged.`);
        } else {
          speak('Authentication required to log new tasks.');
        }
      } else {
        speak('Please specify the task title.');
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
      const lowerTranscript = transcript.toLowerCase().trim();
      
      // Clear the wake word timeout if we receive any result
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
        wakeWordTimeoutRef.current = null;
      }

      if (isWakeWordDetected) {
        // If wake word was detected, process the command immediately
        setIsWakeWordDetected(false);
        processCommand(lowerTranscript);
      } else if (lowerTranscript.includes(WAKE_WORD)) {
        // Wake word detected, set flag and start timeout for command
        setIsWakeWordDetected(true);
        speak('Yes?');
        
        // Set a timeout to reset the wake word state if no command follows quickly
        wakeWordTimeoutRef.current = setTimeout(() => {
            setIsWakeWordDetected(false);
            speak('Request timed out. Listening for wake word.');
        }, 4000); // 4 seconds to issue a command
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