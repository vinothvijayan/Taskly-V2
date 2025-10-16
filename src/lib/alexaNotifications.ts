// Lightweight Alexa notification adapter
// This client assumes you have a backend endpoint that bridges to Alexa (Proactive Events or skill logic).
// In dev, it falls back to speech via Web Speech API as a local mock.

export type AlexaEventType = 'chat' | 'task' | 'comment' | 'assignment' | 'pomodoro' | 'general' | 'reminder' | 'task_created';

export interface AlexaNotificationPayload {
  title: string;
  body: string;
  type: AlexaEventType;
  userId?: string;
  data?: any;
  scheduledTime?: number;
}

class AlexaNotificationsClient {
  private enabled: boolean;
  private webhookUrl: string | null;

  constructor() {
    // Toggle via Vite env at build-time
    // Define VITE_ALEXA_ENABLED=true and VITE_ALEXA_WEBHOOK="https://your-backend.example.com/alexa/notify"
    this.enabled = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ALEXA_ENABLED === 'true';
    this.webhookUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_ALEXA_WEBHOOK || null : null;
  }

  public isEnabled(): boolean {
    return !!this.enabled && !!this.webhookUrl;
  }

  async init(): Promise<void> {
    // No-op on client. Real Alexa linking happens server-side.
  }

  async send(payload: AlexaNotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      this.speakFallback(payload);
      return;
    }

    try {
      await fetch(this.webhookUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Fall back to local speech so developers can still validate flows
      console.warn('Alexa webhook failed, using speech fallback:', error);
      this.speakFallback(payload);
    }
  }

  async schedule(payload: AlexaNotificationPayload): Promise<void> {
    // For simplicity, defer scheduling to backend if available; otherwise setTimeout locally
    if (!payload.scheduledTime || payload.scheduledTime <= Date.now()) {
      return this.send(payload);
    }

    if (this.isEnabled()) {
      try {
        await fetch((this.webhookUrl as string) + '/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return;
      } catch (error) {
        console.warn('Alexa schedule webhook failed, falling back to local timeout:', error);
      }
    }

    const delay = payload.scheduledTime - Date.now();
    setTimeout(() => this.speakFallback(payload), Math.max(0, delay));
  }

  private speakFallback(payload: AlexaNotificationPayload) {
    try {
      const text = `${payload.title}. ${payload.body}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis?.speak(utterance);
    } catch {
      // Ignore if speech synthesis is unavailable
    }
  }
}

export const alexaNotifications = new AlexaNotificationsClient();



