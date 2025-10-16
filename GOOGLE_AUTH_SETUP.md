# Google Sign-In Setup for Web & Native Capacitor

This guide explains how to set up Google Sign-In that works on both web and native Capacitor platforms.

## Current Status

✅ **Working Now:**
- Universal authentication service with platform detection
- Firebase Web SDK integration (working in browser)
- Automatic fallback from native to web authentication
- Updated AuthContext using universal authentication
- Build errors resolved - app compiles successfully

🔄 **Ready for Extension:**
- Capacitor configuration prepared for Google Auth plugin
- Native authentication scaffolding ready for plugin installation

## Required Steps to Complete Setup

### 1. Install Capacitor Google Auth Plugin

```bash
npm install @capacitor/google-auth
```

### 2. Configure Google OAuth Credentials

#### A. Web Application (Firebase Console)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `huddlely`
3. Go to Authentication > Sign-in method > Google
4. Your current web client ID is already configured in Firebase

#### B. Native Applications (Google Cloud Console)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Credentials > Credentials
3. Create OAuth 2.0 Client IDs for:
   - **Android**: Package name: `com.lovable.dwellingcare`
   - **iOS**: Bundle ID: `com.lovable.dwellingcare`

### 3. Update Configuration Files

#### Update `capacitor.config.ts`:
✅ **Already configured with your credentials:**

```typescript
GoogleAuth: {
  scopes: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  serverClientId: '788189911710-116qci5dmm007uqott3qh3o5cai6l35v.apps.googleusercontent.com', // Your web client ID
  forceCodeForRefreshToken: true
}
```

#### Update `src/lib/universalAuth.ts`:
Replace the placeholder client ID on line 35:

```typescript
clientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // iOS client ID
```

### 4. Platform-Specific Setup

#### Android Setup:
✅ **Already configured:**
1. `google-services.json` has been created in `android/app/google-services.json`
2. Contains your Android OAuth client configuration
3. The file will be automatically used by the plugin when you build for Android

#### iOS Setup:
⚠️ **Still needed:**
1. Download `GoogleService-Info.plist` from Firebase Console (iOS configuration)
2. Add it to your Xcode project in the app target
3. The plugin will automatically read the configuration

### 5. Build and Sync

After installing the plugin and updating configurations:

```bash
npm run build
npx cap sync
```

## How It Works

### Web Browser:
- Uses Firebase `signInWithPopup` (existing functionality)
- No additional plugin required
- Works immediately in web browsers

### Native Apps:
- Uses `@capacitor/google-auth` plugin
- Automatically converts Google Auth result to Firebase credential
- Provides native OAuth experience

### Fallback:
- If native plugin fails, automatically falls back to web auth
- Ensures authentication works even if plugin isn't properly configured

## Testing

### Web Testing:
1. Open app in browser
2. Click "Continue with Google"
3. Should work with existing Firebase setup

### Native Testing:
1. Install the plugin: `npm install @capacitor/google-auth`
2. Configure OAuth credentials
3. Run: `npx cap run android` or `npx cap run ios`
4. Test Google Sign-In in native app

## File Structure

```
src/
├── lib/
│   ├── platformDetection.ts     # Platform detection utilities
│   ├── universalAuth.ts         # Universal Google Auth service
│   └── firebase.ts              # Existing Firebase config
├── contexts/
│   └── AuthContext.tsx          # Updated to use universal auth
└── capacitor.config.ts          # Google Auth plugin config
```

## Next Steps

1. Install the Google Auth plugin
2. Configure OAuth credentials in Google Cloud Console
3. Update the configuration files with real client IDs
4. Test on both web and native platforms

The implementation is ready - you just need to complete the configuration!