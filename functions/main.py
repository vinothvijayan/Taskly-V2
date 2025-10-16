import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from firebase_functions import https_fn
from firebase_admin import initialize_app

# Initialize Firebase Admin SDK
initialize_app()

app = Flask(__name__)
# Allow requests from any origin. For production, you might want to restrict this
# to your app's specific domain.
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- Google Places API Configuration ---
# IMPORTANT: You must set this environment variable in your Firebase project.
# Run this command in your terminal:
# firebase functions:config:set google.places_api_key="YOUR_API_KEY_HERE"
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

# --- Firebase Cloud Function Entry Point ---

@https_fn.on_request(region="us-central1")
def extract_google_business_data(req: https_fn.Request) -> https_fn.Response:
    """Firebase Function to handle all proxied Google Places API requests."""
    with app.request_context(req.environ):
        return app.full_dispatch_request()