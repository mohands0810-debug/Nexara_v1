import sqlite3
import os
import uuid
import math

DB_PATH = os.path.join(os.path.dirname(__file__), "nexara.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        vehicle_number TEXT NOT NULL,
        vehicle_type TEXT DEFAULT 'Advanced Life Support',
        lat REAL DEFAULT 0,
        lng REAL DEFAULT 0,
        status TEXT DEFAULT 'offline',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sos_requests (
        id TEXT PRIMARY KEY,
        patient_name TEXT NOT NULL,
        patient_phone TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        address TEXT DEFAULT 'Unknown Location',
        priority INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        driver_id TEXT,
        eta INTEGER,
        distance REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        admin_reply TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dispatch_history (
        id TEXT PRIMARY KEY,
        sos_id TEXT,
        driver_id TEXT,
        action TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        from_role TEXT,
        from_id TEXT,
        to_role TEXT,
        to_id TEXT,
        duration INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        type TEXT DEFAULT 'Multi-Specialty',
        emergency_available INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        phone TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );
    """)
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM hospitals").fetchone()[0]
    if count == 0:
        _seed_hospitals(conn)

    conn.close()
    print("[NEXARA] Database initialized.")


def _seed_hospitals(conn):
    hospitals = [
        ("hosp_001", "Manipal Hospital", "98 HAL Airport Road, Bengaluru", "+91-80-2502-4444", 12.9592, 77.6487, "Multi-Specialty"),
        ("hosp_002", "Apollo Hospitals", "154/11 Bannerghatta Road, Bengaluru", "+91-80-2630-4050", 12.8986, 77.5963, "Super Specialty"),
        ("hosp_003", "Fortis Hospital Bannerghatta", "154/9 Bannerghatta Road, Bengaluru", "+91-80-6621-4444", 12.8926, 77.5943, "Multi-Specialty"),
        ("hosp_004", "St. John's Medical College", "Sarjapur Road, Bengaluru", "+91-80-2206-5000", 12.9373, 77.6226, "Teaching Hospital"),
        ("hosp_005", "Narayana Health City", "258/A Bommasandra, Hosur Road, Bengaluru", "+91-80-7122-2200", 12.8347, 77.6407, "Cardiac Care"),
        ("hosp_006", "Columbia Asia Referral Hospital", "26/4 Brigade Gateway, Malleshwaram, Bengaluru", "+91-80-3989-6969", 13.0113, 77.5564, "Multi-Specialty"),
        ("hosp_007", "Sakra World Hospital", "52/2 Devarabeesanahalli, Outer Ring Road, Bengaluru", "+91-80-4969-4969", 12.9580, 77.7002, "Multi-Specialty"),
        ("hosp_008", "M.S. Ramaiah Medical Centre", "New BEL Road, Bengaluru", "+91-80-2360-5678", 13.0219, 77.5643, "Teaching Hospital"),
    ]
    doctors = [
        ("doc_001", "hosp_001", "Dr. Arun Kumar", "Cardiology", "+91-98450-11001", 1),
        ("doc_002", "hosp_001", "Dr. Priya Sharma", "Emergency Medicine", "+91-98450-11002", 1),
        ("doc_003", "hosp_001", "Dr. Ramesh Nair", "Neurology", "+91-98450-11003", 1),
        ("doc_004", "hosp_002", "Dr. Sunita Rao", "Trauma Surgery", "+91-98450-22001", 1),
        ("doc_005", "hosp_002", "Dr. Vikram Singh", "Cardiology", "+91-98450-22002", 1),
        ("doc_006", "hosp_002", "Dr. Meena Pillai", "Emergency Medicine", "+91-98450-22003", 1),
        ("doc_007", "hosp_003", "Dr. Suresh Babu", "Orthopedics", "+91-98450-33001", 1),
        ("doc_008", "hosp_003", "Dr. Anitha Krishnan", "Neurosurgery", "+91-98450-33002", 1),
        ("doc_009", "hosp_004", "Dr. Thomas Mathew", "General Surgery", "+91-98450-44001", 1),
        ("doc_010", "hosp_004", "Dr. Kavitha Reddy", "Cardiology", "+91-98450-44002", 1),
        ("doc_011", "hosp_005", "Dr. Devi Prasad Shetty", "Cardiac Surgery", "+91-98450-55001", 1),
        ("doc_012", "hosp_005", "Dr. Srinivas Murthy", "Pediatric Cardiology", "+91-98450-55002", 1),
        ("doc_013", "hosp_006", "Dr. Rohini Venkat", "Emergency Medicine", "+91-98450-66001", 1),
        ("doc_014", "hosp_006", "Dr. Ashok Patel", "Internal Medicine", "+91-98450-66002", 1),
        ("doc_015", "hosp_007", "Dr. Girish B.S.", "Neurology", "+91-98450-77001", 1),
        ("doc_016", "hosp_007", "Dr. Padma Srinivasan", "Cardiology", "+91-98450-77002", 1),
        ("doc_017", "hosp_008", "Dr. Nagaraj M.V.", "Trauma Surgery", "+91-98450-88001", 1),
        ("doc_018", "hosp_008", "Dr. Usha Rani", "Emergency Medicine", "+91-98450-88002", 1),
    ]
    conn.executemany(
        "INSERT INTO hospitals (id, name, address, phone, lat, lng, type) VALUES (?,?,?,?,?,?,?)",
        hospitals
    )
    conn.executemany(
        "INSERT INTO doctors (id, hospital_id, name, specialty, phone, available) VALUES (?,?,?,?,?,?)",
        doctors
    )
    conn.commit()
    print("[NEXARA] Seeded hospitals and doctors.")


# ── Drivers ───────────────────────────────────────────────────────────────────

def db_get_all_drivers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM drivers ORDER BY last_seen DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_get_driver(driver_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM drivers WHERE id = ?", (driver_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def db_get_driver_by_phone(phone):
    conn = get_db()
    row = conn.execute("SELECT * FROM drivers WHERE phone = ?", (phone,)).fetchone()
    conn.close()
    return dict(row) if row else None


def db_upsert_driver(driver_id, name, phone, vehicle_number, vehicle_type):
    conn = get_db()
    conn.execute("""
        INSERT INTO drivers (id, name, phone, vehicle_number, vehicle_type)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            phone=excluded.phone,
            vehicle_number=excluded.vehicle_number,
            vehicle_type=excluded.vehicle_type,
            last_seen=CURRENT_TIMESTAMP
    """, (driver_id, name, phone, vehicle_number, vehicle_type))
    conn.commit()
    conn.close()


def db_update_driver_location(driver_id, lat, lng):
    conn = get_db()
    conn.execute(
        "UPDATE drivers SET lat=?, lng=?, last_seen=CURRENT_TIMESTAMP WHERE id=?",
        (lat, lng, driver_id)
    )
    conn.commit()
    conn.close()


def db_update_driver_status(driver_id, status):
    conn = get_db()
    conn.execute(
        "UPDATE drivers SET status=?, last_seen=CURRENT_TIMESTAMP WHERE id=?",
        (status, driver_id)
    )
    conn.commit()
    conn.close()


def db_get_online_drivers():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM drivers WHERE status='online' AND lat != 0"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── SOS ───────────────────────────────────────────────────────────────────────

def db_create_sos(patient_name, patient_phone, lat, lng, address, priority):
    sos_id = str(uuid.uuid4())[:12]
    conn = get_db()
    conn.execute("""
        INSERT INTO sos_requests (id, patient_name, patient_phone, lat, lng, address, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (sos_id, patient_name, patient_phone, lat, lng, address, priority))
    conn.commit()
    conn.close()
    return sos_id


def db_assign_sos(sos_id, driver_id, eta, distance):
    conn = get_db()
    conn.execute("""
        UPDATE sos_requests SET
            driver_id=?, status='assigned', eta=?, distance=?,
            assigned_at=CURRENT_TIMESTAMP
        WHERE id=?
    """, (driver_id, eta, distance, sos_id))
    conn.execute("""
        UPDATE drivers SET status='busy' WHERE id=?
    """, (driver_id,))
    hist_id = str(uuid.uuid4())[:12]
    conn.execute("""
        INSERT INTO dispatch_history (id, sos_id, driver_id, action, notes)
        VALUES (?, ?, ?, 'assigned', ?)
    """, (hist_id, sos_id, driver_id, f"ETA: {eta}min, Distance: {distance:.1f}km"))
    conn.commit()
    conn.close()


def db_complete_sos(sos_id):
    conn = get_db()
    conn.execute("""
        UPDATE sos_requests SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?
    """, (sos_id,))
    row = conn.execute("SELECT driver_id FROM sos_requests WHERE id=?", (sos_id,)).fetchone()
    if row and row["driver_id"]:
        conn.execute("UPDATE drivers SET status='online' WHERE id=?", (row["driver_id"],))
    conn.commit()
    conn.close()


def db_get_pending_sos():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sos_requests WHERE status='pending' ORDER BY priority DESC, created_at ASC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_get_all_sos(limit=100):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sos_requests ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Hospitals ─────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def db_get_nearest_hospital(lat, lng):
    conn = get_db()
    hospitals = conn.execute(
        "SELECT * FROM hospitals WHERE emergency_available=1"
    ).fetchall()

    if not hospitals:
        conn.close()
        return None

    nearest = None
    nearest_dist = float("inf")
    for h in hospitals:
        d = _haversine(lat, lng, h["lat"], h["lng"])
        if d < nearest_dist:
            nearest_dist = d
            nearest = h

    if not nearest:
        conn.close()
        return None

    hospital = dict(nearest)
    hospital["distance_km"] = round(nearest_dist, 2)
    hospital["eta_min"] = max(1, round((nearest_dist / 40) * 60))

    doctors = conn.execute(
        "SELECT * FROM doctors WHERE hospital_id=? AND available=1", (hospital["id"],)
    ).fetchall()
    hospital["doctors"] = [dict(d) for d in doctors]

    conn.close()
    return hospital


def db_get_all_hospitals():
    conn = get_db()
    rows = conn.execute("SELECT * FROM hospitals ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Complaints ────────────────────────────────────────────────────────────────

def db_create_complaint(name, email, phone, message):
    cid = str(uuid.uuid4())[:12]
    conn = get_db()
    conn.execute(
        "INSERT INTO complaints (id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)",
        (cid, name, email, phone, message)
    )
    conn.commit()
    conn.close()
    return cid


def db_get_all_complaints():
    conn = get_db()
    rows = conn.execute("SELECT * FROM complaints ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Stats ─────────────────────────────────────────────────────────────────────

def db_get_stats():
    conn = get_db()
    stats = {}
    stats["total_sos"] = conn.execute("SELECT COUNT(*) FROM sos_requests").fetchone()[0]
    stats["pending_sos"] = conn.execute("SELECT COUNT(*) FROM sos_requests WHERE status='pending'").fetchone()[0]
    stats["completed_sos"] = conn.execute("SELECT COUNT(*) FROM sos_requests WHERE status='completed'").fetchone()[0]
    stats["active_drivers"] = conn.execute("SELECT COUNT(*) FROM drivers WHERE status='online'").fetchone()[0]
    stats["total_drivers"] = conn.execute("SELECT COUNT(*) FROM drivers").fetchone()[0]
    stats["total_complaints"] = conn.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
    row = conn.execute("""
        SELECT AVG((JULIANDAY(assigned_at) - JULIANDAY(created_at)) * 24 * 60)
        FROM sos_requests WHERE assigned_at IS NOT NULL
    """).fetchone()
    stats["avg_response_min"] = round(row[0], 1) if row[0] else 0
    rows = conn.execute("""
        SELECT DATE(created_at) as day, COUNT(*) as cnt
        FROM sos_requests
        WHERE created_at >= DATE('now', '-7 days')
        GROUP BY day ORDER BY day
    """).fetchall()
    stats["daily_dispatches"] = [{"day": r["day"], "count": r["cnt"]} for r in rows]
    conn.close()
    return stats
