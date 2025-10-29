import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ThumbsUp, Loader2, VideoOff, Camera, LayoutDashboard, MessageSquare, Hand, PictureInPicture } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipWidgetManager } from '@/hooks/usePipWidgetManager'; // <-- NEW IMPORT
import { motion, AnimatePresence } from 'framer-motion'; // <-- ADDED IMPORTS
import { Button } from '@/components/ui/button'; // <-- ADDED IMPORT

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
  'Open_Palm': { path: '/', icon: Hand, threshold: 0.7, title: 'Dashboard' }, // <-- UPDATED TO 0.7
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
  const [showPipPrompt, setShowPipPrompt] = useState(false);
  const [showCamera, setShowCamera] = useState(false); // <-- NEW STATE
  
  // --- NEW SCROLLING STATE ---
  const [lastHandY, setLastHandY] = useState<number | null>(null);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const SCROLL_THRESHOLD = 0.005; // Minimum normalized vertical movement (0 to 1)
  const SCROLL_SENSITIVITY = 1000; // Multiplier for scroll speed
  // --- END SCROLLING STATE ---
  
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
  
  // NEW: Prompt timeout
  useEffect(() => {
    if (showPipPrompt) {
      const timer = setTimeout(() => {
        setShowPipPrompt(false);
      }, 8000); // 8 seconds to click the prompt
      return () => clearTimeout(timer);
    }
  }, [showPipPrompt]);

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

        // --- SCROLLING LOGIC ---
        if (result.landmarks.length > 0) {
          const handLandmarks = result.landmarks[0];
          // Use the wrist landmark (index 0) for tracking vertical position (normalized 0 to 1)
          const wristY = handLandmarks[0].y; 
          
          if (lastHandY !== null) {
            const deltaY = wristY - lastHandY;
            
            if (Math.abs(deltaY) > SCROLL_THRESHOLD) {
              const scrollAmount = deltaY * SCROLL_SENSITIVITY;
              
              // Simulate scroll on the main document body
              window.scrollBy({ top: -scrollAmount, behavior: 'instant' });
              
              setScrollVelocity(scrollAmount);
            } else {
              setScrollVelocity(0);
            }
          }
          setLastHandY(wristY);
        } else {
          setLastHandY(null);
          setScrollVelocity(0);
        }
        // --- END SCROLLING LOGIC ---

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
                    console.log('GESTURE DETECTED: Victory! Showing PiP prompt.');
                    setShowPipPrompt(true); // Show prompt instead of opening directly
                    toast({ title: 'Gesture Detected! Click to Open PiP 🖼️', duration: 3000 });
                } else if (isPipOpen) {
                    toast({ title: 'PiP is already open.', description: 'Close the floating window first.' });
                } else if (!isPipSupported) {
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
  }, [gestureRecognizer, detectionActive, navigate, toast, lastGestureTime, openPip, isPipSupported, isPipOpen, setShowPipPrompt, lastHandY, scrollVelocity]);

  const handleOpenPipFromPrompt = () => {
    if (isPipSupported && !isPipOpen) {
      openPip();
      setShowPipPrompt(false);
      toast({ title: 'PiP Widget Opened! 🖼️', description: 'Time tracking moved to a floating window.' });
    }
  };

  // 4. Render UI (Hidden video feed and status indicator + NEW Prompt)
  return (
    <>
      {/* Hidden Video Element for Processing */}
      <video
        ref={videoRef}
        style={{ 
          display: showCamera ? 'block' : 'none',
          position: 'fixed',
          top: '100px',
          right: '100px',
          zIndex: 100,
          transform: 'scaleX(-1)', // Mirror the video
          border: '2px solid var(--primary)',
          borderRadius: '8px'
        }}
        width="320"
        height="240"
        playsInline
        muted
      />
      
      {/* PiP Prompt (Requires user click for activation) */}
      <AnimatePresence>
        {showPipPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
          >
            <Button
              onClick={handleOpenPipFromPrompt}
              variant="focus"
              className="shadow-lg shadow-primary/30 hover-scale"
            >
              <PictureInPicture className="h-4 w-4 mr-2" />
              Click to Open PiP Widget (Gesture Confirmed)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

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
                
                {/* NEW: Air Mouse/Scroll Status */}
                {cameraActive && (
                    <div className="flex items-center gap-2">
                        <Hand className="h-4 w-4 text-info" />
                        <span className="text-info">
                            Scroll: {scrollVelocity > 5 ? 'DOWN' : scrollVelocity < -5 ? 'UP' : 'Idle'}
                        </span>
                    </div>
                )}
                
                {/* Toggle Button */}
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowCamera(prev => !prev)}
                    className="mt-2"
                >
                    <Camera className="h-4 w-4 mr-2" />
                    {showCamera ? 'Hide Camera' : 'Show Camera'}
                </Button>
            </>
        )}
      </div>
    </>
  );
}