import sys
import os

sys.path.append(os.path.dirname(__file__))

# Import functions from your meetly file
from process_audio import process_audio_recording, reprocess_recording, get_recording_status

# Import the new function from your journal file
from process_journal import process_journal_entry, exportJournalToPdf

# Import the new sales tools functions
from sales_tools import geocode, nearby_search, place_details


# Export ALL functions so Firebase can discover them
__all__ = [
    'process_audio_recording',
    'reprocess_recording',
    'get_recording_status',
    'process_journal_entry',
    'exportJournalToPdf',
    # Add your new sales tools functions here
    'geocode',
    'nearby_search',
    'place_details',
]