# Meetly Backend Setup Guide

## Overview
Meetly uses Firebase Cloud Functions (Python) with Google Gemini AI to process audio recordings for transcription, translation, and summarization.

## Prerequisites
1. Firebase project with Blaze plan (required for Cloud Functions)
2. Google AI Studio API key for Gemini
3. Firebase CLI installed locally

## Setup Steps

### 1. Get Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the key for later use

### 2. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 3. Login to Firebase
```bash
firebase login
```

### 4. Initialize Firebase Functions
```bash
# In your project root directory
firebase init functions

# Select:
# - Use an existing project (select your project)
# - Python as the language
# - Install dependencies now
```

### 5. Configure Environment Variables
```bash
# Set the Gemini API key
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY_HERE"

# Verify the configuration
firebase functions:config:get
```

### 6. Deploy Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:process_audio_recording
```

### 7. Set up Storage and Firestore Rules
```bash
# Deploy security rules
firebase deploy --only firestore:rules,storage
```

## Function Details

### `process_audio_recording`
- **Trigger**: Automatically runs when audio files are uploaded to `meetly-audio/` in Firebase Storage
- **Process**: Downloads audio → Gemini AI processing → Updates Firestore with results
- **Output**: Transcript, English translation, and AI summary

### `reprocess_recording`
- **Trigger**: Callable function for manually reprocessing failed recordings
- **Usage**: Called from frontend when user clicks "Retry" on failed recordings

### `get_recording_status`
- **Trigger**: Callable function to check processing status
- **Usage**: Called from frontend to get real-time status updates

## File Structure
```
functions/
├── main.py              # Entry point
├── process_audio.py     # Main processing logic
├── requirements.txt     # Python dependencies
└── .env                 # Environment variables (create from .env.example)
```

## Security
- Firestore rules ensure users can only access their own recordings
- Storage rules restrict access to user-specific audio files
- Cloud Functions validate user authentication before processing

## Monitoring
- Check Firebase Console → Functions for execution logs
- Monitor Firestore for document updates
- Check Storage for uploaded audio files

## Troubleshooting

### Common Issues
1. **Permission Denied**: Check Firestore and Storage rules
2. **Function Timeout**: Increase timeout in Firebase Console
3. **Gemini API Errors**: Verify API key and quota limits
4. **Audio Upload Fails**: Check Storage rules and file size limits

### Debugging
```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only process_audio_recording
```

## Cost Considerations
- Cloud Functions: Pay per execution
- Storage: Pay per GB stored
- Gemini API: Pay per API call
- Firestore: Pay per read/write operation

Estimated cost for 100 recordings/month: $5-15 USD