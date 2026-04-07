import uuid
import os
import json
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import (
    init_db, db_get_all_drivers, db_get_driver, db_get_driver_by_phone,
    db_upsert_driver, db_update_driver_location, db_update_driver_status,
    db_get_online_drivers, db_create_sos, db_assign_sos, db_complete_sos,
    db_get_pending_sos, db_get_all_sos, db_create_complaint,
    db_get_all_complaints, db_get_stats,
    db_get_nearest_hospital, db_get_all_hospitals
)
from dispatch import find_nearest_driver, priority_score
from models import (
    DriverRegister, DriverLocation, DriverStatus,
    SOSRequest, ComplaintCreate, AdminLogin, CompleteSOSRequest
)

# ─── Admin credentials ───────────────────────────────────────────────────────
ADMIN_USERNAME = "nexara_admin"
ADMIN_PASSWORD = "nexara@2025"

# ─── Socket.IO setup ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Map socket_id → driver_id for quick lookup
socket_to_driver = {}
driver_to_socket = {}


async def broadcast_drivers():
    """Send all drivers list to all connected clients."""
    drivers = db_get_all_drivers()
    await sio.emit("drivers_update", {"drivers": drivers})


async def try_auto_assign(driver_id: str):
    """When a driver comes online, check for pending SOS and auto-assign."""
    pending = db_get_pending_sos()
    if not pending:
        return
    driver = db_get_driver(driver_id)
    if not driver or driver["status"] != "online":
        return

    for sos in pending:
        online = db_get_online_drivers()
        nearest = find_nearest_driver(sos["lat"], sos["lng"], online)
        if nearest and nearest["id"] == driver_id:
            db_assign_sos(sos["id"], driver_id, nearest["eta_min"], nearest["distance_km"])
            db_update_driver_status(driver_id, "busy")
            # Notify everyone
            await sio.emit("sos_assigned", {
                "sos_id": sos["id"],
                "driver": nearest,
                "eta": nearest["eta_min"],
                "distance": nearest["distance_km"],
            })
            await broadcast_drivers()
            print(f"[AUTO-ASSIGN] SOS {sos['id']} → Driver {driver_id}")
            break


# ─── Socket.IO event handlers ─────────────────────────────────────────────────
@sio.event
async def connect(sid, environ):
    print(f"[WS] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    if sid in socket_to_driver:
        driver_id = socket_to_driver.pop(sid)
        driver_to_socket.pop(driver_id, None)
        db_update_driver_status(driver_id, "offline")
        await broadcast_drivers()
        print(f"[WS] Driver {driver_id} disconnected → offline")
    print(f"[WS] Client disconnected: {sid}")


@sio.event
async def driver_online(sid, data):
    driver_id = data.get("driver_id")
    if not driver_id:
        return
    socket_to_driver[sid] = driver_id
    driver_to_socket[driver_id] = sid
    db_update_driver_status(driver_id, "online")
    await broadcast_drivers()
    await try_auto_assign(driver_id)
    print(f"[WS] Driver {driver_id} is ONLINE")


@sio.event
async def driver_offline(sid, data):
    driver_id = data.get("driver_id")
    if driver_id:
        db_update_driver_status(driver_id, "offline")
        socket_to_driver.pop(sid, None)
        driver_to_socket.pop(driver_id, None)
        await broadcast_drivers()


@sio.event
async def driver_location(sid, data):
    driver_id = data.get("driver_id")
    lat = data.get("lat")
    lng = data.get("lng")
    if driver_id and lat and lng:
        db_update_driver_location(driver_id, lat, lng)
        await sio.emit("driver_moved", {"driver_id": driver_id, "lat": lat, "lng": lng})
        # ── FIX: try auto-assign after first location is received ──────────
        # This handles the race where driver goes "online" before GPS fires.
        driver = db_get_driver(driver_id)
        if driver and driver.get("status") == "online":
            await try_auto_assign(driver_id)


@sio.event
async def request_drivers(sid, data):
    drivers = db_get_all_drivers()
    await sio.emit("drivers_update", {"drivers": drivers}, to=sid)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("[NEXARA] Server started on http://localhost:8000")
    yield


# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="NEXARA Emergency Response API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST API Routes ──────────────────────────────────────────────────────────

# --- Drivers ---
@app.get("/api/drivers")
def get_drivers():
    return {"drivers": db_get_all_drivers()}


@app.get("/api/drivers/online")
def get_online_drivers():
    return {"drivers": db_get_online_drivers()}


@app.get("/api/drivers/{driver_id}")
def get_driver(driver_id: str):
    d = db_get_driver(driver_id)
    if not d:
        raise HTTPException(404, "Driver not found")
    return d


@app.post("/api/drivers/register")
async def register_driver(body: DriverRegister):
    existing = db_get_driver_by_phone(body.phone)
    if existing:
        # Return existing driver (auto-login)
        return {"driver": existing, "is_new": False}
    driver_id = "drv_" + str(uuid.uuid4())[:8]
    db_upsert_driver(driver_id, body.name, body.phone, body.vehicle_number, body.vehicle_type)
    driver = db_get_driver(driver_id)
    return {"driver": driver, "is_new": True}


@app.post("/api/drivers/location")
async def update_location(body: DriverLocation):
    db_update_driver_location(body.driver_id, body.lat, body.lng)
    await sio.emit("driver_moved", {"driver_id": body.driver_id, "lat": body.lat, "lng": body.lng})
    return {"ok": True}


@app.post("/api/drivers/status")
async def update_status(body: DriverStatus):
    if body.status not in ("online", "offline", "busy"):
        raise HTTPException(400, "Invalid status")
    db_update_driver_status(body.driver_id, body.status)
    await broadcast_drivers()
    if body.status == "online":
        await try_auto_assign(body.driver_id)
    return {"ok": True}


# --- SOS ---
@app.post("/api/sos")
async def create_sos(body: SOSRequest):
    priority = priority_score({"notes": ""})
    sos_id = db_create_sos(
        body.patient_name, body.patient_phone,
        body.lat, body.lng, body.address, priority
    )

    online = db_get_online_drivers()
    nearest = find_nearest_driver(body.lat, body.lng, online)

    result = {
        "sos_id": sos_id,
        "status": "pending",
        "driver": None,
        "eta": None,
        "distance": None,
    }

    if nearest:
        db_assign_sos(sos_id, nearest["id"], nearest["eta_min"], nearest["distance_km"])
        result["status"] = "assigned"
        result["driver"] = nearest
        result["eta"] = nearest["eta_min"]
        result["distance"] = nearest["distance_km"]
        await sio.emit("sos_assigned", {
            "sos_id": sos_id,
            "driver": nearest,
            "eta": nearest["eta_min"],
            "distance": nearest["distance_km"],
            "patient": {
                "name": body.patient_name,
                "phone": body.patient_phone,
                "lat": body.lat,
                "lng": body.lng,
                "address": body.address,
            }
        })
        await broadcast_drivers()
    else:
        # No driver online — store pending, will auto-assign
        await sio.emit("sos_pending", {
            "sos_id": sos_id,
            "message": "No drivers available. Your request is queued — help is on the way.",
            "patient": {
                "name": body.patient_name,
                "phone": body.patient_phone,
                "lat": body.lat,
                "lng": body.lng,
            }
        })

    # Broadcast to dispatch center
    all_sos = db_get_all_sos(50)
    await sio.emit("sos_list_update", {"sos_list": all_sos})
    return result


@app.post("/api/sos/complete")
async def complete_sos(body: CompleteSOSRequest):
    db_complete_sos(body.sos_id)
    await broadcast_drivers()
    all_sos = db_get_all_sos(50)
    await sio.emit("sos_list_update", {"sos_list": all_sos})
    return {"ok": True}


@app.get("/api/sos")
def get_sos_list():
    return {"sos_list": db_get_all_sos(100)}


# --- Hospitals ---
@app.get("/api/hospitals")
def get_hospitals():
    return {"hospitals": db_get_all_hospitals()}


@app.get("/api/hospitals/nearest")
async def get_nearest_hospital(lat: float, lng: float, google_api_key: str = None):
    """
    Returns nearest hospital.
    Priority:
    1. Google Places API  — if GOOGLE_MAPS_API_KEY env var OR ?google_api_key= is set
    2. Fallback           — local SQLite DB of seeded Bengaluru hospitals
    """
    import httpx

    api_key = google_api_key or os.environ.get("GOOGLE_MAPS_API_KEY", "")

    if api_key:
        try:
            url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            params = {
                "location": f"{lat},{lng}",
                "radius": 10000,
                "type": "hospital",
                "keyword": "emergency hospital",
                "key": api_key,
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, params=params)
            places = resp.json().get("results", [])

            if places:
                place = places[0]
                ploc = place["geometry"]["location"]
                p_lat, p_lng = ploc["lat"], ploc["lng"]
                from dispatch import haversine, estimate_eta
                dist = round(haversine(lat, lng, p_lat, p_lng), 2)
                eta = estimate_eta(dist)
                # Pull doctor details from our DB for the nearest local match
                db_hosp = db_get_nearest_hospital(lat, lng)
                doctors = db_hosp.get("doctors", []) if db_hosp else []
                return {
                    "id": place.get("place_id", ""),
                    "name": place.get("name", "—"),
                    "address": place.get("vicinity", "—"),
                    "phone": db_hosp.get("phone", "—") if db_hosp else "—",
                    "lat": p_lat,
                    "lng": p_lng,
                    "type": "Hospital",
                    "distance_km": dist,
                    "eta_min": eta,
                    "rating": place.get("rating"),
                    "open_now": place.get("opening_hours", {}).get("open_now"),
                    "doctors": doctors,
                    "source": "google_places",
                }
        except Exception as exc:
            print(f"[Google Places] Failed ({exc}), falling back to local DB")

    # ── Fallback: local seeded DB ─────────────────────────────────────────────
    hospital = db_get_nearest_hospital(lat, lng)
    if not hospital:
        raise HTTPException(404, "No hospitals found")
    hospital["source"] = "local_db"
    return hospital


# --- Complaints ---
@app.post("/api/complaints")
async def create_complaint(body: ComplaintCreate):
    cid = db_create_complaint(body.name, body.email, body.phone, body.message)
    return {"complaint_id": cid, "ok": True}


@app.get("/api/complaints")
def get_complaints():
    return {"complaints": db_get_all_complaints()}


# --- Admin ---
@app.post("/api/admin/login")
def admin_login(body: AdminLogin):
    if body.username == ADMIN_USERNAME and body.password == ADMIN_PASSWORD:
        return {"ok": True, "token": "nexara_admin_session_2025"}
    raise HTTPException(401, "Invalid credentials")


@app.get("/api/admin/stats")
def admin_stats():
    return db_get_stats()


@app.get("/api/admin/drivers")
def admin_drivers():
    return {"drivers": db_get_all_drivers()}


@app.get("/api/admin/sos")
def admin_sos():
    return {"sos_list": db_get_all_sos(500)}


@app.get("/api/admin/complaints")
def admin_complaints():
    return {"complaints": db_get_all_complaints()}


# ─── Static files (frontend) ──────────────────────────────────────────────────
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

if os.path.exists(frontend_path):
    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/{page}.html")
    def serve_page(page: str):
        fp = os.path.join(frontend_path, f"{page}.html")
        if os.path.exists(fp):
            return FileResponse(fp)
        raise HTTPException(404, "Page not found")

    # Mount static asset folders explicitly to avoid conflicts with socket.io ASGI wrapper
    css_path = os.path.join(frontend_path, "css")
    js_path  = os.path.join(frontend_path, "js")

    if os.path.isdir(css_path):
        app.mount("/css", StaticFiles(directory=css_path), name="css")
    if os.path.isdir(js_path):
        app.mount("/js", StaticFiles(directory=js_path), name="js")

    # Fallback mount for any other static assets (images, fonts, etc.)
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")


# ─── Combine FastAPI + Socket.IO ──────────────────────────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
