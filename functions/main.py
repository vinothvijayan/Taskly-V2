import firebase_functions
from firebase_functions import https_fn, options, config
import firebase_admin
import requests
import re
from bs4 import BeautifulSoup
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize Firebase Admin SDK
firebase_admin.initialize_app()

# --- Google Business Extractor Logic ---

# Define the base URLs for the Google Places APIs
NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"

def get_lat_lng_from_location(location_name, api_key):
    params = {"key": api_key, "address": location_name}
    response = requests.get(GEOCODING_URL, params=params)
    if response.status_code == 200:
        data = response.json()
        if data.get("results"):
            location = data["results"][0]["geometry"]["location"]
            return f"{location['lat']},{location['lng']}"
    return None

def get_nearby_places(location, radius, place_type, api_key, keyword=None):
    all_places = []
    params = {"key": api_key, "location": location, "radius": radius, "type": place_type}
    if keyword:
        params["keyword"] = keyword

    while True:
        response = requests.get(NEARBY_SEARCH_URL, params=params)
        if response.status_code == 200:
            data = response.json()
            all_places.extend(data.get("results", []))
            next_page_token = data.get("next_page_token")
            if next_page_token:
                time.sleep(2)  # Google requires a short delay before fetching the next page
                params["pagetoken"] = next_page_token
            else:
                break
        else:
            logging.error(f"Nearby Search API error: {response.text}")
            break
    return all_places

def get_place_details(place_id, api_key):
    params = {
        "key": api_key,
        "place_id": place_id,
        "fields": "name,formatted_phone_number,vicinity,website,url"
    }
    response = requests.get(PLACE_DETAILS_URL, params=params)
    if response.status_code == 200:
        return response.json().get("result", {})
    return {}

@https_fn.on_call(cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"]))
def extract_google_business_data(req: https_fn.CallableRequest):
    try:
        api_key = config().google.places_api_key
    except Exception:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Google Places API key is not configured. Please set it in your Firebase environment."
        )

    location_name = req.data.get("location")
    place_type = req.data.get("placeType")
    keyword = req.data.get("keyword")

    if not location_name or not place_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing required fields: location and placeType."
        )

    lat_lng = get_lat_lng_from_location(location_name, api_key)
    if not lat_lng:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"Could not find coordinates for location: {location_name}"
        )

    places = get_nearby_places(lat_lng, 10000, place_type, api_key, keyword)
    unique_places = {place["place_id"]: place for place in places}.values()
    
    results = []
    for place in unique_places:
        details = get_place_details(place.get("place_id"), api_key)
        results.append({
            "name": details.get("name", "N/A"),
            "address": details.get("vicinity", "N/A"),
            "phone": details.get("formatted_phone_number", "N/A"),
            "website": details.get("website", "N/A"),
            "google_url": details.get("url", "N/A"),
        })
    
    return {"data": results}


# --- Email Extractor Logic ---

def extract_emails_from_html(html_content):
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    return list(set(re.findall(email_pattern, html_content)))

def fetch_website_content(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching URL {url}: {e}")
        return None

@https_fn.on_call(cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"]))
def extract_emails_from_urls(req: https_fn.CallableRequest):
    urls = req.data.get("urls")
    if not isinstance(urls, list):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Expected 'urls' to be a list."
        )

    results = {}
    for url in urls:
        if not url.startswith('http'):
            url = 'http://' + url
        
        logging.info(f"Processing URL: {url}")
        html_content = fetch_website_content(url)
        if html_content:
            emails = extract_emails_from_html(html_content)
            results[url] = emails
        else:
            results[url] = ["Failed to fetch"]
        time.sleep(0.5) # Be respectful to servers

    return {"data": results}