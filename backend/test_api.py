import urllib.request
import json

base = "http://localhost:8000"

def get(path):
    try:
        res = urllib.request.urlopen(base + path, timeout=5)
        code = res.getcode()
        body = res.read(300).decode("utf-8", errors="ignore").replace("\n", " ")[:100]
        print(f"  OK  [{code}] GET {path}: {body}...")
    except Exception as e:
        print(f"  FAIL GET {path}: {e}")

def post(path, payload):
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            base + path, data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        res = urllib.request.urlopen(req, timeout=5)
        body = json.loads(res.read())
        print(f"  OK  [{res.getcode()}] POST {path}: {body}")
        return body
    except Exception as e:
        print(f"  FAIL POST {path}: {e}")
        return None

print("=== NEXARA Page Tests ===")
get("/")
get("/patient.html")
get("/driver.html")
get("/dispatch.html")
get("/admin.html")
get("/css/styles.css")
get("/js/app.js")

print("\n=== NEXARA API Tests ===")
get("/api/drivers")
get("/api/drivers/online")
get("/api/sos")
get("/api/admin/stats")

print("\n=== POST Tests ===")
login = post("/api/admin/login", {"username": "nexara_admin", "password": "nexara@2025"})
if login:
    print(f"    -> token: {login.get('token')}")

driver = post("/api/drivers/register", {
    "name": "Ravi Kumar",
    "phone": "9876543210",
    "vehicle_number": "KA01AB1234",
    "vehicle_type": "Advanced Life Support"
})
if driver:
    print(f"    -> driver_id: {driver['driver']['id']}, is_new: {driver['is_new']}")

sos = post("/api/sos", {
    "patient_name": "Ananya Sharma",
    "patient_phone": "8765432109",
    "lat": 12.9716,
    "lng": 77.5946,
    "address": "MG Road, Bengaluru",
    "notes": "cardiac arrest"
})
if sos:
    print(f"    -> sos_id: {sos['sos_id']}, status: {sos['status']}")

complaint = post("/api/complaints", {
    "name": "Test User",
    "email": "test@nexara.com",
    "phone": "9000000000",
    "message": "Test complaint from automated test"
})
if complaint:
    print(f"    -> complaint_id: {complaint.get('complaint_id')}")

print("\n=== Final Stats ===")
try:
    res = urllib.request.urlopen(base + "/api/admin/stats", timeout=5)
    stats = json.loads(res.read())
    for k, v in stats.items():
        if k != "daily_dispatches":
            print(f"    {k}: {v}")
except Exception as e:
    print(f"  FAIL stats: {e}")

print("\nAll tests complete!")
