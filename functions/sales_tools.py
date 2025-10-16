import os
import re
import requests
from bs4 import BeautifulSoup
from firebase_functions import https_fn
from firebase_admin import initialize_app, _apps
from flask import Flask, request, jsonify

# Initialize Firebase Admin if not already initialized
if not _apps:
    initialize_app()

# Google Places API key from environment
API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY")

# -------------------------------
# Helper function to make JSON responses
# -------------------------------
def make_json_response(data, status=200):
    return jsonify(data), status

# -------------------------------
# /api/geocode
# -------------------------------
@https_fn.on_request(region="us-central1")
def geocode(request):
    if not API_KEY:
        return make_json_response({"error": "API key is not configured on the server."}, 500)

    data = request.get_json()
    location_name = data.get("locationName")
    if not location_name:
        return make_json_response({"error": "locationName is required"}, 400)

    params = {"key": API_KEY, "address": location_name}
    response = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
    return jsonify(response.json())

# -------------------------------
# /api/nearbysearch
# -------------------------------
@https_fn.on_request(region="us-central1")
def nearby_search(request):
    if not API_KEY:
        return make_json_response({"error": "API key is not configured on the server."}, 500)

    data = request.get_json()
    location = data.get("location")
    radius = data.get("radius", 10000)
    place_type = data.get("type")
    keyword = data.get("keyword")
    pagetoken = data.get("pagetoken")

    if not location or not place_type:
        return make_json_response({"error": "location and type are required"}, 400)

    params = {"key": API_KEY, "location": location, "radius": str(radius), "type": place_type}
    if keyword:
        params["keyword"] = keyword
    if pagetoken:
        params["pagetoken"] = pagetoken

    response = requests.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params=params)
    return jsonify(response.json())

# -------------------------------
# /api/placedetails
# -------------------------------
@https_fn.on_request(region="us-central1")
def place_details(request):
    if not API_KEY:
        return make_json_response({"error": "API key is not configured on the server."}, 500)

    data = request.get_json()
    place_id = data.get("placeId")
    if not place_id:
        return make_json_response({"error": "placeId is required"}, 400)

    params = {
        "key": API_KEY,
        "place_id": place_id,
        "fields": "name,formatted_phone_number,vicinity,website,url",
    }
    response = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params)
    return jsonify(response.json())

# -------------------------------
# /api/extract-emails
# -------------------------------
@https_fn.on_request(region="us-central1")
def extract_emails(request):
    data = request.get_json()
    url = data.get("url")
    if not url:
        return make_json_response({"error": "URL is required"}, 400)

    try:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        email_regex = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        emails = re.findall(email_regex, soup.get_text())
        unique_emails = sorted(list(set(emails)))

        return jsonify({"emails": unique_emails})

    except requests.exceptions.RequestException as e:
        return make_json_response({"error": f"Failed to fetch URL: {str(e)}"}, 500)
    except Exception as e:
        return make_json_response({"error": f"An error occurred: {str(e)}"}, 500)
