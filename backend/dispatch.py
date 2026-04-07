import math
from typing import Optional


def haversine(lat1, lng1, lat2, lng2) -> float:
    """Returns distance in kilometers between two lat/lng points."""
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def estimate_eta(distance_km: float, avg_speed_kmh: float = 40) -> int:
    """Returns ETA in minutes assuming average speed through city traffic."""
    return max(1, round((distance_km / avg_speed_kmh) * 60))


def find_nearest_driver(patient_lat: float, patient_lng: float, online_drivers: list) -> Optional[dict]:
    """
    Given patient coords and list of online driver dicts,
    returns the nearest driver with added 'distance_km' and 'eta_min' fields.
    """
    if not online_drivers:
        return None

    best = None
    best_dist = float("inf")

    for driver in online_drivers:
        if driver.get("status") != "online":
            continue
        dlat = driver.get("lat", 0)
        dlng = driver.get("lng", 0)
        if dlat == 0 and dlng == 0:
            continue
        dist = haversine(patient_lat, patient_lng, dlat, dlng)
        if dist < best_dist:
            best_dist = dist
            best = driver

    if best is None:
        return None

    best = dict(best)
    best["distance_km"] = round(best_dist, 2)
    best["eta_min"] = estimate_eta(best_dist)
    return best


def priority_score(sos_data: dict) -> int:
    """
    AI priority scoring based on multiple factors.
    Returns 1 (low) to 5 (critical).
    """
    score = 1
    keywords_critical = ["cardiac", "heart", "unconscious", "not breathing", "stroke", "bleeding"]
    keywords_high = ["accident", "crash", "fell", "injury", "pain", "diabetic"]

    message = str(sos_data.get("notes", "")).lower()
    for kw in keywords_critical:
        if kw in message:
            score = max(score, 5)
    for kw in keywords_high:
        if kw in message:
            score = max(score, 3)
    return score
