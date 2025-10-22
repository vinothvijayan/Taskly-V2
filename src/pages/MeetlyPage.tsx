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
    <div className="container max-w-7xl mx-auto p-6 space-y-12">
      {/* Header */}
      <motion.div
        className="text-center space-y-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-block p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl">
          <div className="p-4 bg-background rounded-2xl shadow-inner">
            <Mic className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Meetly AI
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-3">
            Record your meetings, get instant transcripts, and AI-powered summaries with actionable insights.
          </p>
        </div>
      </motion.div>

      {/* Main Content - Two Column Layout for Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recorder and other potential widgets */}
        <motion.div
          className="lg:col-span-1 space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <AudioRecorder />
        </motion.div>

        {/* Right Column: Recordings List */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
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