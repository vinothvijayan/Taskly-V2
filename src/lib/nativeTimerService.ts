import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, PermissionStatus } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Task } from '@/types';

const ONGOING_NOTIFICATION_ID = 1001; // A fixed ID for our timer notification

class NativeTimerService {
    private timerInterval: NodeJS.Timeout | null = null;
    private task: Task | null = null;
    private startTime: number = 0;
    private accumulatedSeconds: number = 0;
    private isPaused: boolean = false;
    private hasPermission: boolean = false;

    constructor() {
        if (Capacitor.isNativePlatform()) {
            this.checkPermissions();
            App.addListener('appStateChange', this.handleAppStateChange);
        }
    }

    private async checkPermissions() {
        const status: PermissionStatus = await LocalNotifications.checkPermissions();
        this.hasPermission = status.display === 'granted';
    }

    private async requestPermissions(): Promise<boolean> {
        const status: PermissionStatus = await LocalNotifications.requestPermissions();
        this.hasPermission = status.display === 'granted';
        return this.hasPermission;
    }

    public async start(task: Task, initialSeconds: number = 0) {
        if (!Capacitor.isNativePlatform()) return;
        if (!this.hasPermission) {
            const permissionGranted = await this.requestPermissions();
            if (!permissionGranted) {
                console.warn("Notification permission denied. Cannot show timer notification.");
                return;
            }
        }

        await this.stop(); // Stop any existing timer

        this.task = task;
        this.startTime = Date.now();
        this.accumulatedSeconds = initialSeconds;
        this.isPaused = false;

        await this.showOrUpdateNotification();

        this.timerInterval = setInterval(() => {
            this.showOrUpdateNotification();
        }, 30 * 1000); // Update every 30 seconds
    }

    public async stop() {
        if (!Capacitor.isNativePlatform()) return;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.task = null;
        await LocalNotifications.cancel({ notifications: [{ id: ONGOING_NOTIFICATION_ID }] });
    }

    public async pause() {
        if (!this.task || this.isPaused) return;
        this.isPaused = true;
        if (this.startTime > 0) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.accumulatedSeconds += elapsed;
        }
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.startTime = 0;
        await this.showOrUpdateNotification();
    }

    public async resume() {
        if (!this.task || !this.isPaused) return;
        this.isPaused = false;
        this.startTime = Date.now();
        await this.showOrUpdateNotification();
        this.timerInterval = setInterval(() => {
            this.showOrUpdateNotification();
        }, 30 * 1000);
    }

    private getFormattedTime(totalSeconds: number): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    private async showOrUpdateNotification() {
        if (!this.task) return;

        let currentSeconds = this.accumulatedSeconds;
        if (!this.isPaused && this.startTime > 0) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            currentSeconds += elapsed;
        }

        const body = this.isPaused
            ? `Paused at ${this.getFormattedTime(currentSeconds)}`
            : `Timer running: ${this.getFormattedTime(currentSeconds)}`;

        const options: ScheduleOptions = {
            notifications: [{
                id: ONGOING_NOTIFICATION_ID,
                title: `Tracking: ${this.task.title}`,
                body: body,
                ongoing: true,
                autoCancel: false,
                channelId: 'app_main_channel',
                smallIcon: 'ic_launcher', // Using a default icon for safety
                iconColor: '#488AFF',
            }]
        };
        await LocalNotifications.schedule(options);
    }

    private handleAppStateChange = ({ isActive }: { isActive: boolean }) => {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        if (isActive) {
            if (!this.isPaused) {
                this.timerInterval = setInterval(() => {
                    this.showOrUpdateNotification();
                }, 30 * 1000);
            }
        }
    };
}

export const nativeTimerService = new NativeTimerService();