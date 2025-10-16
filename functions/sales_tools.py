import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from firebase_functions import https_fn
from firebase_admin import initialize_app, _apps

# It's OK to initialize the core app here if not already done.
if not _apps:
    initialize_app()

app = Flask(__name__)
# Allow requests from any origin for development.
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- Google Places API Configuration ---
# IMPORTANT: You must set this environment variable in your Firebase project.
# See instructions after the code blocks.
API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY")

# --- API Endpoints ---

@app.route('/api/geocode', methods=['POST'])
def geocode():
    if not API_KEY:
        return jsonify({"error": "API key is not configured on the server."}), 500
    
    data = request.get_json()
    location_name = data.get('locationName')
    if not location_name:
        return jsonify({"error": "locationName is required"}), 400

    params = {'key': API_KEY, 'address': location_name}
    response = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
    return jsonify(response.json())

@app.route('/api/nearbysearch', methods=['POST'])
def nearby_search():
    if not API_KEY:
        return jsonify({"error": "API key is not configured on the server."}), 500
        
    data = request.get_json()
    location = data.get('location')
    radius = data.get('radius', 10000)
    place_type = data.get('type')
    keyword = data.get('keyword')
    pagetoken = data.get('pagetoken')

    if not location or not place_type:
        return jsonify({"error": "location and type are required"}), 400

    params = {'key': API_KEY, 'location': location, 'radius': str(radius), 'type': place_type}
    if keyword:
        params['keyword'] = keyword
    if pagetoken:
        params['pagetoken'] = pagetoken
        
    response = requests.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params=params)
    return jsonify(response.json())

@app.route('/api/placedetails', methods=['POST'])
def place_details():
    if not API_KEY:
        return jsonify({"error": "API key is not configured on the server."}), 500
        
    data = request.get_json()
    place_id = data.get('placeId')
    if not place_id:
        return jsonify({"error": "placeId is required"}), 400

    params = {
        'key': API_KEY,
        'place_id': place_id,
        'fields': "name,formatted_phone_number,vicinity,website,url"
    }
    response = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params)
    return jsonify(response.json())

@app.route('/api/extract-emails', methods=['POST'])
def extract_emails():
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        # Add http:// if no scheme is present
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an exception for bad status codes
        
        # Use BeautifulSoup to parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find emails using a regular expression
        email_regex = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_regex, soup.get_text())
        
        # Return unique emails
        unique_emails = sorted(list(set(emails)))
        
        return jsonify({"emails": unique_emails})
        
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch URL: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# This function will be exported from main.py and named to avoid conflicts
sales_tools_proxy = https_fn.on_request(region="us-central1")(app)