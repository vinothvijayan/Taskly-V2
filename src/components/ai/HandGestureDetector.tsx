import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ThumbsUp, Loader2, VideoOff, Camera, LayoutDashboard, MessageSquare, Hand, PictureInPicture } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipWidgetManager } from '@/hooks/usePipWidgetManager'; // <-- NEW IMPORT

// Import MediaPipe dependencies
import {
  GestureRecognizer,
  FilesetResolver,
  GestureRecognizerResult,
} from '@mediapipe/tasks-vision';

// Define the path to the MediaPipe model file
const MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

// Define gesture mappings and thresholds
const GESTURE_MAP = {
  'Thumb_Up': { path: '/tasks', icon: ThumbsUp, threshold: 0.6, title: 'Tasks' },
  'Open_Palm': { path: '/', icon: Hand, threshold: 0.7, title: 'Dashboard' },
  'Closed_Fist': { path: '/chat', icon: MessageSquare, threshold: 0.7, title: 'AI Assistant' },
  'Victory': { action: 'open-pip', icon: PictureInPicture, threshold: 0.7, title: 'Open PiP Widget' }, // <-- NEW GESTURE
};

export function HandGestureDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPip, isPipSupported, isPipOpen } = usePipWidgetManager(); // <-- USE PiP HOOK
  const [gestureRecognizer, setGestureRecognizer] = useState<GestureRecognizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const COOLDOWN_MS = 3000; // 3 seconds cooldown

  // 1. Load Model and Setup Camera
  useEffect(() => {
    const loadModel = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );

        const recognizer = await GestureRecognizer.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });

        setGestureRecognizer(recognizer);
        setLoading(false);
        console.log('MediaPipe GestureRecognizer loaded.');
      } catch (error) {
        console.error('Failed to load MediaPipe GestureRecognizer:', error);
        setLoading(false);
      }
    };

    loadModel();
  }, []);

  // 2. Setup Camera Stream
  useEffect(() => {
    if (loading || !gestureRecognizer) return;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
            setDetectionActive(true);
          };
        }
      } catch (error) {
        console.warn('Camera access denied. Gesture detection disabled.');
        setCameraActive(false);
        setDetectionActive(false);
      }
    };

    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [loading, gestureRecognizer]);

  // 3. Detection Loop
  useEffect(() => {
    if (!gestureRecognizer || !detectionActive || !videoRef.current) return;

    let lastVideoTime = -1;
    let animationFrameId: number;

    const detect = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(detect);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        const now = performance.now();
        const result: GestureRecognizerResult = gestureRecognizer.recognizeForVideo(video, now);
        lastVideoTime = video.currentTime;

        if (result.gestures.length > 0) {
          const topGesture = result.gestures[0][0];
          setCurrentGesture(topGesture.categoryName);
          
          // --- CONSOLE LOGGING FOR DEBUGGING ---
          console.log(
            `[GESTURE DEBUG] Detected: ${topGesture.categoryName} (Score: ${topGesture.score.toFixed(2)})`
          );
          // --- END CONSOLE LOGGING ---
          
          const gestureConfig = GESTURE_MAP[topGesture.categoryName as keyof typeof GESTURE_MAP];

          if (gestureConfig && topGesture.score > gestureConfig.threshold) {
            const currentTime = Date.now();
            if (currentTime - lastGestureTime > COOLDOWN_MS) {
              setLastGestureTime(currentTime);
              
              if (gestureConfig.action === 'open-pip') {
                if (isPipSupported && !isPipOpen) {
                    console.log('GESTURE TRIGGERED: Victory! Opening PiP Widget.');
                    openPip();
                    toast({ title: 'PiP Widget Opened! 🖼️', description: 'Use the floating window for time tracking.' });
                } else if (isPipOpen) {
                    toast({ title: 'PiP is already open.', description: 'Close the floating window first.' });
                } else {
                    toast({ title: 'PiP Not Supported', description: 'Your browser does not support Picture-in-Picture API.', variant: 'destructive' });
                }
              } else if (gestureConfig.path) {
                console.log(`GESTURE TRIGGERED: ${topGesture.categoryName}! Navigating to ${gestureConfig.path}`);
                toast({
                  title: `Gesture Recognized! ${gestureConfig.title}`,
                  description: `Navigating to ${gestureConfig.title} page...`,
                  duration: 3000,
                });
                navigate(gestureConfig.path);
              }
            }
          }
        } else {
          setCurrentGesture(null);
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gestureRecognizer, detectionActive, navigate, toast, lastGestureTime, openPip, isPipSupported, isPipOpen]);

  // 4. Render UI (Hidden video feed and status indicator)
  return (
    <>
      {/* Hidden Video Element for Processing */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        width="320"
        height="240"
        playsInline
        muted
      />
      
      {/* Status Indicator (Moved to fixed position for global visibility) */}
      <div className="fixed bottom-4 right-4 z-50 p-2 bg-card border rounded-lg shadow-lg flex flex-col gap-1 text-sm">
        {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading AI Model...
            </div>
        )}

        {!loading && (
            <>
                <div className="flex items-center gap-2">
                    {cameraActive ? (
                        <Camera className="h-4 w-4 text-success" />
                    ) : (
                        <VideoOff className="h-4 w-4 text-warning" />
                    )}
                    <span className={cn(cameraActive ? 'text-success' : 'text-warning')}>
                        Camera: {cameraActive ? 'Active' : 'Denied/Off'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-primary" />
                    <span className="text-primary">
                        Gesture: {currentGesture || 'None'}
                    </span>
                </div>
            </>
        )}
      </div>
    </>
  );
}