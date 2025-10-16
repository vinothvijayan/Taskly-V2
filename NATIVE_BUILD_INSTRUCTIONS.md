# Native Android Build Instructions

## Prerequisites
1. **Export to GitHub**: Use the "Export to GitHub" button in Lovable
2. **Clone locally**: `git clone [your-repo-url]`
3. **Install dependencies**: `npm install`

## Required Dependencies
The project needs `@capacitor/google-auth` for native Google Sign-In:

```bash
npm install @capacitor/google-auth
```

## Build Native Android App

### 1. Add Android Platform
```bash
npx cap add android
```

### 2. Build Web Assets
```bash
npm run build
```

### 3. Sync with Native Platform
```bash
npx cap sync
```

### 4. Run on Android
```bash
npx cap run android
```

## Configuration Status
✅ **Already configured:**
- `google-services.json` in `android/app/`
- `capacitor.config.ts` with correct Google Auth settings
- `UniversalAuth` class with native authentication flow

## Testing Google Sign-In
1. **Native App**: Will use Capacitor Google Auth plugin → Firebase
2. **Web Preview**: Uses Firebase popup (may fail on mobile browsers)
3. **Chrome on Emulator**: Runs as web app, not native

## Key Differences
- **Web**: Firebase popup authentication
- **Native**: Capacitor Google Auth → Firebase credential exchange
- **Current Issue**: Running web app in Chrome instead of native Capacitor app

## Next Steps
1. Follow build instructions above
2. Test Google Sign-In in native Android app
3. Verify authentication flow works properly