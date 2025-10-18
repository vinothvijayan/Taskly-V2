import sys
import os

# Ensure the current directory is in the path
sys.path.append(os.path.dirname(__file__))

# Import functions from their respective files
from process_journal import process_journal_entry, exportJournalToPdf
from sales_tools import get_google_business_data
from meetly_processor import process_meetly_recording

# Export ALL functions so Firebase can discover them.
# This list is the single source of truth for what functions should be deployed.
__all__ = [
    'process_journal_entry',
    'exportJournalToPdf',
    'get_google_business_data',
    'process_meetly_recording',
]