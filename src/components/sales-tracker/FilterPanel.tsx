import React from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallLog } from '@/lib/sales-tracker-data';

export interface FilterState {
  dateRange: DateRange | undefined;
  initialCallFeedback: string[];
  followUpCallFeedback: string[];
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const feedbackOptions: CallLog['feedback'][] = ['Interested', 'Not Interested', 'Follow Up', 'Callback', 'Not Picked', 'Send Details'];

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFiltersChange }) => {
  const handleDateChange = (range: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleCheckboxChange = (
    category: 'initialCallFeedback' | 'followUpCallFeedback',
    value: string,
    checked: boolean
  ) => {
    const currentValues = filters[category];
    const newValues = checked ? [...currentValues, value] : currentValues.filter(item => item !== value);
    onFiltersChange({ ...filters, [category]: newValues });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-medium text-xs">Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal mt-1",
                !filters.dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "LLL dd")} - {format(filters.dateRange.to, "LLL dd")}
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
              selected={filters.dateRange}
              onSelect={handleDateChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>
      <Separator />
      <div>
        <Label className="font-medium text-xs">Initial Call Status</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {feedbackOptions.map(option => (
            <div key={`initial-${option}`} className="flex items-center space-x-2">
              <Checkbox
                id={`initial-${option}`}
                checked={filters.initialCallFeedback.includes(option)}
                onCheckedChange={(checked) => handleCheckboxChange('initialCallFeedback', option, !!checked)}
              />
              <label htmlFor={`initial-${option}`} className="text-sm">{option}</label>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="font-medium text-xs">Follow-up Call Status</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {feedbackOptions.map(option => (
            <div key={`followup-${option}`} className="flex items-center space-x-2">
              <Checkbox
                id={`followup-${option}`}
                checked={filters.followUpCallFeedback.includes(option)}
                onCheckedChange={(checked) => handleCheckboxChange('followUpCallFeedback', option, !!checked)}
              />
              <label htmlFor={`followup-${option}`} className="text-sm">{option}</label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};