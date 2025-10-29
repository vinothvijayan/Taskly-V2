"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, Camera, LayoutDashboard, MessageSquare, Hand, PictureInPicture } from "lucide-react";

const AIFeaturesPage = () => {
  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="h-7 w-7 text-primary" />
          AI Gesture Control
        </h1>
        <p className="text-muted-foreground">
          The gesture detector is now active globally. Use the gestures below to navigate the app hands-free.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-elegant border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ThumbsUp className="h-5 w-5 text-primary" />
                Thumbs Up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Action: Navigate to Tasks</p>
              <p className="text-xs text-muted-foreground mt-2">
                Use this gesture to quickly jump to your main task list.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Hand className="h-5 w-5 text-primary" />
                Open Palm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Action: Navigate to Dashboard</p>
              <p className="text-xs text-muted-foreground mt-2">
                Show your open palm to return to the main dashboard view.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageSquare className="h-5 w-5 text-primary" />
                Closed Fist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Action: Navigate to AI Assistant</p>
              <p className="text-xs text-muted-foreground mt-2">
                Make a closed fist to quickly access the AI Wellness Coach chat.
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-elegant border-2 border-primary/20 md:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <PictureInPicture className="h-5 w-5 text-primary" />
                        Pinch / V-Sign
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm font-semibold">Action: Open PiP Timer Widget</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Triggers the floating Picture-in-Picture window for hands-free time tracking. (Requires browser support)
                    </p>
                </CardContent>
            </Card>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
                <Camera className="h-4 w-4" /> Global Status & Debugging
            </h3>
            <p className="text-xs text-muted-foreground">
                The status indicator is now visible in the bottom right corner of every page. Open the Developer Console (F12) to see real-time confidence scores for all gestures.
            </p>
        </div>
      </div>
    </div>
  );
};

export default AIFeaturesPage;