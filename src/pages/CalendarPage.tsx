import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeRangePicker } from "@/components/ui/time-picker";
import { useToast } from "@/hooks/use-toast";
import { googleCalendarService } from "@/lib/googleCalendar";
import { AttendeeSelector } from "@/components/common/AttendeeSelector";
import { CustomReminderDialog } from "@/components/common/CustomReminderDialog";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Plus,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  CalendarPlus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  colorId?: string;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todaysEvents, setTodaysEvents] = useState<CalendarEvent[]>([]);
  const [freeSlots, setFreeSlots] = useState<Array<{ start: Date; end: Date }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    startTime: "",
    endTime: "",
    duration: "60",
    attendees: [] as Array<{ email: string; displayName?: string }>
  });
  const { toast } = useToast();

  useEffect(() => {
    initializeCalendar();
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadEventsForDate(selectedDate);
    }
  }, [selectedDate, isConnected]);

  const initializeCalendar = async () => {
    try {
      setInitializing(true);
      const initialized = await googleCalendarService.initialize();
      if (initialized) {
        const signedIn = googleCalendarService.isUserSignedIn();
        setIsConnected(signedIn);
        if (signedIn) {
          await loadTodaysEvents();
          await loadEventsForDate(selectedDate);
        }
      }
    } catch (error) {
      console.error('Failed to initialize calendar:', error);
    } finally {
      setInitializing(false);
    }
  };

  const connectToGoogle = async () => {
    try {
      setLoading(true);
      
      const success = await googleCalendarService.signIn();
      if (success) {
        setIsConnected(true);
        await loadTodaysEvents();
        await loadEventsForDate(selectedDate);
        toast({
          title: "Calendar Connected! 📅",
          description: "Successfully connected to Google Calendar.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to Google Calendar. Please ensure the API is properly configured and authorized origins are set up in Google Cloud Console.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to connect to Google Calendar:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Google Calendar. Please check your API credentials and ensure https://localhost:8080 is added to authorized JavaScript origins in Google Cloud Console.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectFromGoogle = async () => {
    try {
      await googleCalendarService.signOut();
      setIsConnected(false);
      setEvents([]);
      setTodaysEvents([]);
      setFreeSlots([]);
      toast({
        title: "Calendar Disconnected",
        description: "Successfully disconnected from Google Calendar.",
      });
    } catch (error) {
      console.error('Failed to disconnect from Google Calendar:', error);
    }
  };

  const loadTodaysEvents = async () => {
    try {
      const events = await googleCalendarService.getTodaysEvents();
      setTodaysEvents(events);
      
      // Find free slots for today
      const slots = await googleCalendarService.findFreeSlots(60); // 60-minute slots
      setFreeSlots(slots);
    } catch (error) {
      console.error('Failed to load today\'s events:', error);
    }
  };

  const loadEventsForDate = async (date: Date) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const events = await googleCalendarService.getEvents(
        startOfDay.toISOString(),
        endOfDay.toISOString()
      );
      setEvents(events);
    } catch (error) {
      console.error('Failed to load events for date:', error);
      toast({
        title: "Failed to Load Events",
        description: "Could not load calendar events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createFocusBlock = async (duration: number) => {
    try {
      const freeSlot = freeSlots[0]; // Use the first available slot
      if (!freeSlot) {
        throw new Error("Failed to connect to Google Calendar");
        return;
      }

      await googleCalendarService.createFocusBlock(
        "Deep Work Session",
        duration,
        freeSlot.start
      );
      
      await loadTodaysEvents();
      await loadEventsForDate(selectedDate);
      
      toast({
        title: "Focus Block Created! 🎯",
        description: `${duration}-minute focus session scheduled.`,
      });
    } catch (error) {
      console.error('Google Calendar connection error:', error);
      console.error('Failed to create focus block:', error);
      toast({
        title: "Failed to Create Focus Block",
        description: error instanceof Error ? error.message : "Failed to connect to Google Calendar. This may be due to missing API credentials or unauthorized domain.",
        variant: "destructive",
      });
    }
  };

  const createCustomReminder = async (reminder: {
    title: string;
    duration: number;
    type: string;
    description?: string;
    startTime?: string;
  }) => {
    try {
      let startDateTime: Date;
      
      if (reminder.startTime) {
        // Use specific time
        const today = new Date();
        const [hours, minutes] = reminder.startTime.split(':').map(Number);
        startDateTime = new Date(today);
        startDateTime.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (startDateTime < new Date()) {
          startDateTime.setDate(startDateTime.getDate() + 1);
        }
      } else {
        // Use next available slot
        const freeSlot = freeSlots[0];
        if (!freeSlot) {
          throw new Error("No available time slots found");
        }
        startDateTime = freeSlot.start;
      }

      const endDateTime = new Date(startDateTime.getTime() + reminder.duration * 60 * 1000);

      const eventData = {
        summary: reminder.title,
        description: reminder.description,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
        colorId: reminder.type === 'focus' ? '1' : reminder.type === 'break' ? '5' : '3'
      };

      await googleCalendarService.createEvent(eventData);
      
      await loadTodaysEvents();
      await loadEventsForDate(selectedDate);
      
      toast({
        title: "Reminder Created! ⏰",
        description: `${reminder.title} scheduled for ${reminder.duration} minutes.`,
      });
    } catch (error) {
      console.error('Failed to create custom reminder:', error);
      toast({
        title: "Failed to Create Reminder",
        description: error instanceof Error ? error.message : "Could not create the reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateCustomEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.startTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in the title, date, and start time.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingEvent(true);
      
      const eventDate = new Date(newEvent.date);
      const [startHour, startMinute] = newEvent.startTime.split(':').map(Number);
      
      const startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      let endDateTime: Date;
      if (newEvent.endTime) {
        const [endHour, endMinute] = newEvent.endTime.split(':').map(Number);
        endDateTime = new Date(eventDate);
        endDateTime.setHours(endHour, endMinute, 0, 0);
      } else {
        // Use duration if no end time specified
        endDateTime = new Date(startDateTime.getTime() + parseInt(newEvent.duration) * 60 * 1000);
      }

      // Ensure end time is after start time (minimum 1 minute duration)
      if (endDateTime <= startDateTime) {
        endDateTime = new Date(startDateTime.getTime() + 60 * 1000); // Add 1 minute
      }

      const eventData = {
        summary: newEvent.title,
        description: newEvent.description || undefined,
        location: newEvent.location || undefined,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
        attendees: newEvent.attendees.length > 0 ? newEvent.attendees : undefined,
        colorId: '2' // Green color for custom events
      };

      await googleCalendarService.createEvent(eventData);
      
      // Refresh events
      await loadTodaysEvents();
      await loadEventsForDate(selectedDate);
      
      // Reset form and close dialog
      setNewEvent({
        title: "",
        description: "",
        location: "",
        date: "",
        startTime: "",
        endTime: "",
        duration: "60",
        attendees: []
      });
      setShowCreateDialog(false);
      
      toast({
        title: "Meeting Created! 📅",
        description: `"${newEvent.title}" has been added to your calendar.`,
      });
    } catch (error) {
      console.error('Failed to create custom event:', error);
      toast({
        title: "Failed to Create Meeting",
        description: "Could not create the meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingEvent(false);
    }
  };
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeRange = (start: string, end: string) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const getEventDuration = (start: string, end: string) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
    return Math.round(duration);
  };

  if (initializing) {
    return (
      <div className="container max-w-6xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Initializing calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">
            Connect your calendar and schedule focus sessions seamlessly
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <Badge variant="secondary" className="text-success border-success/20 bg-success/10">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="hover-scale border-primary/20 hover:bg-primary/5">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    New Meeting
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] shadow-elegant">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CalendarPlus className="h-5 w-5" />
                      Create New Meeting
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Meeting Title *</Label>
                      <Input
                        id="title"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="Team standup, Client call, etc."
                        className="transition-smooth focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Meeting agenda, notes, etc."
                        rows={3}
                        className="transition-smooth focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={newEvent.location}
                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                        placeholder="Conference room, Zoom link, etc."
                        className="transition-smooth focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                        className="transition-smooth focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <TimeRangePicker
                      startTime={newEvent.startTime}
                      endTime={newEvent.endTime}
                      onStartTimeChange={(value) => setNewEvent({...newEvent, startTime: value})}
                      onEndTimeChange={(value) => setNewEvent({...newEvent, endTime: value})}
                    />
                    
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Select
                        value={newEvent.duration}
                        onValueChange={(value) => setNewEvent({ ...newEvent, duration: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="90">1.5 hours</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Attendees */}
                    <AttendeeSelector
                      attendees={newEvent.attendees}
                      onAttendeesChange={(attendees) => setNewEvent({ ...newEvent, attendees })}
                    />
                    
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                      * If end time is not specified, duration will be used
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                      disabled={creatingEvent}
                      className="hover-scale"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateCustomEvent}
                      disabled={creatingEvent || !newEvent.title || !newEvent.date || !newEvent.startTime}
                      variant="focus"
                      className="hover-scale"
                    >
                      {creatingEvent ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Create Meeting
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={disconnectFromGoogle} className="hover-scale text-destructive hover:bg-destructive/5 hover:border-destructive/20">
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={connectToGoogle} disabled={loading} variant="focus" className="hover-scale shadow-elegant">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarIcon className="h-4 w-4 mr-2" />
              )}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>

      {!isConnected ? (
        <Card className="shadow-elegant border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="h-20 w-20 bg-gradient-to-br from-primary/10 to-focus/10 rounded-2xl flex items-center justify-center shadow-elegant">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">Connect Your Calendar</h3>
              <p className="text-muted-foreground max-w-lg leading-relaxed">
                Connect your Google Calendar to view events, schedule focus sessions, 
                and find optimal times for deep work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 max-w-2xl">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <CalendarIcon className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">View Events</p>
                  <p className="text-xs text-muted-foreground">See your schedule</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-focus" />
                  <p className="text-sm font-medium">Focus Blocks</p>
                  <p className="text-xs text-muted-foreground">Schedule deep work</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Plus className="h-6 w-6 mx-auto mb-2 text-success" />
                  <p className="text-sm font-medium">Create Meetings</p>
                  <p className="text-xs text-muted-foreground">Add custom events</p>
                </div>
              </div>
            </div>
            <Button onClick={connectToGoogle} disabled={loading} variant="focus" size="lg" className="hover-scale shadow-elegant">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarIcon className="h-4 w-4 mr-2" />
              )}
              Connect Google Calendar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-1 shadow-elegant border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-lg border shadow-sm"
              />
            </CardContent>
          </Card>

          {/* Events for Selected Date */}
          <Card className="lg:col-span-2 shadow-elegant border-focus/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {selectedDate.toDateString() === new Date().toDateString() 
                    ? "Today's Schedule" 
                    : `Events for ${selectedDate.toLocaleDateString()}`}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadEventsForDate(selectedDate)}
                  disabled={loading}
                  className="hover-scale"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                {events.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon className="h-8 w-8 opacity-50" />
                    </div>
                    <h4 className="font-medium mb-1">No events scheduled</h4>
                    <p className="text-sm">This day is free for focus work</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="p-4 border rounded-lg hover:bg-muted/30 transition-smooth hover:shadow-sm border-l-4 border-l-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate text-foreground">{event.summary}</h4>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                {event.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              {event.start.dateTime && event.end.dateTime && (
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                                  <Clock className="h-3 w-3" />
                                  {formatTimeRange(event.start.dateTime, event.end.dateTime)}
                                  <span className="ml-1 font-medium">
                                    ({getEventDuration(event.start.dateTime, event.end.dateTime)}m)
                                  </span>
                                </div>
                              )}
                              
                              {event.location && (
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                              
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                                  <Users className="h-3 w-3" />
                                  <span className="font-medium">{event.attendees.length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover-scale">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Today's Overview & Quick Actions */}
          {selectedDate.toDateString() === new Date().toDateString() && (
            <Card className="lg:col-span-3 shadow-elegant border-success/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Free Time Slots */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-success" />
                      Available Time Slots
                    </h4>
                    {freeSlots.length === 0 ? (
                      <div className="text-center py-6 bg-muted/20 rounded-lg border-dashed border-2 border-muted-foreground/20">
                        <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          No free time slots available today
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {freeSlots.slice(0, 3).map((slot, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg hover:bg-success/10 transition-smooth"
                          >
                            <span className="text-sm font-medium">
                              {formatTime(slot.start.toISOString())} - {formatTime(slot.end.toISOString())}
                            </span>
                            <Badge variant="secondary" className="text-success bg-success/10 border-success/20">
                              {Math.round((slot.end.getTime() - slot.start.getTime()) / (1000 * 60))}m
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                   {/* Custom Reminder & Quick Actions */}
                   <div>
                     <h4 className="font-medium mb-3 flex items-center gap-2">
                       <Plus className="h-4 w-4 text-focus" />
                       Quick Actions
                     </h4>
                     <div className="space-y-3">
                       {/* Quick Focus Sessions */}
                       <div className="grid grid-cols-2 gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => createFocusBlock(25)}
                           disabled={freeSlots.length === 0}
                           className="hover-scale border-focus/20 hover:bg-focus/5"
                         >
                           <Clock className="h-3 w-3 mr-1" />
                           25 min
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => createFocusBlock(60)}
                           disabled={freeSlots.length === 0}
                           className="hover-scale border-focus/20 hover:bg-focus/5"
                         >
                           <Clock className="h-3 w-3 mr-1" />
                           1 hour
                         </Button>
                       </div>
                       
                       {/* Custom Reminder Button */}
                       <CustomReminderDialog onCreateReminder={createCustomReminder}>
                         <Button
                           variant="outline"
                           className="w-full hover-scale border-primary/20 hover:bg-primary/5"
                           disabled={freeSlots.length === 0}
                         >
                           <Plus className="h-4 w-4 mr-2" />
                           Custom Reminder
                         </Button>
                       </CustomReminderDialog>
                       
                       {freeSlots.length === 0 && (
                         <p className="text-xs text-muted-foreground p-2 bg-muted/20 rounded-md">
                           No available time slots for new events
                         </p>
                       )}
                     </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}