import os
import tempfile
import time
import subprocess
from typing import Dict, Any

# --- SECURITY WARNING: Hardcoding API keys is dangerous. ---
HARDCODED_GEMINI_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

# The top-level import for google.generativeai is REMOVED to prevent the ModuleNotFoundError on startup.
# It is now imported lazily inside the function that uses it.

from firebase_admin import initialize_app, storage, firestore, _apps
from firebase_functions import storage_fn
from google.cloud import storage as gcs


@storage_fn.on_object_finalized(
    bucket="huddlely.firebasestorage.app"
    # secrets=["GEMINI_API_KEY"] # REMOVED since the key is now hardcoded
)
def process_audio_recording(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """
    Triggered when a file is uploaded to 'meetly-audio/'.
    Downloads it, converts to mp3, transcribes + translates + summarizes using Gemini,
    then updates the corresponding Firestore document.
    """
    file_data = cloud_event.data
    file_path = file_data.name

    # Only handle meetly-audio folder
    if not file_path.startswith("meetly-audio/"):
        print(f"Ignoring file, not in 'meetly-audio/' folder: {file_path}")
        return

    # Init Firebase only once
    if not _apps:
        initialize_app()

    metadata = file_data.metadata
    if not metadata or 'firestoreId' not in metadata:
        print(f"Ignoring meetly file without 'firestoreId' in metadata: {file_path}")
        return

    document_id = metadata['firestoreId']
    print(f"Received meetly file with Firestore ID: {document_id}")

    db = firestore.client()
    doc_ref = db.collection('meetingRecordings').document(document_id)

    temp_webm_path = None
    temp_mp3_path = None

    try:
        if not doc_ref.get().exists:
            raise ValueError(f"No matching recording document found for ID: {document_id}")

        doc_ref.update({'status': 'processing'})

        # Download .webm from storage
        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        _, temp_webm_path = tempfile.mkstemp(suffix=".webm")
        blob.download_to_filename(temp_webm_path)

        # Convert to .mp3 using ffmpeg
        # NOTE: This REQUIRES the 'ffmpeg' binary to be installed on the OS (via Dockerfile).
        _, temp_mp3_path = tempfile.mkstemp(suffix=".mp3")
        ffmpeg_command = [
            "ffmpeg", "-y", "-i", temp_webm_path,
            "-vn", "-ab", "192k", "-ar", "44100", "-f", "mp3", temp_mp3_path
        ]
        subprocess.run(ffmpeg_command, check=True, capture_output=True)

        # Process audio with Gemini
        results = process_meeting_with_gemini(temp_mp3_path, os.path.basename(file_path))

        # Update Firestore with results
        doc_ref.update({
            'transcript': results.get('transcript'),
            'translatedTranscript': results.get('translated_transcript'),
            'summary': results.get('summary'),
            'status': 'completed'
        })
        print(f"Successfully processed meetly file: {file_path}")

    except Exception as e:
        if isinstance(e, subprocess.CalledProcessError):
            print(f"--- FFMPEG CONVERSION FAILED ---\nSTDERR: {e.stderr.decode()}")
        print(f"Error processing meetly file {file_path}: {e}")
        try:
            doc_ref.update({'status': 'failed', 'error': str(e)})
        except Exception as cleanup_error:
            print(f"Failed to mark meetly document as failed: {cleanup_error}")
    finally:
        if temp_webm_path and os.path.exists(temp_webm_path):
            os.unlink(temp_webm_path)
        if temp_mp3_path and os.path.exists(temp_mp3_path):
            os.unlink(temp_mp3_path)


def process_meeting_with_gemini(audio_file_path: str, display_name: str) -> Dict[str, str]:
    """
    Processes audio with Gemini using prompts tailored for meeting summaries.
    Returns transcript, translated_transcript, summary.
    """
    # --- LAZY IMPORT: This fixes the ModuleNotFoundError crash ---
    import google.generativeai as genai
    
    # --- HARDCODED KEY USAGE ---
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)

    uploaded_file = None
    try:
        print(f"Uploading meeting audio to Gemini: {display_name}")
        uploaded_file = genai.upload_file(path=audio_file_path, mime_type="audio/mp3")

        # Wait until file is processed on Gemini servers
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)

        if uploaded_file.state.name != "ACTIVE":
            raise ValueError(f"File processing failed on Gemini's servers.")

        model = genai.GenerativeModel(model_name='models/gemini-2.5-flash')

        print("Generating meeting transcript...")
        transcript_response = model.generate_content([
            "Please provide a clean and accurate transcript for this audio file.",
            uploaded_file
        ])
        transcript_text = transcript_response.text

        print("Generating English translation for meeting...")
        translation_response = model.generate_content([
            "Translate the following transcript into clear and accurate English.",
            transcript_text
        ])
        translated_text = translation_response.text

        print("Generating meeting summary...")
        summary_response = model.generate_content([
            "Based on the following meeting transcript, provide a comprehensive summary in bullet points.",
            transcript_text
        ])
        summary_text = summary_response.text

        return {
            "transcript": transcript_text,
            "translated_transcript": translated_text,
            "summary": summary_text
        }

    finally:
        # Cleanup uploaded file on Gemini
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
            except Exception as e:
                print(f"Warning: couldn't delete uploaded file on Gemini: {e}")


# -------------------------------
# PLACEHOLDER FUNCTIONS FOR DEPLOY
# -------------------------------

def reprocess_recording(recording_id: str) -> Dict[str, Any]:
    """
    Placeholder function to reprocess a recording.
    Replace with real logic later.
    """
    return {"status": "reprocessed", "recordingId": recording_id}

def get_recording_status(recording_id: str) -> Dict[str, Any]:
    """
    Placeholder function to get the current processing status.
    Replace with real logic later.
    """
    return {"status": "unknown", "recordingId": recording_id}