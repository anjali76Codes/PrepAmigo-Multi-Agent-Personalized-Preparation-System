"""Flight search tools exposed to the flight specialist."""
import json
import re
from datetime import date as date_type

from langchain_core.tools import tool
from config import settings

LOCATION_PATTERN = re.compile(r"^[A-Za-z0-9 -]{2,12}$")


@tool
def search_flights(origin: str, destination: str, date: str) -> str:
    """Search flights between two cities on a given date (YYYY-MM-DD).
    Backed by SerpApi's Google Flights engine.
    """
    if not settings.serpapi_api_key:
        raise RuntimeError("SERPAPI_API_KEY is not configured")
    if not LOCATION_PATTERN.fullmatch(origin.strip()) or not LOCATION_PATTERN.fullmatch(destination.strip()):
        raise ValueError("Origin and destination must be short airport or city codes")
    try:
        travel_date = date_type.fromisoformat(date)
    except ValueError as exc:
        raise ValueError("date must use YYYY-MM-DD format") from exc
    if travel_date < date_type.today():
        raise ValueError("date must not be in the past")

    from serpapi import GoogleSearch

    params = {
        "engine": "google_flights",
        "departure_id": origin.strip().upper(),
        "arrival_id": destination.strip().upper(),
        "outbound_date": travel_date.isoformat(),
        "api_key": settings.serpapi_api_key,
    }
    try:
        results = GoogleSearch(params).get_dict()
    except Exception as exc:
        raise RuntimeError("Flight search provider unavailable") from exc
    if results.get("error"):
        raise RuntimeError("Flight search provider returned an error")
    flights = results.get("best_flights", []) or results.get("other_flights", [])
    if not flights:
        return json.dumps({"flights": [], "message": "No flights found for that route/date."})

    top = flights[:3]
    return json.dumps(
        {
            "flights": [
                {
                    "airline": f.get("flights", [{}])[0].get("airline", "Unknown"),
                    "price": f.get("price"),
                    "currency": f.get("currency", "unknown"),
                    "duration_minutes": f.get("total_duration"),
                }
                for f in top
            ]
        }
    )
