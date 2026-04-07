# 🚑 NEXARA — Next-Gen Emergency Ambulance Dispatch System

> **"Every Second Is Sacred"**
> AI-powered, real-time, location-intelligent emergency response platform.

---

## 🎨 Brand Identity
| Item | Value |
|------|-------|
| **Name** | NEXARA |
| **Tagline** | Every Second Is Sacred |
| **Primary** | `#00f5ff` (Neon Cyan) |
| **Emergency** | `#ff2d55` (Alert Red) |
| **Success** | `#00ff88` (Life Green) |
| **Accent** | `#a855f7` (Tech Purple) |
| **Background** | `#05050f` (Deep Void) |
| **Font Display** | Orbitron |
| **Font Body** | Rajdhani |

---

## 🏗️ Project Structure

```
nexara/
├── backend/
│   ├── main.py              # FastAPI + Socket.IO server
│   ├── database.py          # SQLite helpers
│   ├── dispatch.py          # Haversine distance + auto-assign
│   ├── models.py            # Pydantic request models
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Landing page
│   ├── patient.html         # Emergency SOS portal
│   ├── driver.html          # Driver dashboard
│   ├── admin.html           # Admin control panel
│   ├── dispatch.html        # Dispatcher command center
│   ├── css/
│   │   ├── styles.css       # Global design system
│   │   ├── landing.css
│   │   ├── patient.css
│   │   ├── driver.css
│   │   └── admin.css
│   └── js/
│       ├── app.js           # Utilities, map factory, toast
│       ├── socket.js        # Socket.IO client wrapper
│       ├── landing.js
│       ├── patient.js       # SOS, voice, GPS, countdown
│       ├── driver.js        # GPS tracking, status, assignment
│       ├── admin.js         # Charts, tables, auth
│       ├── dispatch.js      # Live map, SOS queue
│       └── chatbot.js       # ARIA AI assistant (Claude API)
└── README.md
```

---

## ⚡ Quick Start

### 1. Prerequisites
```bash
Python 3.10+  (python --version)
pip           (pip --version)
```

### 2. Install Dependencies
```bash
cd nexara/backend
pip install -r requirements.txt
```

### 3. Run Server
```bash
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

### 4. Open in Browser
```
http://localhost:8000/           → Landing page
http://localhost:8000/patient.html  → Patient SOS
http://localhost:8000/driver.html   → Driver portal
http://localhost:8000/dispatch.html → Dispatch center
http://localhost:8000/admin.html    → Admin panel
```

---

## 🔐 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `nexara_admin` | `nexara@2025` |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/drivers/register` | Register or auto-login a driver |
| `GET`  | `/api/drivers` | List all drivers |
| `GET`  | `/api/drivers/online` | Online drivers only |
| `POST` | `/api/drivers/status` | Update driver status |
| `POST` | `/api/drivers/location` | Update GPS position |
| `POST` | `/api/sos` | Send emergency SOS |
| `POST` | `/api/sos/complete` | Mark SOS as completed |
| `GET`  | `/api/sos` | SOS history |
| `POST` | `/api/complaints` | Submit complaint |
| `GET`  | `/api/complaints` | List all complaints (admin) |
| `POST` | `/api/admin/login` | Admin authentication |
| `GET`  | `/api/admin/stats` | Dashboard metrics |

---

## 📡 WebSocket Events

| Event (Client→Server) | Description |
|----------------------|-------------|
| `driver_online` | Driver goes online |
| `driver_offline` | Driver goes offline |
| `driver_location` | GPS position update |
| `request_drivers` | Request full drivers list |

| Event (Server→Client) | Description |
|----------------------|-------------|
| `drivers_update` | Full driver list refresh |
| `driver_moved` | Single driver position update |
| `sos_assigned` | SOS assigned to driver |
| `sos_pending` | SOS queued, no drivers |
| `sos_list_update` | Updated SOS list |

---

## 🧠 Smart Dispatch Logic

1. Patient sends SOS with GPS coordinates
2. Server fetches all **online** drivers from database
3. **Haversine formula** calculates distance to each driver
4. Nearest driver is selected and assigned atomically
5. Driver status set to `busy`, preventing double-dispatch
6. All clients notified via Socket.IO broadcast
7. If **no drivers online** → SOS stored as `pending`
8. When any driver connects → pending SOS auto-checked and assigned

---

## 🚀 Deployment

### Production (Recommended: Render / Railway / VPS)
```bash
# Install
pip install -r requirements.txt

# Run with gunicorn
pip install gunicorn
gunicorn main:socket_app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

> **Note:** Use `-w 1` (single worker) to ensure all clients share the same in-memory state for Socket.IO. For multi-worker, add Redis adapter.

### Environment Variables (optional)
```bash
PORT=8000                    # Server port
ADMIN_USERNAME=nexara_admin  # Override admin username
ADMIN_PASSWORD=nexara@2025   # Override admin password
```

---

## ✨ Features Summary

| Feature | Status |
|---------|--------|
| 🚨 One-tap SOS with 10s cancel window | ✅ |
| 🎙️ Voice SOS trigger ("emergency"/"help") | ✅ |
| 🔊 Emergency siren sound on SOS | ✅ |
| 📞 Direct call links (tel:) patient ↔ driver | ✅ |
| 🗺️ Live map with Leaflet + dark tiles | ✅ |
| 🤖 Auto-dispatch nearest driver (Haversine) | ✅ |
| ⏳ SOS queue when no drivers available | ✅ |
| ⚡ Real-time WebSocket sync | ✅ |
| 💾 SQLite persistent database | ✅ |
| 🔑 Driver auto-login (localStorage + API) | ✅ |
| 📊 Admin dashboard with Chart.js | ✅ |
| 🛰️ Dispatcher command center | ✅ |
| 🤖 ARIA AI chatbot (Claude API) | ✅ |
| 📩 Complaint submission system | ✅ |
| 🌐 Reverse geocoding (Nominatim) | ✅ |
| 🎨 Glowmorphism premium dark UI | ✅ |

---

## 📦 Dependencies

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-socketio==5.11.2
python-multipart==0.0.9
aiofiles==23.2.1
pydantic==2.7.1
```

No external database setup required — SQLite is built into Python.

---

*Built with ❤️ for every second that counts.*
