// src/pages/chat.tsx
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { JournalContextProvider } from "@/contexts/JournalContext";
import { JournalRecorder } from "@/components/journal/JournalRecorder";
import { DailyEntriesList } from "@/components/journal/DailyEntriesList";
import { DailySummaryCard } from "@/components/journal/DailySummaryCard";
import { Bot, CalendarDays, FileDown } from "lucide-react";
// --- 1. IMPORT THE NEW COMPONENTS ---
import { Button } from "@/components/ui/button";
import { JournalExportModal } from "@/components/journal/JournalExportModal";

// This component remains the same, as it just displays the main layout.
function WellnessCoachDashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <JournalContextProvider selectedDate={date}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Calendar & Recorder */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Select a Day
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
          <JournalRecorder selectedDate={date} />
        </div>

        {/* Right Column: Daily Entries & AI Summary */}
        <div className="lg:col-span-2 space-y-6">
          <DailySummaryCard selectedDate={date} />
          <DailyEntriesList />
        </div>
      </div>
    </JournalContextProvider>
  );
}

export default function ChatPage() {
  // --- 2. ADD STATE TO MANAGE THE MODAL'S VISIBILITY ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="space-y-6">
        {/* --- 3. UPDATE THE HEADER TO INCLUDE THE EXPORT BUTTON --- */}
        <div className="flex justify-between items-center">
          {/* This empty div acts as a spacer to keep the title centered */}
          <div className="w-24"></div> 
          
          <div className="text-center flex-1">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">AI Wellness Coach</h1>
            <p className="text-muted-foreground">
              Record your thoughts and get AI-powered insights into your well-being.
            </p>
          </div>

          <div className="w-24 flex justify-end">
            <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        {/* --- END OF HEADER UPDATE --- */}

        {/* Main Dashboard Content (No changes needed here) */}
        <WellnessCoachDashboard />
      </div>

      {/* --- 4. RENDER THE MODAL COMPONENT --- */}
      {/* It will only be visible when isExportModalOpen is true */}
      <JournalExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
      />
    </div>
  );
}