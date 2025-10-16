# functions/sales_tools.py
import os
from firebase_functions import https_fn
import requests

# --- SECURITY WARNING: Hardcoding API keys is dangerous. Use Secret Manager instead. ---
# Using a placeholder for the requested hardcoded key.
# Replace with your actual key if you fully understand the security risks.
GOOGLE_PLACES_API_KEY = "AIzaSyC6Hqk6_uxrL7UcHOb4d47ECw83JCJW7Uk"

@https_fn.on_call(
    cors=True
)
def get_google_business_data(req: https_fn.CallableRequest):
    """
    A callable function that acts as a secure proxy to the Google Places API.
    """
    location = req.data.get("location")
    place_type = req.data.get("place_type")
    keyword = req.data.get("keyword")

    if not location or not place_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing required parameters: location and place_type."
        )

    if not GOOGLE_PLACES_API_KEY or "AIza" not in GOOGLE_PLACES_API_KEY:
         raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="The Google Places API key is not configured correctly on the server. Please replace the placeholder key."
        )

    try:
        # 1. Get Lat/Lng from location name
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        geocode_params = {"address": location, "key": GOOGLE_PLACES_API_KEY}
        geocode_res = requests.get(geocode_url, params=geocode_params)
        geocode_res.raise_for_status()
        geocode_data = geocode_res.json()

        if geocode_data["status"] != "OK":
            error_message = geocode_data.get("error_message", f"Geocoding API failed with status: {geocode_data['status']}")
            print(f"Geocoding API Error: {error_message}")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Could not process location. Reason: {error_message}"
            )
        
        if not geocode_data.get("results"):
             raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Could not find coordinates for location: {location}"
            )
        
        lat_lng = geocode_data["results"][0]["geometry"]["location"]
        location_str = f"{lat_lng['lat']},{lat_lng['lng']}"

        # 2. Search for nearby places
        places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        places_params = {
            "location": location_str,
            "radius": "10000", # 10km radius
            "type": place_type,
            "key": GOOGLE_PLACES_API_KEY,
        }
        if keyword:
            places_params["keyword"] = keyword
        
        places_res = requests.get(places_url, params=places_params)
        places_res.raise_for_status()
        places_data = places_res.json()

        if places_data["status"] not in ["OK", "ZERO_RESULTS"]:
            error_message = places_data.get("error_message", f"Places API failed with status: {places_data['status']}")
            print(f"Places API Error: {error_message}")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message=f"Could not find places. Reason: {error_message}"
            )

        all_places = places_data.get("results", [])
        
        details_results = []
        for place in all_places:
            place_id = place.get("place_id")
            if not place_id:
                continue

            details_url = "https://maps.googleapis.com/maps/api/place/details/json"
            details_params = {
                "place_id": place_id,
                "fields": "name,formatted_phone_number,vicinity,website,url",
                "key": GOOGLE_PLACES_API_KEY,
            }
            details_res = requests.get(details_url, params=details_params)
            details_res.raise_for_status()
            details_data = details_res.json()

            if details_data["status"] == "OK":
                result = details_data.get("result", {})
                details_results.append({
                    "name": result.get("name", "N/A"),
                    "address": result.get("vicinity", "N/A"),
                    "phone": result.get("formatted_phone_number", "N/A"),
                    "website": result.get("website", "N/A"),
                    "google_url": result.get("url", "N/A"),
                })

        return {"status": "success", "data": details_results}

    except requests.exceptions.RequestException as e:
        print(f"HTTP Request failed: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An error occurred while communicating with Google's services."
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An unexpected server error occurred."
        )