import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.dwellingcare',
  appName: 'dwelling-care-daily',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
      requestPermissions: true,
      createDefaultChannel: true,
      channelImportance: 4,
      allowWhileIdle: true,
      scheduleExact: true
    },
    GoogleAuth: {
      scopes: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      serverClientId: '788189911710-116qci5dmm007uqott3qh3o5cai6l35v.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;