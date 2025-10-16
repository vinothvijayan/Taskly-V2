import { useState } from "react";
import { AudioRecorder } from "@/components/meetly/AudioRecorder";
import { AudioUploader } from "@/components/meetly/AudioUploader";
import { RecordingsList } from "@/components/meetly/RecordingsList";
import { RecordingDetailModal } from "@/components/meetly/RecordingDetailModal";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingRecording } from "@/types";
import {
  Mic,
  Brain,
  Globe,
  Zap,
  Shield,
  Cloud,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMeetly } from "@/contexts/MeetlyContext";
import { MeetlyPageSkeleton } from "@/components/skeletons";

export default function MeetlyPage() {
  const [selectedRecording, setSelectedRecording] =
    useState<MeetingRecording | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { loading } = useMeetly();

  const handleViewRecording = (recording: MeetingRecording) => {
    setSelectedRecording(recording);
    setShowDetailModal(true);
  };

  if (loading) {
    return <MeetlyPageSkeleton />;
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-12">
      {/* Header */}
      <motion.div
        className="text-center space-y-6"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-lg rounded-3xl flex items-center justify-center shadow-xl">
            <Mic className="h-10 w-10 text-purple-600" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Meetly
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-Powered Meeting Recordings, Transcriptions, and Smart Summaries — 
            all in one place.
          </p>
        </div>
      </motion.div>

      {/* Features Overview */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.15 },
          },
        }}
      >
        {[
          {
            icon: Brain,
            title: "AI Transcription",
            desc: "Powered by Google Gemini",
            gradient: "from-purple-500/20 to-purple-200/30",
            textColor: "text-purple-700 dark:text-purple-200",
          },
          {
            icon: Globe,
            title: "Auto Translation",
            desc: "Translate to English instantly",
            gradient: "from-blue-500/20 to-blue-200/30",
            textColor: "text-blue-700 dark:text-blue-200",
          },
          {
            icon: Zap,
            title: "Smart Summary",
            desc: "Key points & action items",
            gradient: "from-green-500/20 to-green-200/30",
            textColor: "text-green-700 dark:text-green-200",
          },
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.2 }}
          >
            <Card className={`bg-gradient-to-br ${feature.gradient} backdrop-blur-md shadow-lg hover:shadow-xl transition rounded-2xl`}>
              <CardContent className="p-6 text-center space-y-3">
                <feature.icon className="h-10 w-10 mx-auto mb-2 text-purple-600" />
                <h3 className={`font-semibold text-lg ${feature.textColor}`}>
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Audio Recorder & Uploader */}
        <motion.div
          className="lg:col-span-1 space-y-6"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <AudioRecorder />
          <AudioUploader />

          {/* Privacy & Security Info */}
          <Card className="border-muted backdrop-blur-md shadow-lg rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Privacy & Security
              </h3>

              <div className="flex items-start gap-3 text-sm">
                <Cloud className="h-4 w-4 mt-1 text-blue-500" />
                <div>
                  <p className="font-medium">Secure Storage</p>
                  <p className="text-muted-foreground">
                    Recordings safely stored in Firebase
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <Brain className="h-4 w-4 mt-1 text-purple-500" />
                <div>
                  <p className="font-medium">AI Processing</p>
                  <p className="text-muted-foreground">
                    Processed via Google Gemini API
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <Shield className="h-4 w-4 mt-1 text-green-500" />
                <div>
                  <p className="font-medium">Private Access</p>
                  <p className="text-muted-foreground">
                    Only you can access your recordings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recordings List */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RecordingsList onViewRecording={handleViewRecording} />
        </motion.div>
      </div>

      {/* Recording Detail Modal */}
      <RecordingDetailModal
        recording={selectedRecording}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
      />
    </div>
  );
}