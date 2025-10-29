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

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
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
      speak('Opening tasks.');
      navigate('/tasks');
    } else if (lowerTranscript.includes('open dashboard') || lowerTranscript.includes('go home')) {
      speak('Opening dashboard.');
      navigate('/');
    } else if (lowerTranscript.includes('open chat') || lowerTranscript.includes('open assistant')) {
      speak('Opening AI assistant.');
      navigate('/chat');
    } else if (lowerTranscript.includes('open timer') || lowerTranscript.includes('start focus')) {
      speak('Opening focus timer.');
      navigate('/timer');
    } else if (lowerTranscript.includes('how many tasks') || lowerTranscript.includes('pending tasks')) {
      const activeCount = getActiveTasksCount();
      speak(`You have ${activeCount} active tasks.`);
    } else if (lowerTranscript.includes('create task') || lowerTranscript.includes('add task')) {
      const taskMatch = lowerTranscript.match(/(create task|add task) (.+)/);
      if (taskMatch && taskMatch[2]) {
        const title = taskMatch[2].trim();
        if (user) {
          addTask({ title, priority: 'medium', status: 'todo', createdBy: user.uid, createdAt: new Date().toISOString() } as Omit<Task, 'id' | 'createdAt'>);
          speak(`Task created: ${title}`);
        } else {
          speak('Please sign in to create tasks.');
        }
      } else {
        speak('What should the task be called?');
      }
    } else if (lowerTranscript.includes('start tracking')) {
      if (isTracking && trackingTask) {
        speak(`Already tracking ${trackingTask.title}. Stopping current task.`);
        stopTracking();
      }
      const firstTodo = tasks.find(t => t.status === 'todo');
      if (firstTodo) {
        startTracking(firstTodo);
        speak(`Starting time tracking for ${firstTodo.title}`);
      } else {
        speak('No active tasks to track.');
      }
    } else if (lowerTranscript.includes('stop tracking')) {
      if (isTracking) {
        stopTracking();
        speak('Time tracking stopped.');
      } else {
        speak('No task is currently being tracked.');
      }
    } else {
      speak('Sorry, I did not understand that command.');
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
      console.log('Raw Transcript:', lowerTranscript);

      if (isWakeWordDetected) {
        setIsWakeWordDetected(false);
        processCommand(lowerTranscript);
      } else if (lowerTranscript.includes(WAKE_WORD)) {
        setIsWakeWordDetected(true);
        speak('Yes?');
        // Restart recognition briefly to listen for the command immediately after the wake word
        recognitionRef.current.stop();
        setTimeout(() => {
            if (recognitionRef.current) recognitionRef.current.start();
        }, 500);
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
    }
  }, []);

  // Auto-start recognition on mount (requires user interaction to enable mic)
  useEffect(() => {
    // We rely on the HandGestureDetector component to handle the initial user activation
    // for the microphone, so we only start listening if the browser supports it.
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        // We won't auto-start here; we'll expose a manual start function.
    }
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