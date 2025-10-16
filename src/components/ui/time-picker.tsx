import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TimePickerSelectProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  interval?: number // minutes between options
  format24h?: boolean
}

// Generate time options
const generateTimeOptions = (interval: number = 15, format24h: boolean = false) => {
  const times: { value: string; label: string; hour: number }[] = []
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      
      let label: string
      if (format24h) {
        label = timeString
      } else {
        const period = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const displayMinute = minute.toString().padStart(2, '0')
        label = `${displayHour}:${displayMinute} ${period}`
      }
      
      times.push({ value: timeString, label, hour })
    }
  }
  
  return times
}

// Quick time presets
const getQuickPresets = () => {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  // Round to next 15-minute interval
  const roundedMinute = Math.ceil(currentMinute / 15) * 15
  const nextSlotHour = roundedMinute >= 60 ? currentHour + 1 : currentHour
  const nextSlotMinute = roundedMinute >= 60 ? 0 : roundedMinute
  
  return [
    {
      label: "Now",
      value: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
    },
    {
      label: "Next slot",
      value: `${nextSlotHour.toString().padStart(2, '0')}:${nextSlotMinute.toString().padStart(2, '0')}`
    }
  ]
}

// Common business hour presets
const businessHourPresets = [
  { label: "9:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "11:00 AM", value: "11:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "2:00 PM", value: "14:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "5:00 PM", value: "17:00" }
]

export function TimePickerSelect({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
  interval = 15,
  format24h = false
}: TimePickerSelectProps) {
  const timeOptions = React.useMemo(() => generateTimeOptions(interval, format24h), [interval, format24h])
  const quickPresets = React.useMemo(() => getQuickPresets(), [])
  
  const formatDisplayValue = (timeValue: string) => {
    if (!timeValue) return placeholder
    
    const option = timeOptions.find(opt => opt.value === timeValue)
    return option ? option.label : timeValue
  }

  const isBusinessHour = (hour: number) => hour >= 9 && hour <= 17

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <Clock className="h-4 w-4 opacity-50" />
        <SelectValue placeholder={placeholder}>
          {value ? formatDisplayValue(value) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {/* Quick presets */}
        <div className="p-2 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">Quick</div>
          {quickPresets.map((preset) => (
            <SelectItem key={preset.label} value={preset.value} className="text-sm">
              <span className="font-medium">{preset.label}</span>
            </SelectItem>
          ))}
        </div>
        
        {/* Business hour presets */}
        <div className="p-2 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">Common</div>
          {businessHourPresets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value} className="text-sm">
              {preset.label}
            </SelectItem>
          ))}
        </div>
        
        {/* All time options */}
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">All times</div>
          {timeOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className={cn(
                "text-sm",
                isBusinessHour(option.hour) && "bg-primary/5"
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  )
}

// Time range picker component
interface TimeRangePickerProps {
  startTime?: string
  endTime?: string
  onStartTimeChange?: (value: string) => void
  onEndTimeChange?: (value: string) => void
  disabled?: boolean
  className?: string
  interval?: number
  format24h?: boolean
}

export function TimeRangePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  disabled = false,
  className,
  interval = 15,
  format24h = false
}: TimeRangePickerProps) {
  // Auto-suggest end time based on start time (1 hour later)
  const handleStartTimeChange = (value: string) => {
    onStartTimeChange?.(value)
    
    if (!endTime && value) {
      try {
        const [hours, minutes] = value.split(':').map(Number)
        const startDate = new Date()
        startDate.setHours(hours, minutes, 0, 0)
        
        // Add 1 hour
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        const endTimeString = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
        onEndTimeChange?.(endTimeString)
      } catch (error) {
        console.warn('Could not auto-calculate end time:', error)
      }
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Start time</label>
        <TimePickerSelect
          value={startTime}
          onChange={handleStartTimeChange}
          placeholder="Start time"
          disabled={disabled}
          interval={interval}
          format24h={format24h}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">End time</label>
        <TimePickerSelect
          value={endTime}
          onChange={onEndTimeChange}
          placeholder="End time"
          disabled={disabled}
          interval={interval}
          format24h={format24h}
        />
      </div>
    </div>
  )
}