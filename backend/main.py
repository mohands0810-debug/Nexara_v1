import uuid
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ✅ FIXED IMPORTS
from backend.database import (
    init_db, db_get_all_drivers, db_get_driver, db_get_driver_by_phone,
    db_upsert_driver, db_update_driver_location, db_update_driver_status,
    db_get_online_drivers, db_create_sos, db_assign_sos, db_complete_sos,
    db_get_pending_sos, db_get_all_sos, db_create_complaint,
    db_get_all_complaints, db_get_stats,
    db_get_nearest_hospital, db_get_all_hospitals
)
from backend.dispatch import find_nearest_driver, priority_score
from backend.models import (
    DriverRegister, DriverLocation, DriverStatus,
    SOSRequest, ComplaintCreate, AdminLogin, CompleteSOSRequest
)

ADMIN_USERNAME = "nexara_admin"
ADMIN_PASSWORD = "nexara@2025"

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

socket_to_driver = {}
driver_to_socket = {}

async def broadcast_drivers():
    drivers = db_get_all_drivers()
    await sio.emit("drivers_update", {"drivers": drivers})

async def try_auto_assign(driver_id: str):
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
            await sio.emit("sos_assigned", {
                "sos_id": sos["id"],
                "driver": nearest,
            })
            await broadcast_drivers()
            break

@sio.event
async def connect(sid, environ):
    print(f"[WS] Connected: {sid}")

@sio.event
async def disconnect(sid):
    if sid in socket_to_driver:
        driver_id = socket_to_driver.pop(sid)
        driver_to_socket.pop(driver_id, None)
        db_update_driver_status(driver_id, "offline")
        await broadcast_drivers()

@sio.event
async def driver_online(sid, data):
    driver_id = data.get("driver_id")
    socket_to_driver[sid] = driver_id
    driver_to_socket[driver_id] = sid
    db_update_driver_status(driver_id, "online")
    await broadcast_drivers()
    await try_auto_assign(driver_id)

@sio.event
async def driver_location(sid, data):
    driver_id = data.get("driver_id")
    lat = data.get("lat")
    lng = data.get("lng")
    if driver_id and lat and lng:
        db_update_driver_location(driver_id, lat, lng)
        await sio.emit("driver_moved", {"driver_id": driver_id, "lat": lat, "lng": lng})

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Server started")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/drivers")
def get_drivers():
    return {"drivers": db_get_all_drivers()}

@app.post("/api/drivers/register")
async def register_driver(body: DriverRegister):
    existing = db_get_driver_by_phone(body.phone)
    if existing:
        return {"driver": existing}
    driver_id = "drv_" + str(uuid.uuid4())[:8]
    db_upsert_driver(driver_id, body.name, body.phone, body.vehicle_number, body.vehicle_type)
    return {"driver": db_get_driver(driver_id)}

@app.post("/api/sos")
async def create_sos(body: SOSRequest):
    sos_id = db_create_sos(body.patient_name, body.patient_phone, body.lat, body.lng, body.address, 1)
    return {"sos_id": sos_id}

# Static files
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

if os.path.exists(frontend_path):
    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# ✅ FIXED START
import uvicorn

PORT = int(os.environ.get("PORT", 10000))

if __name__ == "__main__":
    uvicorn.run("backend.main:socket_app", host="0.0.0.0", port=PORT)