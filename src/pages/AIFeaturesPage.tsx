"use client";

import MainLayout from "@/components/layout/MainLayout";
import { HandGestureDetector } from "@/components/ai/HandGestureDetector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, Camera, Loader2 } from "lucide-react";

const AIFeaturesPage = () => {
  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="h-7 w-7 text-primary" />
          AI Gesture Control
        </h1>
        <p className="text-muted-foreground">
          Use hand gestures to quickly navigate the app. This feature requires camera access.
        </p>

        <Card className="shadow-elegant border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ThumbsUp className="h-5 w-5 text-primary" />
              Test Gesture: Thumbs Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Make a clear **Thumbs Up** gesture in front of your camera to automatically navigate to the **Tasks** page.
            </p>
            <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-2">
                <h3 className="font-semibold text-sm">Testing Instructions:</h3>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    <li>Ensure your browser has granted camera permission.</li>
                    <li>Open the Developer Console (F12) to see the `[GESTURE DEBUG]` logs.</li>
                    <li>Make a clear Thumbs Up gesture (thumb up, other fingers curled).</li>
                    <li>The confidence score for `Thumb_Up` must exceed 0.80 to trigger navigation.</li>
                </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* The detector component is mounted here */}
        <HandGestureDetector />
      </div>
    </div>
  );
};

export default AIFeaturesPage;