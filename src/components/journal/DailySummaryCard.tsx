// src/components/journal/DailySummaryCard.tsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { BrainCircuit, Loader2, Sparkles, Smile, Repeat, Lightbulb } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- NEW: A type for our parsed sections ---
interface SummarySection {
  title: string;
  content: string;
}

// Type for the Firestore document
interface DailySummary {
  summary: string;
  entryCount: number;
}
interface DailySummaryCardProps {
  selectedDate?: Date;
}

// --- NEW: A helper function to parse the summary ---
const parseSummaryToSections = (summaryText: string): SummarySection[] => {
  if (!summaryText) return [];
  // Split the summary by '###' which denotes our headings
  const parts = summaryText.split('### ').filter(part => part.trim() !== '');
  return parts.map(part => {
    const lines = part.split('\n');
    const title = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    return { title, content };
  });
};

// --- NEW: A map to associate titles with icons ---
const sectionIcons: { [key: string]: React.ReactNode } = {
  "Productivity & Focus": <BrainCircuit className="h-4 w-4 text-blue-400" />,
  "Emotional Landscape": <Smile className="h-4 w-4 text-green-400" />,
  "Habit & Routine Patterns": <Repeat className="h-4 w-4 text-purple-400" />,
  "Core Insights": <Sparkles className="h-4 w-4 text-yellow-400" />,
  "Actionable Suggestions": <Lightbulb className="h-4 w-4 text-orange-400" />,
};

export function DailySummaryCard({ selectedDate }: DailySummaryCardProps) {
  const { user } = useAuth();
  const { entries } = useJournal(); 
  
  const [summaryDoc, setSummaryDoc] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const isProcessing = entries.some(e => e.status === 'processing' || e.status === 'uploading');

  // Parse the summary only when the document changes
  const summarySections = useMemo(() => {
    return summaryDoc ? parseSummaryToSections(summaryDoc.summary) : [];
  }, [summaryDoc]);

  useEffect(() => {
    if (!user || !selectedDate) {
      setSummaryDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const docId = `${user.uid}_${formattedDate}`;
    
    const unsubscribe = onSnapshot(doc(db, "dailySummaries", docId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSummaryDoc(docSnapshot.data() as DailySummary);
      } else {
        setSummaryDoc(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, selectedDate]);

  const renderContent = () => {
    if (loading) { /* ... same loading state ... */ }
    
    // --- UPDATED RENDER LOGIC ---
    if (summarySections.length > 0) {
      return (
        <div className="space-y-4">
          {summarySections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                {sectionIcons[section.title] || <Sparkles className="h-4 w-4" />}
                {section.title}
              </h4>
              <div className="prose prose-sm dark:prose-invert max-w-none prose-ul:list-disc prose-ul:pl-5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // If no summary exists, but a new entry is being processed, show the "Analyzing" spinner
    if (isProcessing) {
      return (
        <div className="text-center text-muted-foreground pt-8 flex flex-col items-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
          <p>AI is analyzing your reflections...</p>
        </div>
      );
    }
    
    // Default state: No summary, nothing loading, and nothing processing.
    return (
      <div className="text-center text-muted-foreground pt-8 flex flex-col items-center">
        <BrainCircuit className="h-10 w-10 mx-auto mb-2 opacity-50"/>
        <p>Record a reflection to get your daily analysis.</p>
        <p className="text-xs mt-1">Insights for the selected day will appear here.</p>
      </div>
    );
  };

  return (
    <Card className="min-h-[300px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Daily AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}