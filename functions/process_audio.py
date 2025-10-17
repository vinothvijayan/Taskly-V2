import os
import tempfile
import time
import subprocess
from typing import Dict, Any
import shutil

# --- NEW: Import options for setting resources ---
from firebase_functions import options

# --- SECURITY WARNING: Hardcoding API keys is dangerous. ---
HARDCODED_GEMINI_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

from firebase_admin import initialize_app, storage, firestore, _apps
from firebase_functions import storage_fn
from google.cloud import storage as gcs

# --- NEW: Set global options for all functions in this file ---
# This increases the timeout to the maximum 9 minutes and allocates more memory
# to handle large file processing.
options.set_global_options(region="us-central1", max_instances=5, timeout_sec=540, memory=options.MemoryOption.GB_2)

@storage_fn.on_object_finalized(
    bucket="huddlely.firebasestorage.app"
)
def process_audio_recording(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """
    Triggered when a file is uploaded to 'meetly-audio/'.
    Downloads it, converts to mp3, SPLITS into chunks if necessary, 
    transcribes + translates + summarizes using Gemini,
    then updates the corresponding Firestore document.
    """
    file_data = cloud_event.data
    file_path = file_data.name

    if not file_path.startswith("meetly-audio/"):
        print(f"Ignoring file, not in 'meetly-audio/' folder: {file_path}")
        return

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
    chunk_dir = None # NEW: For cleaning up chunks

    try:
        if not doc_ref.get().exists:
            raise ValueError(f"No matching recording document found for ID: {document_id}")

        doc_ref.update({'status': 'processing'})

        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        _, temp_webm_path = tempfile.mkstemp(suffix=".webm")
        blob.download_to_filename(temp_webm_path)

        _, temp_mp3_path = tempfile.mkstemp(suffix=".mp3")
        ffmpeg_command = [
            "ffmpeg", "-y", "-i", temp_webm_path,
            "-vn", "-ab", "192k", "-ar", "44100", "-f", "mp3", temp_mp3_path
        ]
        subprocess.run(ffmpeg_command, check=True, capture_output=True)

        # --- NEW: Split the audio into chunks to handle long files ---
        chunk_dir = tempfile.mkdtemp()
        chunk_paths = split_audio(temp_mp3_path, chunk_dir)

        # Process audio chunks with Gemini
        results = process_meeting_with_gemini(chunk_paths, os.path.basename(file_path))

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
        # --- UPDATED: Cleanup all temporary files and directories ---
        if temp_webm_path and os.path.exists(temp_webm_path):
            os.unlink(temp_webm_path)
        if temp_mp3_path and os.path.exists(temp_mp3_path):
            os.unlink(temp_mp3_path)
        if chunk_dir and os.path.exists(chunk_dir):
            shutil.rmtree(chunk_dir)

# --- NEW HELPER FUNCTION ---
def split_audio(mp3_path: str, output_dir: str) -> list[str]:
    """Splits an MP3 file into 50-minute chunks using ffmpeg."""
    print("Splitting audio file into chunks...")
    segment_time_seconds = 50 * 60  # 50 minutes, safely under Gemini's 1-hour limit
    ffmpeg_command = [
        "ffmpeg", "-i", mp3_path,
        "-f", "segment",
        "-segment_time", str(segment_time_seconds),
        "-c", "copy",
        os.path.join(output_dir, "chunk_%03d.mp3")
    ]
    try:
        subprocess.run(ffmpeg_command, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        # If splitting fails, it might be a short file. Just use the original.
        print(f"Audio splitting failed (likely a short file): {e.stderr.decode()}. Using original file.")
        return [mp3_path]
    
    chunk_files = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir)])
    
    if not chunk_files:
        print("No chunks were created, using original file.")
        return [mp3_path]

    print(f"Split into {len(chunk_files)} chunks.")
    return chunk_files

# --- REFACTORED GEMINI PROCESSING FUNCTION ---
def process_meeting_with_gemini(audio_chunk_paths: list[str], display_name: str) -> Dict[str, str]:
    """
    Processes multiple audio chunks with Gemini, combines transcripts,
    and then translates and summarizes the full text.
    """
    import google.generativeai as genai
    
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing.")
    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)

    all_transcripts = []
    
    for i, chunk_path in enumerate(audio_chunk_paths):
        print(f"Processing chunk {i+1}/{len(audio_chunk_paths)} for '{display_name}'...")
        uploaded_file = None
        try:
            # Upload chunk
            uploaded_file = genai.upload_file(
                path=chunk_path, 
                display_name=f"chunk_{i}_{display_name}", 
                mime_type="audio/mp3"
            )
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(5) # Increased sleep time for larger files
                uploaded_file = genai.get_file(uploaded_file.name)
            if uploaded_file.state.name != "ACTIVE":
                raise ValueError(f"Chunk processing failed on Gemini's servers with state: {uploaded_file.state.name}")

            # Transcribe chunk
            model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            transcript_response = model.generate_content([
                "Please provide a clean and accurate transcript for this audio file.",
                uploaded_file
            ])
            all_transcripts.append(transcript_response.text)
            print(f"Chunk {i+1} transcribed successfully.")

        finally:
            # Cleanup uploaded file on Gemini immediately
            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                except Exception as e:
                    print(f"Warning: couldn't delete uploaded chunk file on Gemini: {e}")

    # Combine all transcripts
    full_transcript_text = "\n\n".join(all_transcripts)
    
    if not full_transcript_text.strip():
        print("Warning: Full transcript is empty after processing all chunks.")
        return {"transcript": "", "translated_transcript": "", "summary": ""}

    # Now, perform translation and summary on the full text
    model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')

    print("Generating English translation for full meeting...")
    translation_response = model.generate_content([
        "Translate the following transcript into clear and accurate English.",
        full_transcript_text
    ])
    translated_text = translation_response.text

    print("Generating meeting summary for full meeting...")
    summary_response = model.generate_content([
        "Based on the following meeting transcript, provide a comprehensive summary in bullet points.",
        full_transcript_text
    ])
    summary_text = summary_response.text

    return {
        "transcript": full_transcript_text,
        "translated_transcript": translated_text,
        "summary": summary_text
    }


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