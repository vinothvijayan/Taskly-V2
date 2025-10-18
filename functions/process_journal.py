# functions/process_journal.py
import os
import tempfile
import time
import subprocess
from typing import Dict
from datetime import timedelta, datetime
import uuid
from urllib.parse import quote
import re

# --- SECURITY WARNING: Hardcoding API keys is dangerous. Use Secret Manager instead. ---
# Using a placeholder for the requested hardcoded key. 
# Replace with your actual key if you fully understand the security risks.
HARDCODED_GEMINI_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

# The top-level import is removed to fix the ModuleNotFoundError on startup.
# All imports are moved into the functions that use them.
# import google.generativeai as genai 

from firebase_admin import initialize_app, storage, firestore, _apps
# --- 1. ADD https_fn TO THIS IMPORT ---
from firebase_functions import storage_fn, https_fn 
from google.cloud.firestore_v1.base_query import FieldFilter

# It's OK to initialize the core app here.
if not _apps:
    initialize_app()

# ======================================================================================
#  EXISTING AUTOMATIC TRIGGER (REMOVED secrets parameter)
# ======================================================================================
@storage_fn.on_object_finalized(
    bucket="huddlely.firebasestorage.app",
    # Secrets parameter is removed because the key is now "hardcoded"
    # secrets=["GEMINI_API_KEY"] 
)
def process_journal_entry(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """
    Main function triggered by a new audio upload.
    This is a single, robust function that processes the individual file AND
    handles the aggregation to prevent race conditions.
    """
    print("--- process_journal_entry FINAL VERSION (V2 - No ID Filter) TRIGGERED ---")
    
    db = firestore.client()
    file_data = cloud_event.data
    file_path = file_data.name

    if not file_path.startswith("journal-audio/"):
        return

    metadata = file_data.metadata
    if not metadata or 'firestoreId' not in metadata:
        return
        
    document_id = metadata['firestoreId']
    doc_ref = db.collection('journalEntries').document(document_id)
    
    try:
        entry_doc = doc_ref.get()
        if not entry_doc.exists:
            raise ValueError(f"No matching journal document found for ID: {document_id}")
            
        doc_ref.update({'status': 'processing'})
        
        individual_results = process_single_audio_file(file_path)

        doc_ref.update({
            'transcript': individual_results.get('transcript'),
            'translatedTranscript': individual_results.get('translated_transcript'),
            'status': 'completed'
        })
        print(f"Successfully processed individual entry: {document_id}")

        entry_data = entry_doc.to_dict()
        user_id = entry_data.get("createdBy")
        journal_date = entry_data.get("journalDate")

        if not user_id or not journal_date:
            raise ValueError(f"Missing createdBy or journalDate in doc: {document_id}")

        entries_query = db.collection('journalEntries') \
            .where(filter=FieldFilter("createdBy", "==", user_id)) \
            .where(filter=FieldFilter("journalDate", "==", journal_date)) \
            .where(filter=FieldFilter("status", "==", "completed"))
        
        all_daily_entries = list(entries_query.stream())

        found_ids = {doc.id for doc in all_daily_entries}
        if document_id not in found_ids:
            print(f"Race condition detected. Manually adding current doc {document_id} to summary list.")
            current_entry_fresh = doc_ref.get()
            if current_entry_fresh.exists:
                all_daily_entries.append(current_entry_fresh)

        daily_summary_id = f"{user_id}_{journal_date}"
        daily_summary_ref = db.collection('dailySummaries').document(daily_summary_id)

        if not all_daily_entries:
            daily_summary_ref.delete()
            return

        all_daily_entries.sort(key=lambda doc: doc.to_dict().get("createdAt"))
        combined_transcript = "\n---\n".join([
            doc.to_dict().get("translatedTranscript", "") for doc in all_daily_entries
            if doc.to_dict().get("translatedTranscript")
        ])

        if not combined_transcript.strip():
            return

        aggregated_summary = get_wellness_analysis(combined_transcript)
        
        daily_summary_ref.set({
            'summary': aggregated_summary,
            'userId': user_id,
            'date': journal_date,
            'entryCount': len(all_daily_entries),
            'updatedAt': firestore.SERVER_TIMESTAMP
        }, merge=True)
        print(f"Successfully created/updated daily summary for {daily_summary_id}")

    except Exception as e:
        print(f"Error processing journal entry {document_id}: {e}")
        try:
            doc_ref.update({'status': 'failed', 'error': str(e)})
        except Exception as cleanup_error:
            print(f"Failed to mark document as failed: {cleanup_error}")

# ======================================================================================
#  NEW CALLABLE FUNCTION FOR PDF EXPORT (REMOVED secrets parameter)
# ======================================================================================
@https_fn.on_call(
    # Secrets parameter is removed because the key is now "hardcoded"
    # secrets=["GEMINI_API_KEY"]
)
def exportJournalToPdf(req: https_fn.CallableRequest) -> Dict:
    if not req.auth:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="Authentication required.")
    
    user_id = req.auth.uid
    start_date_str = req.data.get("startDate") # e.g., "2025-09-06"
    end_date_str = req.data.get("endDate")   # e.g., "2025-09-07"

    if not start_date_str or not end_date_str:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Start and end dates are required.")

    print(f"PDF export requested by user {user_id} for range {start_date_str} to {end_date_str}")
    
    try:
        db = firestore.client()
        
        # --- THIS IS THE FINAL, SIMPLIFIED QUERY ---
        # It no longer requires a complex composite index.
        entries_query = db.collection('journalEntries') \
            .where(filter=FieldFilter("createdBy", "==", user_id)) \
            .where(filter=FieldFilter("journalDate", ">=", start_date_str)) \
            .where(filter=FieldFilter("journalDate", "<=", end_date_str))
        # --- END OF QUERY CHANGE ---
        
        all_entries_docs = list(entries_query.stream())

        # Filter for 'completed' and sort in Python code
        completed_entries = [doc for doc in all_entries_docs if doc.to_dict().get("status") == "completed"]
        completed_entries.sort(key=lambda doc: doc.to_dict().get("createdAt"))

        if not completed_entries:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="No completed entries found in the selected date range.")

        # --- The rest of the function remains the same ---
        entries_by_date = {}
        for entry_doc in completed_entries:
            entry_data = entry_doc.to_dict()
            date_key = entry_data.get("journalDate")
            if date_key not in entries_by_date: entries_by_date[date_key] = []
            entries_by_date[date_key].append(entry_data)
        
        pdf_days_data = []
        for date_key, entries in sorted(entries_by_date.items()):
            combined_transcript = "\n---\n".join([e.get("translatedTranscript", "") for e in entries if e.get("translatedTranscript")])
            if combined_transcript.strip():
                detailed_summary = get_detailed_narrative(combined_transcript)
                pdf_days_data.append({
                    "date": date_key,
                    "detailedSummary": detailed_summary,
                    "entries": [e.get("translatedTranscript", "") for e in entries]
                })

        if not pdf_days_data:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="No content available to export.")

        from weasyprint import HTML
        html_content = create_html_for_pdf(pdf_days_data)
        pdf_bytes = HTML(string=html_content).write_pdf()

        bucket = storage.bucket()
        timestamp = int(time.time())
        file_name = f"journal_export_{timestamp}.pdf"
        export_path = f"journal-exports/{user_id}/{file_name}"
        blob = bucket.blob(export_path)
        blob.upload_from_string(pdf_bytes, content_type="application/pdf")

        # Attach a Firebase download token (so we don't need a private key)
        token = uuid.uuid4().hex
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.patch()  # persist metadata

        # Build the Firebase download URL (path must be URL-encoded)
        encoded_path = quote(export_path, safe="")
        download_url = (
            f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{encoded_path}"
            f"?alt=media&token={token}"
        )


        print(f"Successfully created PDF export for user {user_id}.")
        return {"status": "success", "downloadUrl": download_url}

    except Exception as e:
        print(f"Error during PDF export for user {user_id}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"An internal error occurred.")

# ======================================================================================
#  EXISTING & NEW HELPER FUNCTIONS (LAZY IMPORT + HARDCODED KEY)
# ======================================================================================
def process_single_audio_file(file_path: str) -> Dict[str, str]:
    # ... (This function remains unchanged)
    bucket = storage.bucket()
    temp_webm_path, temp_mp3_path = None, None
    try:
        blob = bucket.blob(file_path)
        _, temp_webm_path = tempfile.mkstemp(suffix=".webm")
        blob.download_to_filename(temp_webm_path)
        _, temp_mp3_path = tempfile.mkstemp(suffix=".mp3")
        ffmpeg_command = ["ffmpeg", "-y", "-i", temp_webm_path, "-vn", "-ab", "192k", "-ar", "44100", "-f", "mp3", temp_mp3_path]
        subprocess.run(ffmpeg_command, check=True, capture_output=True)
        return transcribe_and_translate_with_gemini(temp_mp3_path)
    finally:
        if temp_webm_path and os.path.exists(temp_webm_path): os.unlink(temp_webm_path)
        if temp_mp3_path and os.path.exists(temp_mp3_path): os.unlink(temp_mp3_path)


def transcribe_and_translate_with_gemini(audio_file_path: str) -> Dict[str, str]:
    # --- LAZY IMPORT TO FIX CRASH ---
    import google.generativeai as genai 
    
    # --- HARDCODED KEY ---
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    uploaded_file = None
    try:
        # --- FIX: Use a simple, unique name for the upload ---
        unique_display_name = f"journal_upload_{int(time.time())}"
        
        uploaded_file = genai.upload_file(
            path=audio_file_path, 
            display_name=unique_display_name, 
            mime_type="audio/mp3"
        )
        while uploaded_file.state.name == "PROCESSING": time.sleep(2); uploaded_file = genai.get_file(uploaded_file.name)
        if uploaded_file.state.name != "ACTIVE": raise ValueError("File processing failed on Gemini's servers.")
        model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
        transcript_res = model.generate_content(["Provide a clean and accurate transcript for this audio file.", uploaded_file])
        translation_res = model.generate_content(["Translate the following transcript into clear and accurate English...", transcript_res.text])
        return {'transcript': transcript_res.text, 'translated_transcript': translation_res.text}
    finally:
        if uploaded_file is not None: genai.delete_file(uploaded_file.name)


def get_wellness_analysis(full_transcript: str) -> str:
    # --- LAZY IMPORT TO FIX CRASH ---
    import google.generativeai as genai
    
    # --- HARDCODED KEY ---
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
    analysis_prompt = f"""
        You are Taskly's AI Wellness Coach. Your tone is supportive, insightful, and encouraging. You are speaking directly to the user.
        Analyze the user's combined journal entries for the day based on the following transcript.
        Your response MUST be in markdown format and MUST ONLY use the five specific headings below.
        For each heading, provide 2-3 concise bullet points using the '*' character.
        IMPORTANT: Do not comment on the quality, length, or fragmentation of the entries. Focus ONLY on the content the user provided. Speak in the second person (e.g., "You mentioned feeling...", "It seems you were focused on...", "Consider trying...").

        COMBINED TRANSCRIPTS:
        "{full_transcript}"

        ---

        ### Productivity & Focus
        ### Emotional Landscape
        ### Habit & Routine Patterns
        ### Core Insights
        ### Actionable Suggestions
    """
    analysis_response = model.generate_content(analysis_prompt)
    return analysis_response.text

# --- NEW HELPER FOR DETAILED NARRATIVE (LAZY IMPORT + HARDCODED KEY) ---
def get_detailed_narrative(full_transcript: str) -> str:
    # --- LAZY IMPORT TO FIX CRASH ---
    import google.generativeai as genai
    
    # --- HARDCODED KEY ---
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
    
    analysis_prompt = f"""
        You are an AI journaling assistant. Your task is to synthesize the following journal entries from a single day into a single, detailed, and cohesive narrative.
        Speak in the first person, as if the user is reflecting on their day.
        Weave together the events, feelings, and thoughts expressed in the entries into a comprehensive story of what happened. Be very detailed and convert it into paragraphs.

        COMBINED TRANSCRIPTS:
        "{full_transcript}"
    """
    
    analysis_response = model.generate_content(analysis_prompt)
    return analysis_response.text.replace("\n", "<br>")

# --- NEW HELPER FOR HTML GENERATION ---
def create_html_for_pdf(days_data) -> str:
    styles = """
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            body { font-family: 'Inter', sans-serif; color: #333333; line-height: 1.6; }
            .page { page-break-after: always; border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px;}
            .day-container { }
            h1 { color: #1a1a1a; text-align: center; font-size: 28px; margin-bottom: 40px; }
            h2 { font-size: 22px; color: #4a4a4a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 0;}
            h3 { font-size: 18px; color: #5a5a5a; margin-top: 30px; }
            p { font-size: 14px; }
            ul { padding-left: 20px; list-style-type: none; }
            li { font-size: 13px; margin-bottom: 10px; color: #666666; border-left: 3px solid #007bff; padding-left: 15px; background-color: #f9f9f9; padding-top: 5px; padding-bottom: 5px;}
        </style>
    """
    
    body_content = "<h1>Your Taskly Journal Export</h1>"
    
    for day in days_data:
        date_obj = datetime.strptime(day["date"], "%Y-%m-%d")
        formatted_date = date_obj.strftime("%A, %B %d, %Y")
        
        body_content += f"<div class='day-container page'><h2>{formatted_date}</h2>"
        body_content += f"<h3>AI-Generated Daily Narrative</h3><p>{day['detailedSummary']}</p>"
        body_content += "<h3>Original Entries (Translated)</h3><ul>"
        
        for entry_text in day['entries']:
            body_content += f"<li>{entry_text.replace(chr(10), '<br>')}</li>"
            
        body_content += "</ul></div>"
        
    return f"<!DOCTYPE html><html><head><title>Journal Export</title>{styles}</head><body>{body_content}</body></html>"