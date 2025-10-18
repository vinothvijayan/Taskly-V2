import os
import tempfile
import time
import subprocess
from typing import Dict
import shutil

# Import Firebase and Google libraries
from firebase_admin import initialize_app, storage, firestore, _apps
from firebase_functions import storage_fn, options
import google.generativeai as genai

# --- SECURITY WARNING: Hardcoding API keys is dangerous for production apps. ---
# For development, replace "YOUR_GEMINI_API_KEY_HERE" with your actual key.
# For production, it is strongly recommended to use Firebase Secret Manager.
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"

# Set global options for the function
options.set_global_options(region="us-central1", max_instances=10, timeout_sec=540, memory=options.MemoryOption.GB_2)

# Initialize Firebase Admin SDK if not already done
if not _apps:
    initialize_app()

@storage_fn.on_object_finalized(
    bucket="huddlely.firebasestorage.app"
)
def process_meetly_recording(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """
    Triggered when a file is uploaded to 'meetly-audio/'.
    Downloads it, converts to mp3, splits into chunks if necessary,
    transcribes, translates, and summarizes using Gemini,
    then updates the corresponding Firestore document.
    """
    file_data = cloud_event.data
    file_path = file_data.name

    if not file_path.startswith("meetly-audio/"):
        return

    metadata = file_data.metadata
    if not metadata or 'firestoreId' not in metadata:
        return

    document_id = metadata['firestoreId']
    print(f"Processing Meetly file with Firestore ID: {document_id}")

    db = firestore.client()
    doc_ref = db.collection('meetingRecordings').document(document_id)

    temp_dir = tempfile.mkdtemp()
    temp_webm_path = os.path.join(temp_dir, "original.webm")
    temp_mp3_path = os.path.join(temp_dir, "converted.mp3")

    try:
        doc_ref.update({'status': 'processing'})
        bucket = storage.bucket()
        blob = bucket.blob(file_path)
        blob.download_to_filename(temp_webm_path)

        ffmpeg_command = [
            "ffmpeg", "-y", "-i", temp_webm_path,
            "-vn", "-ab", "192k", "-ar", "44100", "-f", "mp3", temp_mp3_path
        ]
        subprocess.run(ffmpeg_command, check=True, capture_output=True)

        chunk_dir = os.path.join(temp_dir, "chunks")
        os.makedirs(chunk_dir)
        chunk_paths = split_audio(temp_mp3_path, chunk_dir)

        results = process_with_gemini(chunk_paths)

        doc_ref.update({
            'transcript': results.get('transcript'),
            'translatedTranscript': results.get('translated_transcript'),
            'summary': results.get('summary'),
            'status': 'completed'
        })
        print(f"Successfully processed: {file_path}")

    except Exception as e:
        if isinstance(e, subprocess.CalledProcessError):
            print(f"--- FFMPEG FAILED ---\nSTDERR: {e.stderr.decode()}")
        print(f"Error processing file {file_path}: {e}")
        try:
            doc_ref.update({'status': 'failed', 'error': str(e)})
        except Exception as cleanup_error:
            print(f"Failed to mark document as failed: {cleanup_error}")
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def split_audio(mp3_path: str, output_dir: str) -> list[str]:
    """Splits an MP3 file into 50-minute chunks using ffmpeg."""
    print("Splitting audio file...")
    segment_time_seconds = 50 * 60
    ffmpeg_command = [
        "ffmpeg", "-i", mp3_path,
        "-f", "segment",
        "-segment_time", str(segment_time_seconds),
        "-c", "copy",
        os.path.join(output_dir, "chunk_%03d.mp3")
    ]
    try:
        subprocess.run(ffmpeg_command, check=True, capture_output=True)
    except subprocess.CalledProcessError:
        return [mp3_path]
    
    chunk_files = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir)])
    print(f"Split into {len(chunk_files)} chunks.")
    return chunk_files

def process_with_gemini(audio_chunk_paths: list[str]) -> Dict[str, str]:
    """
    Processes audio chunks with Gemini, combines transcripts, and then
    translates and summarizes the full text.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        raise ValueError("Gemini API key is not configured in functions/meetly_processor.py")
    
    genai.configure(api_key=GEMINI_API_KEY)

    all_transcripts = []
    
    for i, chunk_path in enumerate(audio_chunk_paths):
        print(f"Processing chunk {i+1}/{len(audio_chunk_paths)}...")
        uploaded_file = None
        try:
            unique_name = f"meetly_chunk_{i}_{int(time.time())}"
            uploaded_file = genai.upload_file(path=chunk_path, display_name=unique_name, mime_type="audio/mp3")
            
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(5)
                uploaded_file = genai.get_file(uploaded_file.name)
            
            if uploaded_file.state.name != "ACTIVE":
                raise ValueError(f"Chunk processing failed on Gemini's servers: {uploaded_file.state.name}")

            model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            transcript_response = model.generate_content([
                "Provide a clean and accurate transcript for this audio file.",
                uploaded_file
            ])
            all_transcripts.append(transcript_response.text)
        finally:
            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                except Exception as e:
                    print(f"Warning: couldn't delete uploaded chunk file on Gemini: {e}")

    full_transcript = "\n\n".join(all_transcripts)
    
    if not full_transcript.strip():
        return {"transcript": "", "translated_transcript": "", "summary": ""}

    model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')

    translation_response = model.generate_content([
        "Translate the following transcript into clear and accurate English.",
        full_transcript
    ])
    translated_text = translation_response.text

    summary_response = model.generate_content([
        "Based on the following meeting transcript, provide a comprehensive summary. Identify key discussion points, decisions made, and any action items.",
        full_transcript
    ])
    summary_text = summary_response.text

    return {
        "transcript": full_transcript,
        "translated_transcript": translated_text,
        "summary": summary_text
    }