import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ThumbsUp, Loader2, VideoOff, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import MediaPipe dependencies
import {
  GestureRecognizer,
  FilesetResolver,
  GestureRecognizerResult,
} from '@mediapipe/tasks-vision';

// Define the path to the MediaPipe model file
const MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export function HandGestureDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [gestureRecognizer, setGestureRecognizer] = useState<GestureRecognizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);
  const [debugGesture, setDebugGesture] = useState<{ name: string, score: number } | null>(null); // <-- DEBUG STATE
  const COOLDOWN_MS = 5000; // 5 seconds cooldown

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
            delegate: 'GPU', // Use GPU for better performance
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
          setDebugGesture({ name: topGesture.categoryName, score: topGesture.score }); // <-- DEBUG UPDATE
          
          // Check for 'Thumbs Up' gesture
          if (topGesture.categoryName === 'Thumb_Up' && topGesture.score > 0.8) {
            const currentTime = Date.now();
            if (currentTime - lastGestureTime > COOLDOWN_MS) {
              console.log('GESTURE DETECTED: Thumbs Up!');
              setLastGestureTime(currentTime);
              
              // Trigger navigation and notification
              toast({
                title: 'Gesture Recognized! 👍',
                description: 'Navigating to Tasks page...',
                duration: 3000,
              });
              navigate('/tasks');
            }
          }
        } else {
            setDebugGesture(null); // <-- DEBUG UPDATE
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gestureRecognizer, detectionActive, navigate, toast, lastGestureTime]);

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
      
      {/* Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50 p-2 bg-card border rounded-lg shadow-lg flex flex-col gap-1 text-sm">
        {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading AI Model...
            </div>
        )}

        {!loading && (
            <div className="flex items-center gap-2">
                {cameraActive ? (
                    <Camera className="h-4 w-4 text-success" />
                ) : (
                    <VideoOff className="h-4 w-4 text-warning" />
                )}
                <span className={cn(cameraActive ? 'text-success' : 'text-warning')}>
                    Camera Status: {cameraActive ? 'Active' : 'Denied/Off'}
                </span>
            </div>
        )}

        {!loading && cameraActive && (
            <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-primary" />
                <span className="text-primary">Detection: {detectionActive ? 'Running' : 'Paused'}</span>
            </div>
        )}

        {/* DEBUG INFO */}
        {debugGesture && (
            <div className="text-xs text-muted-foreground mt-1 border-t pt-1">
                <p>Gesture: {debugGesture.name}</p>
                <p>Score: {debugGesture.score.toFixed(2)}</p>
            </div>
        )}
      </div>
    </>
  );
}