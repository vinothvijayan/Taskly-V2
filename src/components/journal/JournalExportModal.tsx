// src/components/journal/JournalExportModal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface JournalExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalExportModal({ open, onOpenChange }: JournalExportModalProps) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Please select a date range.", variant: "destructive" });
      return;
    }
    
    setIsExporting(true);
    const exportPdf = httpsCallable(functions, 'exportJournalToPdf');
    
    try {
      // --- THIS IS THE FIX ---
      // We now format the dates into "yyyy-MM-dd" strings before sending.
      const result = await exportPdf({ 
        startDate: format(range.from, "yyyy-MM-dd"), 
        endDate: format(range.to, "yyyy-MM-dd")
      });
      // ---
      
      const { downloadUrl } = result.data as { downloadUrl: string };

      // Programmatically trigger the download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Taskly_Journal_Export_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Successful!", description: "Your PDF is downloading." });
      onOpenChange(false); // Close modal on success

    } catch (error: any) {
      console.error("Error exporting journal:", error);
      toast({ title: "Export Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Journal to PDF</DialogTitle>
          <DialogDescription>Select a date range to include in your export.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting || !range?.from || !range?.to}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isExporting ? "Generating..." : "Export to PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}