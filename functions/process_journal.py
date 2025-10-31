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
HARDCODED_GEMINI_API_KEY = "AIzaSyCugeQ0xzwciuQcWwIH14YB54EqVXgTX1Q"

from firebase_admin import initialize_app, storage, firestore, _apps
from firebase_functions import storage_fn, https_fn 
from google.cloud.firestore_v1.base_query import FieldFilter

if not _apps:
    initialize_app()

@storage_fn.on_object_finalized(bucket="huddlely.firebasestorage.app")
def process_journal_entry(cloud_event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    """
    Main function triggered by a new audio upload.
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

@https_fn.on_call()
def exportJournalToPdf(req: https_fn.CallableRequest) -> Dict:
    if not req.auth:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="Authentication required.")
    
    user_id = req.auth.uid
    start_date_str = req.data.get("startDate")
    end_date_str = req.data.get("endDate")

    if not start_date_str or not end_date_str:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Start and end dates are required.")

    print(f"PDF export requested by user {user_id} for range {start_date_str} to {end_date_str}")
    
    try:
        # --- LAZY IMPORT ---
        # This prevents the weasyprint library from causing deployment failures
        # for other functions if its system dependencies are not met.
        from weasyprint import HTML

        db = firestore.client()
        
        entries_query = db.collection('journalEntries') \
            .where(filter=FieldFilter("createdBy", "==", user_id)) \
            .where(filter=FieldFilter("journalDate", ">=", start_date_str)) \
            .where(filter=FieldFilter("journalDate", "<=", end_date_str))
        
        all_entries_docs = list(entries_query.stream())

        completed_entries = [doc for doc in all_entries_docs if doc.to_dict().get("status") == "completed"]
        completed_entries.sort(key=lambda doc: doc.to_dict().get("createdAt"))

        if not completed_entries:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="No completed entries found in the selected date range.")

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

        html_content = create_html_for_pdf(pdf_days_data)
        pdf_bytes = HTML(string=html_content).write_pdf()

        bucket = storage.bucket()
        timestamp = int(time.time())
        file_name = f"journal_export_{timestamp}.pdf"
        export_path = f"journal-exports/{user_id}/{file_name}"
        blob = bucket.blob(export_path)
        blob.upload_from_string(pdf_bytes, content_type="application/pdf")

        token = uuid.uuid4().hex
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.patch()

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

def process_single_audio_file(file_path: str) -> Dict[str, str]:
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
    import google.generativeai as genai 
    
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name='models/gemini-2.5-flash')
    
    try:
        with open(audio_file_path, "rb") as audio_file:
            audio_bytes = audio_file.read()
        
        transcript_res = model.generate_content([
            "Provide a clean and accurate transcript for this audio file.",
            {"mime_type": "audio/mp3", "data": audio_bytes}
        ])
        
        translation_res = model.generate_content([
            "Translate the following transcript into clear and accurate English...",
            transcript_res.text
        ])
        
        return {'transcript': transcript_res.text, 'translated_transcript': translation_res.text}
    except Exception as e:
        print(f"Error in Gemini processing: {e}")
        raise

def get_wellness_analysis(full_transcript: str) -> str:
    import google.generativeai as genai
    
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name='models/gemini-2.5-flash')
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

def get_detailed_narrative(full_transcript: str) -> str:
    import google.generativeai as genai
    
    if not HARDCODED_GEMINI_API_KEY:
        raise ValueError("API key is missing.")

    genai.configure(api_key=HARDCODED_GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name='models/gemini-2.5-flash')
    
    analysis_prompt = f"""
        You are an AI journaling assistant. Your task is to synthesize the following journal entries from a single day into a single, detailed, and cohesive narrative.
        Speak in the first person, as if the user is reflecting on their day.
        Weave together the events, feelings, and thoughts expressed in the entries into a comprehensive story of what happened. Be very detailed and convert it into paragraphs.

        COMBINED TRANSCRIPTS:
        "{full_transcript}"
    """
    
    analysis_response = model.generate_content(analysis_prompt)
    return analysis_response.text.replace("\n", "<br>")

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