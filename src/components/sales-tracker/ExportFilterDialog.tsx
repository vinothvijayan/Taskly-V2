import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExportFilterState {
  dateRange: DateRange | undefined;
  initialCallFeedback: string[];
  followUpCallFeedback: string[];
}

interface ExportFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (filters: ExportFilterState) => void;
}

const feedbackOptions = ['Interested', 'Not Interested', 'Follow Up', 'Callback', 'Not Picked', 'Send Details'];

export const ExportFilterDialog: React.FC<ExportFilterDialogProps> = ({ open, onOpenChange, onExport }) => {
  const [filters, setFilters] = useState<ExportFilterState>({
    dateRange: undefined,
    initialCallFeedback: [],
    followUpCallFeedback: [],
  });

  const handleDateChange = (range: DateRange | undefined) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  };

  const handleCheckboxChange = (
    category: 'initialCallFeedback' | 'followUpCallFeedback',
    value: string,
    checked: boolean
  ) => {
    setFilters(prev => {
      const currentValues = prev[category];
      if (checked) {
        return { ...prev, [category]: [...currentValues, value] };
      } else {
        return { ...prev, [category]: currentValues.filter(item => item !== value) };
      }
    });
  };

  const handleExportClick = () => {
    onExport(filters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setFilters({
      dateRange: undefined,
      initialCallFeedback: [],
      followUpCallFeedback: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Contacts to Excel</DialogTitle>
          <DialogDescription>
            Select filters to refine the contact list for your export.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {/* Date Range */}
          <div>
            <Label className="font-medium">Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal mt-2",
                    !filters.dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange?.from ? (
                    filters.dateRange.to ? (
                      <>
                        {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                        {format(filters.dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(filters.dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={filters.dateRange?.from}
                  selected={filters.dateRange}
                  onSelect={handleDateChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          {/* Initial Call Feedback */}
          <div>
            <Label className="font-medium">Initial Call Status</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {feedbackOptions.map(option => (
                <div key={`initial-${option}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-initial-${option}`}
                    checked={filters.initialCallFeedback.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange('initialCallFeedback', option, !!checked)}
                  />
                  <label htmlFor={`export-initial-${option}`} className="text-sm font-medium leading-none">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Follow-up Call Feedback */}
          <div>
            <Label className="font-medium">Follow-up Call Status</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {feedbackOptions.map(option => (
                <div key={`followup-${option}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-followup-${option}`}
                    checked={filters.followUpCallFeedback.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange('followUpCallFeedback', option, !!checked)}
                  />
                  <label htmlFor={`export-followup-${option}`} className="text-sm font-medium leading-none">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button onClick={handleExportClick}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};