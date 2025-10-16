import os
import re
import requests
from bs4 import BeautifulSoup
from firebase_functions import https_fn
from firebase_admin import initialize_app, _apps
from flask import jsonify

# Initialize Firebase Admin if not already initialized
if not _apps:
    initialize_app()

# Google Places API key from environment
API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY")

# --- CORS Helper ---
# A centralized place to define headers for consistency
def _build_cors_preflight_response():
    """Handles CORS preflight OPTIONS requests."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
    }
    return ("", 204, headers)

def _build_cors_main_response(response):
    """Adds the required CORS header to a main response."""
    response.headers.set("Access-Control-Allow-Origin", "*")
    return response

# -------------------------------
# /api/geocode
# -------------------------------
@https_fn.on_request(region="us-central1")
def geocode(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if not API_KEY:
        return _build_cors_main_response(jsonify({"error": "API key is not configured on the server."}))

    data = request.get_json()
    location_name = data.get("locationName")
    if not location_name:
        return _build_cors_main_response(jsonify({"error": "locationName is required"}))

    params = {"key": API_KEY, "address": location_name}
    response = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
    return _build_cors_main_response(jsonify(response.json()))

# -------------------------------
# /api/nearbysearch
# -------------------------------
@https_fn.on_request(region="us-central1")
def nearby_search(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if not API_KEY:
        return _build_cors_main_response(jsonify({"error": "API key is not configured on the server."}))

    data = request.get_json()
    location = data.get("location")
    radius = data.get("radius", 10000)
    place_type = data.get("type")
    keyword = data.get("keyword")
    pagetoken = data.get("pagetoken")

    if not location or not place_type:
        return _build_cors_main_response(jsonify({"error": "location and type are required"}))

    params = {"key": API_KEY, "location": location, "radius": str(radius), "type": place_type}
    if keyword:
        params["keyword"] = keyword
    if pagetoken:
        params["pagetoken"] = pagetoken

    response = requests.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params=params)
    return _build_cors_main_response(jsonify(response.json()))

# -------------------------------
# /api/placedetails
# -------------------------------
@https_fn.on_request(region="us-central1")
def place_details(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

    if not API_KEY:
        return _build_cors_main_response(jsonify({"error": "API key is not configured on the server."}))

    data = request.get_json()
    place_id = data.get("placeId")
    if not place_id:
        return _build_cors_main_response(jsonify({"error": "placeId is required"}))

    params = {
        "key": API_KEY,
        "place_id": place_id,
        "fields": "name,formatted_phone_number,vicinity,website,url",
    }
    response = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params)
    return _build_cors_main_response(jsonify(response.json()))