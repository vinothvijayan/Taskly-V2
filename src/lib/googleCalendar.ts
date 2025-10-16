// Define the structure of a Google Calendar event
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

// Define the configuration needed for the service. Note: apiKey is not required.
interface GoogleCalendarConfig {
  clientId: string;
  discoveryDoc: string;
  scopes: string;
}

export class GoogleCalendarService {
  private static instance: GoogleCalendarService;
  private gapi: any = null;
  private tokenClient: any = null;
  private isInitialized = false;
  private isSignedIn = false;

  private config: GoogleCalendarConfig = {
    clientId: '788189911710-116qci5dmm007uqott3qh3o5cai6l35v.apps.googleusercontent.com',
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'
  };

  private constructor() {}

  public static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.clientId || this.config.clientId.startsWith('YOUR_')) {
        console.warn('Google Client ID not configured.');
        return false;
      }

      if (!window.gapi) {
        await this.loadGoogleAPI();
      }
      
      if (!window.google) {
        await this.loadGoogleIdentityServicesAPI();
      }
      
      this.gapi = window.gapi;
      
      return new Promise((resolve) => {
        this.gapi.load('client', async () => {
          try {
            // Initialize the client
            await this.gapi.client.init({
              discoveryDocs: [this.config.discoveryDoc]
            });

            // Initialize the token client
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.config.clientId,
              scope: this.config.scopes,
              callback: (tokenResponse: any) => {
                this.gapi.client.setToken(tokenResponse);
                this.isSignedIn = true;
              }
            });

            this.isInitialized = true;
            this.isSignedIn = !!this.gapi.client.getToken()?.access_token;
            resolve(true);
          } catch (error) {
            console.warn('Google Calendar API initialization failed. This may be due to missing API credentials or unauthorized origins.');
            console.error('Error details:', error);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Failed to initialize Google Calendar API:', error);
      return false;
    }
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  private loadGoogleIdentityServicesAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services API'));
      document.head.appendChild(script);
    });
  }

  public async signIn(): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('Google Calendar API not initialized. Please check your configuration.');
      return false;
    }

    try {
      return new Promise((resolve) => {
        this.tokenClient.callback = (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google Calendar sign-in failed:', tokenResponse.error);
            resolve(false);
          } else {
            this.gapi.client.setToken(tokenResponse);
            this.isSignedIn = true;
            resolve(true);
          }
        };
        this.tokenClient.requestAccessToken();
      });
    } catch (error) {
      console.error('Google Calendar sign-in failed. This may be due to a blocked popup.', error);
      return false;
    }
  }

  public async signOut(): Promise<void> {
    if (this.isInitialized && this.isSignedIn) {
      const token = this.gapi.client.getToken();
      if (token && token.access_token) {
        window.google.accounts.oauth2.revoke(token.access_token);
        this.gapi.client.setToken('');
      }
      this.isSignedIn = false;
    }
  }

  public isUserSignedIn(): boolean {
    return this.isSignedIn && !!this.gapi?.client?.getToken()?.access_token;
  }

  public get isApiInitialized(): boolean {
    return this.isInitialized;
  }

  public async getEvents(timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    if (!this.isSignedIn) {
      throw new Error('User not signed in to Google Calendar');
    }

    try {
      const now = new Date();
      const response = await this.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || now.toISOString(),
        timeMax: timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 50,
        orderBy: 'startTime'
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      throw error;
    }
  }

  public async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    if (!this.isSignedIn) {
      throw new Error('User not signed in to Google Calendar');
    }

    try {
      const response = await this.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      return response.result;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  public async createCustomMeeting(
    title: string,
    description: string,
    location: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent> {
    const event = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      colorId: '2' // Green color for meetings
    };

    return this.createEvent(event);
  }
  public async createFocusBlock(title: string, duration: number, startTime?: Date): Promise<CalendarEvent> {
    const start = startTime || new Date();
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const event = {
      summary: `🎯 Focus: ${title}`,
      description: `Focus session created by MindMeld\nDuration: ${duration} minutes`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      colorId: '9' // Blue color
    };

    return this.createEvent(event);
  }

  public async getUpcomingEvents(limit: number = 10): Promise<CalendarEvent[]> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getEvents(now.toISOString(), endOfDay.toISOString());
  }

  public async getTodaysEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getEvents(startOfDay.toISOString(), endOfDay.toISOString());
  }

  public async findFreeSlots(duration: number, date?: Date): Promise<Array<{ start: Date; end: Date }>> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(9, 0, 0, 0); // Working hours start at 9 AM
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(17, 0, 0, 0); // Working hours end at 5 PM
    
    try {
      const events = await this.getEvents(startOfDay.toISOString(), endOfDay.toISOString());
      const freeSlots: Array<{ start: Date; end: Date }> = [];
      
      const sortedEvents = events
        .filter(event => event.start.dateTime)
        .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());
      
      let currentTime = startOfDay;
      
      for (const event of sortedEvents) {
        const eventStart = new Date(event.start.dateTime!);
        if (currentTime < eventStart) {
          const gapDuration = eventStart.getTime() - currentTime.getTime();
          if (gapDuration >= duration * 60 * 1000) {
            freeSlots.push({ start: new Date(currentTime), end: new Date(eventStart) });
          }
        }
        const eventEnd = new Date(event.end.dateTime!);
        currentTime = eventEnd > currentTime ? eventEnd : currentTime;
      }
      
      if (currentTime < endOfDay) {
        const remainingTime = endOfDay.getTime() - currentTime.getTime();
        if (remainingTime >= duration * 60 * 1000) {
          freeSlots.push({ start: new Date(currentTime), end: new Date(endOfDay) });
        }
      }
      
      return freeSlots;
    } catch (error) {
      console.error('Failed to find free slots:', error);
      return [];
    }
  }
}

export const googleCalendarService = GoogleCalendarService.getInstance();

// Extend window interface for TypeScript to recognize window.gapi
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}