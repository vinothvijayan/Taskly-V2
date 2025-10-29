import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ThumbsUp, Loader2, VideoOff, Camera, LayoutDashboard, MessageSquare, Hand, PictureInPicture, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipWidgetManager } from '@/hooks/usePipWidgetManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

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
  'Victory': { action: 'pinch-control', icon: PictureInPicture, threshold: 0.7, title: 'Pinch Control' },
};

// New component for the visual pointer
const AirMousePointer = ({ x, y, isPinching, isVisible }: { x: number, y: number, isPinching: boolean, isVisible: boolean }) => {
  if (!isVisible) return null;
  
  return (
    <motion.div
      className={cn(
        "fixed z-[9999] pointer-events-none rounded-full transition-all duration-100 ease-out",
        isPinching ? "bg-red-500/80 h-6 w-6 border-4 border-white shadow-lg" : "bg-primary/80 h-4 w-4 border-2 border-white shadow-md"
      )}
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)', // Center the pointer on the cursor
      }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.1 }}
    >
      {isPinching && <MousePointerClick className="h-4 w-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
    </motion.div>
  );
};


export function HandGestureDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPip, isPipSupported, isPipOpen } = usePipWidgetManager();
  const [gestureRecognizer, setGestureRecognizer] = useState<GestureRecognizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [showPipPrompt, setShowPipPrompt] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  // --- SCROLLING & PINCHING STATE ---
  const [lastHandY, setLastHandY] = useState<number | null>(null);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchStartTime, setPinchStartTime] = useState(0);
  const [pointerX, setPointerX] = useState(0); // Screen pixel X
  const [pointerY, setPointerY] = useState(0); // Screen pixel Y
  const [isPointerVisible, setIsPointerVisible] = useState(false);
  
  const SCROLL_THRESHOLD = 0.005;
  const SCROLL_SENSITIVITY = 1000;
  const CLICK_DURATION_MS = 500; // Max duration for a pinch to be considered a click
  // --- END SCROLLING & PINCHING STATE ---
  
  const COOLDOWN_MS = 3000;

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
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showPipPrompt]);

  // Helper to simulate a click at the pointer's screen coordinates
  const simulateClick = (screenX: number, screenY: number) => {
    // Find the element at the hand position
    const element = document.elementFromPoint(screenX, screenY);

    if (element) {
      console.log(`Simulating click on: ${element.tagName} at (${screenX.toFixed(0)}, ${screenY.toFixed(0)})`);
      
      // Dispatch a click event
      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: screenX,
        clientY: screenY,
      }));
      
      toast({
        title: 'Click Detected! 🖱️',
        description: `Clicked on ${element.tagName}`,
        duration: 1500,
      });
    }
  };

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

        let handDetected = result.landmarks.length > 0;
        let isPinchGesture = false;
        let topGestureName: string | null = null;
        let topGestureScore = 0;
        let wristY = null;
        let wristX = null;
        let indexFingerTipX = null;
        let indexFingerTipY = null;


        if (handDetected) {
            const handLandmarks = result.landmarks[0];
            wristY = handLandmarks[0].y; 
            wristX = handLandmarks[0].x; 
            
            // Get Index Finger Tip (Landmark 8) for pointer position
            indexFingerTipX = handLandmarks[8].x;
            indexFingerTipY = handLandmarks[8].y;

            // Map normalized coordinates to screen pixels
            // FIX: Removed the (1 - x) inversion. The video mirroring should handle the visual flip.
            const screenX = indexFingerTipX * window.innerWidth; 
            const screenY = indexFingerTipY * window.innerHeight;
            
            setPointerX(screenX);
            setPointerY(screenY);
            setIsPointerVisible(true);
            
            if (result.gestures.length > 0) {
                const topGesture = result.gestures[0][0];
                topGestureName = topGesture.categoryName;
                topGestureScore = topGesture.score;
                
                // Use Victory as a proxy for Pinch/Click control
                if (topGestureName === 'Victory' && topGestureScore > GESTURE_MAP.Victory.threshold) {
                    isPinchGesture = true;
                }
            }
        } else {
            setIsPointerVisible(false);
        }
        
        setCurrentGesture(topGestureName);

        // --- PINCHING & SCROLLING LOGIC ---
        if (isPinchGesture) {
            if (!isPinching) {
                // Start of pinch
                setIsPinching(true);
                setPinchStartTime(now);
                setLastHandY(wristY); // Reset Y position at start of pinch
                setScrollVelocity(0);
            } else {
                // Pinch is ongoing - check for scrolling
                if (lastHandY !== null && wristY !== null) {
                    const deltaY = wristY - lastHandY;
                    
                    if (Math.abs(deltaY) > SCROLL_THRESHOLD) {
                        const scrollAmount = deltaY * SCROLL_SENSITIVITY;
                        
                        // Simulate scroll on the main document body
                        window.scrollBy({ top: -scrollAmount, behavior: 'instant' });
                        
                        setScrollVelocity(scrollAmount);
                    } else {
                        setScrollVelocity(0);
                    }
                    setLastHandY(wristY);
                }
            }
        } else {
            // Pinch is released or not detected
            if (isPinching) {
                // End of pinch - check for click action
                const pinchDuration = now - pinchStartTime;
                if (pinchDuration < CLICK_DURATION_MS && indexFingerTipX !== null && indexFingerTipY !== null) {
                    // Simulate click if it was a quick pinch
                    simulateClick(pointerX, pointerY); // Use screen coordinates
                }
                setIsPinching(false);
                setScrollVelocity(0);
            }
            setLastHandY(null);
        }
        // --- END PINCHING & SCROLLING LOGIC ---


        // --- NAVIGATION GESTURE LOGIC (Only trigger if NOT pinching) ---
        if (!isPinching && topGestureName) {
            const gestureConfig = GESTURE_MAP[topGestureName as keyof typeof GESTURE_MAP];

            if (gestureConfig && topGestureScore > gestureConfig.threshold) {
                const currentTime = Date.now();
                if (currentTime - lastGestureTime > COOLDOWN_MS) {
                    setLastGestureTime(currentTime);
                    
                    if (gestureConfig.action === 'open-pip') {
                        if (isPipSupported && !isPipOpen) {
                            console.log('GESTURE DETECTED: Victory! Showing PiP prompt.');
                            setShowPipPrompt(true);
                            toast({ title: 'Gesture Detected! Click to Open PiP 🖼️', duration: 3000 });
                        } else if (isPipOpen) {
                            toast({ title: 'PiP is already open.', description: 'Close the floating window first.' });
                        } else if (!isPipSupported) {
                            toast({ title: 'PiP Not Supported', description: 'Your browser does not support Picture-in-Picture API.', variant: 'destructive' });
                        }
                    } else if (gestureConfig.path) {
                        console.log(`GESTURE TRIGGERED: ${topGestureName}! Navigating to ${gestureConfig.path}`);
                        toast({
                            title: `Gesture Recognized! ${gestureConfig.title}`,
                            description: `Navigating to ${gestureConfig.title} page...`,
                            duration: 3000,
                        });
                        navigate(gestureConfig.path);
                    }
                }
            }
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gestureRecognizer, detectionActive, navigate, toast, lastGestureTime, openPip, isPipSupported, isPipOpen, setShowPipPrompt, isPinching, lastHandY, scrollVelocity, pointerX, pointerY]);

  const handleOpenPipFromPrompt = () => {
    if (isPipSupported && !isPipOpen) {
      openPip();
      setShowPipPrompt(false);
      toast({ title: 'PiP Widget Opened! 🖼️', description: 'Time tracking moved to a floating window.' });
    }
  };

  // 4. Render UI
  return (
    <>
      {/* Air Mouse Pointer */}
      <AirMousePointer x={pointerX} y={pointerY} isPinching={isPinching} isVisible={isPointerVisible && showCamera} />
      
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
                
                {/* NEW: Pinch/Click Status */}
                <div className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-info" />
                    <span className={cn(isPinching ? 'text-info font-semibold' : 'text-muted-foreground')}>
                        Pinch: {isPinching ? 'Active (Scroll/Click)' : 'Idle'}
                    </span>
                </div>
                
                {/* NEW: Scroll Status */}
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