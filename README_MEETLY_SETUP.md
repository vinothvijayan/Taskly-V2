# Meetly Backend Setup Guide (Simplified)

## Overview
Meetly uses a Firebase Cloud Function (Python) with Google Gemini AI to process your audio recordings for transcription, translation, and summarization. This guide provides the simplified steps to get it working.

## Prerequisites
1.  A Firebase project with the **Blaze (Pay-as-you-go)** plan. This is required to use Cloud Functions with Google services.
2.  A Google Gemini API key.

---

## Step 1: Get Your Google Gemini API Key

1.  Go to [**Google AI Studio**](https://aistudio.google.com/app/apikey).
2.  Click "**Create API key**".
3.  Copy the generated key. You will need it in the next step.



---

## Step 2: Add the API Key to Your Backend Code

1.  Open the file `functions/meetly_processor.py` in the editor.
2.  On **line 15**, you will see a placeholder:
    ```python
    GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
    ```
3.  Replace `"YOUR_GEMINI_API_KEY_HERE"` with the actual key you copied from Google AI Studio.
4.  That's it! Now you're ready to deploy.

---

## Step 3: Deploy Your Backend

After adding your API key, you need to deploy the backend function.

<dyad-command type="rebuild"></dyad-command>

Click the **Rebuild** button above the chat to deploy the changes. This will install all necessary dependencies and publish your new `process_meetly_recording` function.

After the rebuild is complete, you can go to the Meetly page and start recording or uploading audio files!