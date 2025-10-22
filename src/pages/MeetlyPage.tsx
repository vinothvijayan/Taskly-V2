import { useState } from "react";
import { AudioRecorder } from "@/components/meetly/AudioRecorder";
import { RecordingsList } from "@/components/meetly/RecordingsList";
import { RecordingDetailModal } from "@/components/meetly/RecordingDetailModal";
import { MeetingRecording } from "@/types";
import { Mic } from "lucide-react";
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
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-block p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl">
          <div className="p-3 bg-background rounded-xl shadow-inner">
            <Mic className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Meetly AI
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-2">
            Record your meetings, get instant transcripts, and AI-powered summaries with actionable insights.
          </p>
        </div>
      </motion.div>

      {/* Main Content - Single Column Layout */}
      <div className="space-y-8">
        {/* Audio Recorder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <AudioRecorder className="max-w-2xl mx-auto" />
        </motion.div>

        {/* Recordings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
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