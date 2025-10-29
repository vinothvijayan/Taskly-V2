import os
import tempfile
import time
import subprocess
import shutil
from typing import Dict

# Firebase & Google imports
from firebase_admin import initialize_app, storage, firestore, _apps
from firebase_functions import storage_fn, options
import google.generativeai as genai

# --- SECURITY WARNING: Use Firebase Secret Manager in production ---
GEMINI_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

# Set global Cloud Function options
options.set_global_options(
    region="us-central1",
    max_instances=10,
    timeout_sec=540,
    memory=options.MemoryOption.GB_2
)

# Initialize Firebase Admin SDK once
if not _apps:
    initialize_app()

@storage_fn.on_object_finalized(bucket="huddlely.firebasestorage.app")
def process_meetly_recording(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """Triggered when a file is uploaded to 'meetly-audio/' folder."""
    file_data = cloud_event.data
    file_path = file_data.name

    if not file_path.startswith("meetly-audio/"):
        return

    metadata = file_data.metadata or {}
    document_id = metadata.get("firestoreId")

    if not document_id:
        print(f"Skipping file without Firestore ID: {file_path}")
        return

    print(f"Processing Meetly file with Firestore ID: {document_id}")

    db = firestore.client()
    doc_ref = db.collection("meetingRecordings").document(document_id)

    temp_dir = tempfile.mkdtemp()
    temp_webm_path = os.path.join(temp_dir, "original.webm")
    temp_mp3_path = os.path.join(temp_dir, "converted.mp3")

    try:
        doc_ref.update({"status": "processing", "error": firestore.DELETE_FIELD})
        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        blob.download_to_filename(temp_webm_path)

        # --- Convert .webm to .mp3 ---
        ffmpeg_command = [
            "ffmpeg", "-y", "-i", temp_webm_path,
            "-vn", "-ab", "192k", "-ar", "44100", "-f", "mp3", temp_mp3_path
        ]
        subprocess.run(ffmpeg_command, check=True, capture_output=True)

        # --- Process the entire MP3 file directly ---
        results = process_with_gemini(temp_mp3_path)

        # --- Save results to Firestore ---
        doc_ref.update({
            "transcript": results.get("transcript"),
            "translatedTranscript": results.get("translated_transcript"),
            "summary": results.get("summary"),
            "status": "completed"
        })

        print(f"✅ Successfully processed: {file_path}")

    except Exception as e:
        print(f"❌ Error processing file {file_path}: {e}")
        try:
            doc_ref.update({"status": "failed", "error": str(e)})
        except Exception as cleanup_error:
            print(f"⚠️ Failed to mark document as failed: {cleanup_error}")
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


def process_with_gemini(audio_file_path: str) -> Dict[str, str]:
    """
    Transcribes, translates, and summarizes a single audio file using Gemini.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        raise ValueError("Gemini API key is not configured.")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("models/gemini-1.5-flash")
    
    print(f"Processing file with Gemini: {audio_file_path}")
    
    try:
        with open(audio_file_path, "rb") as audio_file:
            # Generate transcript by sending bytes directly
            print("Generating transcript...")
            transcript_response = model.generate_content([
                "Provide a clean and accurate transcript for this audio file.",
                {"mime_type": "audio/mp3", "data": audio_file.read()}
            ])
        transcript_text = transcript_response.text or ""
        
        if not transcript_text.strip():
            print("⚠️ No transcript generated.")
            return {"transcript": "", "translated_transcript": "", "summary": ""}

        # Generate translation
        print("Generating translation...")
        translation_response = model.generate_content([
            "Translate the following transcript into clear and accurate English.",
            transcript_text
        ])
        translated_text = translation_response.text or ""

        # Generate summary
        print("Generating summary...")
        summary_response = model.generate_content([
            "Based on the following meeting transcript, provide a comprehensive summary. "
            "Your response MUST be in markdown format and MUST ONLY use these three specific headings: "
            "### Key Discussion Points, ### Decisions Made, and ### Action Items. "
            "For each heading, provide 2-4 concise bullet points using the '*' character.",
            transcript_text
        ])
        summary_text = summary_response.text or ""

        return {
            "transcript": transcript_text,
            "translated_transcript": translated_text,
            "summary": summary_text
        }
    except Exception as e:
        print(f"⚠️ Gemini processing failed: {e}")
        raise e