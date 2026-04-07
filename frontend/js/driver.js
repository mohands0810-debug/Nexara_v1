/* ═══════════════════════════════════════════════════════════════
   NEXARA — Driver Dashboard JS (driver.js)
   ═══════════════════════════════════════════════════════════════ */

let map, driverSelfMarker, patientMarker, routeLine;
let driverData = null;
let isOnline = false;
let gpsWatchId = null;
let currentAssignment = null;
let driverLat = null, driverLng = null;

// ── MAP ───────────────────────────────────────────────────────────
function initDriverMap() {
  map = createMap('driver-map', 12.9716, 77.5946, 14);
  startGPS();
}

function startGPS() {
  if (!navigator.geolocation) return;
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      driverLat = pos.coords.latitude;
      driverLng = pos.coords.longitude;
      onGPSUpdate(driverLat, driverLng);
    },
    (err) => console.warn('[GPS]', err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
  );
}

function onGPSUpdate(lat, lng) {
  // Update UI
  const coordEl = document.getElementById('gps-coords');
  const dotEl = document.getElementById('gps-dot');
  if (coordEl) coordEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  if (dotEl) dotEl.classList.add('active');

  // Update marker
  if (driverSelfMarker) {
    driverSelfMarker.setLatLng([lat, lng]);
  } else {
    driverSelfMarker = L.marker([lat, lng], {
      icon: makeIcon('🚑', 44, '#00f5ff'),
    }).addTo(map).bindPopup('<b>📍 Your Position</b>');
    map.setView([lat, lng], 15);
  }

  // Send to server if online
  if (isOnline && driverData) {
    apiPost('/api/drivers/location', {
      driver_id: driverData.id, lat, lng,
    }).catch(() => {});

    emitSocket('driver_location', { driver_id: driverData.id, lat, lng });
  }
}

// ── REGISTRATION ──────────────────────────────────────────────────
async function registerDriver() {
  const name    = document.getElementById('drv-name').value.trim();
  const phone   = document.getElementById('drv-phone').value.trim();
  const vehicle = document.getElementById('drv-vehicle').value.trim();
  const type    = document.getElementById('drv-type').value;

  if (!name || !phone || !vehicle) {
    showToast('Incomplete', 'Please fill all fields.', 'warning');
    return;
  }

  try {
    const res = await apiPost('/api/drivers/register', {
      name, phone, vehicle_number: vehicle, vehicle_type: type,
    });
    loginDriver(res.driver);
    Store.set('nexara_driver', res.driver);
    showToast('Welcome!', `${res.is_new ? 'Profile created' : 'Welcome back'}, ${name}!`, 'success');
  } catch (e) {
    showToast('Registration Failed', e.message, 'danger');
  }
}

function loginDriver(driver) {
  driverData = driver;
  document.getElementById('reg-section').style.display = 'none';
  document.getElementById('profile-section').style.display = 'flex';

  document.getElementById('prof-name').textContent    = driver.name;
  document.getElementById('prof-id').textContent      = `ID: ${driver.id}`;
  document.getElementById('prof-vehicle').textContent = driver.vehicle_number;
  document.getElementById('prof-type').textContent    = driver.vehicle_type;

  // Emit online event via socket
  window._onSocketConnect = () => {
    emitSocket('driver_online', { driver_id: driver.id });
  };
  if (NexSocket.socket && NexSocket.socket.connected) {
    emitSocket('driver_online', { driver_id: driver.id });
  }

  setDriverOnline(true);
}

function logoutDriver() {
  if (isOnline) setDriverOnline(false);
  emitSocket('driver_offline', { driver_id: driverData?.id });
  Store.del('nexara_driver');
  driverData = null;
  document.getElementById('reg-section').style.display = 'block';
  document.getElementById('profile-section').style.display = 'none';
  clearAssignment();
}

// ── STATUS TOGGLE ─────────────────────────────────────────────────
function toggleDriverStatus() {
  if (!driverData) return;
  setDriverOnline(!isOnline);
}

async function setDriverOnline(online) {
  isOnline = online;
  const toggle = document.getElementById('status-toggle');
  const text   = document.getElementById('status-text');
  const noAsgn = document.getElementById('no-assignment');

  toggle.classList.toggle('online', online);
  text.textContent = online ? 'You are Online — accepting dispatches' : 'Currently Offline';

  if (noAsgn && online && !currentAssignment) noAsgn.style.display = 'block';
  if (noAsgn && !online) noAsgn.style.display = 'none';

  try {
    // ── FIX: push current location to server BEFORE going online ────────────
    // This ensures auto-assign sees a valid lat/lng and doesn't skip this driver.
    if (online && driverLat && driverLng) {
      await apiPost('/api/drivers/location', {
        driver_id: driverData.id, lat: driverLat, lng: driverLng,
      }).catch(() => {});
    }

    await apiPost('/api/drivers/status', {
      driver_id: driverData.id,
      status: online ? 'online' : 'offline',
    });
    emitSocket(online ? 'driver_online' : 'driver_offline', { driver_id: driverData.id });
    showToast(online ? 'You\'re Online' : 'You\'re Offline',
              online ? 'NEXARA will auto-assign nearby SOS to you.' : 'You are no longer receiving dispatches.',
              online ? 'success' : 'info');
  } catch (e) {
    showToast('Status Error', e.message, 'danger');
  }
}

// ── ASSIGNMENT ────────────────────────────────────────────────────
function showAssignment(data) {
  currentAssignment = data;
  const card = document.getElementById('assignment-card');
  const noAsgn = document.getElementById('no-assignment');

  if (noAsgn) noAsgn.style.display = 'none';

  document.getElementById('asgn-patient').textContent  = data.patient?.name || '—';
  document.getElementById('asgn-address').textContent  = data.patient?.address || '—';
  document.getElementById('asgn-dist').textContent     = data.distance ? `${data.distance} km` : '—';
  document.getElementById('asgn-eta').textContent      = data.eta ? `${data.eta} min` : '—';
  document.getElementById('asgn-phone').textContent    = data.patient?.phone || '—';

  const callLink = document.getElementById('patient-call-link');
  if (callLink && data.patient?.phone) callLink.href = `tel:${data.patient.phone}`;

  card.classList.add('visible');

  // Show patient on map
  if (data.patient?.lat && data.patient?.lng) {
    if (patientMarker) map.removeLayer(patientMarker);
    patientMarker = L.marker([data.patient.lat, data.patient.lng], {
      icon: makePulsingIcon('🆘', '#ff2d55'),
    }).addTo(map)
      .bindPopup(`<b>🆘 ${data.patient.name}</b><br>${data.patient.address || ''}`)
      .openPopup();

    if (driverLat && driverLng) {
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(
        [[driverLat, driverLng], [data.patient.lat, data.patient.lng]],
        { color: '#ff2d55', weight: 3, opacity: 0.8, dashArray: '10 6' }
      ).addTo(map);
      map.fitBounds([[driverLat, driverLng], [data.patient.lat, data.patient.lng]], { padding: [60, 60] });
    }
  }

  showToast('🚨 New Assignment!', `Patient: ${data.patient?.name} · ${data.distance}km away`, 'danger', 10000);
  playSiren(3000);
}

function clearAssignment() {
  currentAssignment = null;
  document.getElementById('assignment-card').classList.remove('visible');
  if (patientMarker) { map.removeLayer(patientMarker); patientMarker = null; }
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  const noAsgn = document.getElementById('no-assignment');
  if (noAsgn && isOnline) noAsgn.style.display = 'block';
}

async function completeTrip() {
  if (!currentAssignment?.sos_id) {
    showToast('Error', 'No active assignment.', 'warning');
    return;
  }
  try {
    await apiPost('/api/sos/complete', { sos_id: currentAssignment.sos_id });
    clearAssignment();
    showToast('Trip Complete', 'Patient delivered. Status reset to Online.', 'success');
  } catch (e) {
    showToast('Error', e.message, 'danger');
  }
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────
onSocket('sos_assigned', (data) => {
  if (!driverData) return;
  if (data.driver?.id === driverData.id) {
    showAssignment(data);
  }
});

onSocket('drivers_update', (data) => {
  // Update our own profile stat if needed
  if (!driverData) return;
  const self = data.drivers?.find(d => d.id === driverData.id);
  if (self) {
    // Sync status if changed externally
    const expectedOnline = self.status === 'online' || self.status === 'busy';
    if (expectedOnline !== isOnline && self.status !== 'busy') {
      // don't override during active assignment
    }
  }
});

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDriverMap();

  // Auto-login from localStorage
  const saved = Store.get('nexara_driver');
  if (saved && saved.id) {
    // Validate with backend then login
    apiGet(`/api/drivers/${saved.id}`)
      .then(driver => {
        loginDriver(driver);
      })
      .catch(() => {
        Store.del('nexara_driver');
      });
  }
});
