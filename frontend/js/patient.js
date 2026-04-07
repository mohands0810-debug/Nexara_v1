/* ═══════════════════════════════════════════════════════════════
   NEXARA — Patient SOS Logic (patient.js)
   ═══════════════════════════════════════════════════════════════ */

let map, patientMarker, driverMarker, hospitalMarker, routeLine;
let patientLat = null, patientLng = null;
let currentSosId = null;
let cancelCountdown = null;
let voiceListening = false;
let voiceRecognition = null;
let sosActive = false;
let selectedPriority = 'cardiac';
let gpsWatcher = null;
let gpsAcquired = false;

// ── GPS STATUS HELPERS ────────────────────────────────────────────
function setGpsStatus(state, text) {
  const dot  = document.getElementById('gps-status-dot');
  const label = document.getElementById('gps-status-text');
  if (!dot || !label) return;
  const colors = { acquiring: '#ff9f0a', ok: '#34c759', error: '#ff2d55' };
  dot.style.background = colors[state] || '#ff9f0a';
  // pulse animation for acquiring
  dot.style.animation = state === 'acquiring' ? 'sos-ring-expand 1.5s ease-out infinite' : 'none';
  label.textContent = text;
}

// ── MAP INIT ──────────────────────────────────────────────────────
function initPatientMap() {
  map = createMap('patient-map', 12.9716, 77.5946, 14);
  locatePatient();
}

async function locatePatient() {
  setGpsStatus('acquiring', 'Acquiring GPS…');

  // Stop any existing watcher
  if (gpsWatcher !== null) {
    navigator.geolocation.clearWatch(gpsWatcher);
    gpsWatcher = null;
  }

  if (!navigator.geolocation) {
    setGpsStatus('error', 'GPS not supported by browser');
    showToast('GPS Unavailable', 'Your browser does not support geolocation. Enter address manually.', 'warning');
    patientLat = 12.9716; patientLng = 77.5946;
    return;
  }

  // First: one-shot high-accuracy fetch
  try {
    const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    applyPosition(pos);
  } catch (err) {
    // Fallback: low accuracy (faster on some devices)
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 });
      applyPosition(pos);
    } catch (err2) {
      setGpsStatus('error', 'GPS failed — tap ⟳ Refresh or enter address');
      showToast('GPS Error', 'Could not get location. Tap ⟳ Refresh or enter address manually.', 'warning');
      patientLat = 12.9716; patientLng = 77.5946;
    }
  }

  // Then watch for position updates
  startGpsWatch();
}

function applyPosition(pos) {
  patientLat = pos.coords.latitude;
  patientLng = pos.coords.longitude;
  gpsAcquired = true;

  const acc = pos.coords.accuracy ? `±${Math.round(pos.coords.accuracy)}m` : '';
  setGpsStatus('ok', `GPS locked ${acc}`);

  map.setView([patientLat, patientLng], 15);
  if (patientMarker) map.removeLayer(patientMarker);
  patientMarker = L.marker([patientLat, patientLng], {
    icon: makePulsingIcon('🙋', '#00f5ff'),
  }).addTo(map).bindPopup('<b>📍 Your Location</b>').openPopup();

  // Reverse geocode (non-blocking)
  reverseGeocode(patientLat, patientLng).then(addr => {
    document.getElementById('patient-address').value = addr;
  });
}

function startGpsWatch() {
  if (!navigator.geolocation) return;
  gpsWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      patientLat = pos.coords.latitude;
      patientLng = pos.coords.longitude;
      const acc = pos.coords.accuracy ? `±${Math.round(pos.coords.accuracy)}m` : '';
      setGpsStatus('ok', `GPS locked ${acc}`);
      if (patientMarker) patientMarker.setLatLng([patientLat, patientLng]);
    },
    (err) => {
      if (!gpsAcquired) setGpsStatus('error', 'GPS signal lost — tap ⟳ Refresh');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

function retryGPS() {
  gpsAcquired = false;
  document.getElementById('patient-address').value = '';
  document.getElementById('patient-address').placeholder = 'Re-detecting…';
  locatePatient();
}

// ── SOS FLOW ──────────────────────────────────────────────────────
function triggerSOS() {
  if (sosActive) return;

  const name  = document.getElementById('patient-name').value.trim();
  const phone = document.getElementById('patient-phone').value.trim();
  if (!name)  { showToast('Missing Info', 'Please enter your name.', 'warning'); return; }
  if (!phone) { showToast('Missing Info', 'Please enter your phone number.', 'warning'); return; }
  if (!patientLat) { showToast('GPS Error', 'Waiting for location… tap ⟳ Refresh if stuck.', 'warning'); return; }

  sosActive = true;
  playSiren(5000);
  document.getElementById('cancel-bar').classList.add('visible');
  document.getElementById('sos-btn').classList.add('active');

  cancelCountdown = startCountdown(
    10,
    document.getElementById('cancel-count'),
    () => sendSOS(name, phone),
    null
  );
}

function cancelSOS() {
  if (cancelCountdown) { cancelCountdown(); cancelCountdown = null; }
  sosActive = false;
  document.getElementById('cancel-bar').classList.remove('visible');
  document.getElementById('sos-btn').classList.remove('active');
  showToast('SOS Cancelled', 'Emergency alert cancelled.', 'info');
}

async function sendSOS(name, phone) {
  document.getElementById('cancel-bar').classList.remove('visible');

  const address = document.getElementById('patient-address').value || 'Unknown Location';

  const statusEl = document.getElementById('dispatch-status');
  statusEl.classList.add('visible', 'pending');
  document.getElementById('dispatch-status-label').textContent = '🔴 Connecting to nearest ambulance…';

  try {
    const result = await apiPost('/api/sos', {
      patient_name: name,
      patient_phone: phone,
      lat: patientLat,
      lng: patientLng,
      address,
      notes: selectedPriority,
    });

    currentSosId = result.sos_id;

    if (result.status === 'assigned' && result.driver) {
      handleAssignment(result);
    } else {
      statusEl.classList.remove('pending');
      statusEl.classList.add('visible', 'pending');
      document.getElementById('dispatch-status-label').textContent =
        '⏳ No drivers available. Your request is queued — we\'ll assign the moment one goes online.';
      showToast('SOS Queued', 'No drivers online right now. You will be auto-assigned shortly.', 'warning', 8000);
    }

    // Always fetch nearest hospital after SOS
    fetchNearestHospital(patientLat, patientLng);

  } catch (e) {
    showToast('SOS Failed', e.message, 'danger');
    sosActive = false;
    document.getElementById('sos-btn').classList.remove('active');
  }
}

function handleAssignment(data) {
  const { driver, eta, distance } = data;
  if (!driver) return;

  const statusEl = document.getElementById('dispatch-status');
  statusEl.classList.remove('pending');
  statusEl.classList.add('assigned');
  document.getElementById('dispatch-status-label').innerHTML = '✅ Ambulance Dispatched!';
  document.getElementById('dispatch-grid').style.display = 'grid';
  document.getElementById('disp-eta').textContent  = eta || '—';
  document.getElementById('disp-dist').textContent = distance ? `${distance}` : '—';

  document.getElementById('driver-name').textContent    = driver.name || driver.id;
  document.getElementById('driver-vehicle').textContent =
    `${driver.vehicle_type || 'Ambulance'} · ${driver.vehicle_number || ''}`;
  const link = document.getElementById('driver-phone-link');
  link.href = `tel:${driver.phone}`;
  document.getElementById('driver-phone-display').textContent = driver.phone || '—';
  document.getElementById('driver-card').classList.add('visible');

  if (driver.lat && driver.lng) {
    if (driverMarker) map.removeLayer(driverMarker);
    driverMarker = L.marker([driver.lat, driver.lng], {
      icon: makeIcon('🚑', 40, '#ff2d55'),
    }).addTo(map).bindPopup(`<b>🚑 ${driver.name}</b><br>${driver.vehicle_number}`).openPopup();

    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(
      [[patientLat, patientLng], [driver.lat, driver.lng]],
      { color: '#00f5ff', weight: 3, opacity: 0.7, dashArray: '10 6' }
    ).addTo(map);

    map.fitBounds([[patientLat, patientLng], [driver.lat, driver.lng]], { padding: [60, 60] });
  }

  showToast('Ambulance Dispatched!', `${driver.name} is ${distance}km away · ETA: ${eta} min`, 'success', 8000);
}

// ── NEAREST HOSPITAL ──────────────────────────────────────────────
// Set your Google Maps API key here (or leave empty to use local DB fallback)
const GOOGLE_MAPS_API_KEY = window.NEXARA_GOOGLE_API_KEY || '';

async function fetchNearestHospital(lat, lng) {
  try {
    let url = `/api/hospitals/nearest?lat=${lat}&lng=${lng}`;
    if (GOOGLE_MAPS_API_KEY) url += `&google_api_key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    const hosp = await apiGet(url);
    renderHospitalCard(hosp);
  } catch (e) {
    console.warn('[Hospital] Could not fetch nearest hospital:', e.message);
    showToast('Hospital Search', 'Could not find nearest hospital. Check your API key or network.', 'warning', 5000);
  }
}

function renderHospitalCard(hosp) {
  const card = document.getElementById('hospital-card');
  if (!card) return;

  document.getElementById('hosp-name').textContent    = hosp.name || '—';
  document.getElementById('hosp-type').textContent    = hosp.type || 'Hospital';
  document.getElementById('hosp-address').textContent = hosp.address || '—';
  document.getElementById('hosp-dist').textContent    = hosp.distance_km != null ? `${hosp.distance_km}` : '—';
  document.getElementById('hosp-eta').textContent     = hosp.eta_min  != null ? hosp.eta_min  : '—';

  const phoneLink = document.getElementById('hosp-phone-link');
  if (hosp.phone && hosp.phone !== '—') {
    phoneLink.href = `tel:${hosp.phone}`;
    phoneLink.style.display = 'block';
  } else {
    phoneLink.style.display = 'none';
  }
  document.getElementById('hosp-phone').textContent = hosp.phone || '—';

  // ── Source badge (Google Places vs local DB) ─────────────────────
  let sourceBadge = document.getElementById('hosp-source-badge');
  if (!sourceBadge) {
    sourceBadge = document.createElement('div');
    sourceBadge.id = 'hosp-source-badge';
    sourceBadge.style.cssText = `
      font-size:0.62rem; letter-spacing:0.08em; padding:2px 7px; border-radius:10px;
      display:inline-block; margin-bottom:8px; font-family:var(--font-display);
    `;
    document.getElementById('hosp-name').parentElement.appendChild(sourceBadge);
  }
  if (hosp.source === 'google_places') {
    sourceBadge.textContent = '🌐 VIA GOOGLE PLACES';
    sourceBadge.style.cssText += 'background:rgba(66,133,244,0.15);color:#4285f4;border:1px solid rgba(66,133,244,0.3);';
    // Show rating if available
    if (hosp.rating) {
      sourceBadge.textContent += `  ⭐ ${hosp.rating}`;
    }
    if (hosp.open_now === false) {
      sourceBadge.textContent += '  · ⚠️ May be closed';
    }
  } else {
    sourceBadge.textContent = '🗃️ LOCAL DATABASE';
    sourceBadge.style.cssText += 'background:rgba(0,245,255,0.08);color:var(--cyan);border:1px solid rgba(0,245,255,0.2);';
  }

  // ── Doctor list ───────────────────────────────────────────────────
  const doctorsEl = document.getElementById('hosp-doctors');
  doctorsEl.innerHTML = '';
  const doctors = Array.isArray(hosp.doctors) ? hosp.doctors : [];

  if (doctors.length === 0) {
    doctorsEl.innerHTML = `
      <div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:8px 0;">
        👨‍⚕️ Doctor details not available for this hospital.
      </div>`;
  } else {
    doctors.forEach(doc => {
      const row = document.createElement('div');
      row.style.cssText = `
        background: rgba(0,245,255,0.04);
        border: 1px solid rgba(0,245,255,0.12);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `;
      const availBadge = doc.available === 0
        ? `<span style="font-size:0.65rem;color:#ff9f0a;margin-left:4px;">● Off duty</span>`
        : `<span style="font-size:0.65rem;color:#34c759;margin-left:4px;">● On duty</span>`;
      row.innerHTML = `
        <div>
          <div style="font-size:0.82rem; color:var(--text-primary); font-weight:600;">
            ${doc.name} ${availBadge}
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">🩺 ${doc.specialty}</div>
        </div>
        ${doc.phone ? `
        <a href="tel:${doc.phone}" style="
          font-size:0.72rem; color:var(--cyan); text-decoration:none;
          background:rgba(0,245,255,0.08); border:1px solid rgba(0,245,255,0.2);
          border-radius:6px; padding:4px 8px; white-space:nowrap; flex-shrink:0;
        ">📞 ${doc.phone}</a>` : ''}
      `;
      doctorsEl.appendChild(row);
    });
  }

  // ── Show the card ────────────────────────────────────────────────
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // ── Pin on map ───────────────────────────────────────────────────
  if (hosp.lat && hosp.lng) {
    if (hospitalMarker) map.removeLayer(hospitalMarker);
    hospitalMarker = L.marker([hosp.lat, hosp.lng], {
      icon: makeIcon('🏥', 36, '#34c759'),
    }).addTo(map).bindPopup(
      `<b>🏥 ${hosp.name}</b><br>${hosp.address}<br>📞 ${hosp.phone || '—'}`
    );
  }

  showToast('🏥 Nearest Hospital Found',
    `${hosp.name} · ${hosp.distance_km}km · ETA ${hosp.eta_min} min`, 'info', 7000);
}

// ── MARK ARRIVED ───────────────────────────────────────────────────
function markArrived() {
  if (!currentSosId) return;
  apiPost('/api/sos/complete', { sos_id: currentSosId })
    .then(() => {
      showToast('Trip Complete', 'Thank you! The driver has been marked as arrived.', 'success');
      document.getElementById('driver-card').classList.remove('visible');
      document.getElementById('hospital-card').style.display = 'none';
      document.getElementById('dispatch-status').classList.remove('visible', 'assigned');
      document.getElementById('sos-btn').classList.remove('active');
      currentSosId = null;
      sosActive = false;
    })
    .catch(e => showToast('Error', e.message, 'danger'));
}

// ── PRIORITY SELECTOR ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.priority-badge').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.priority-badge').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedPriority = b.dataset.val;
    });
  });
});

// ── VOICE SOS ─────────────────────────────────────────────────────
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    showToast('Voice N/A', 'Your browser does not support voice recognition.', 'warning');
    return;
  }
  voiceListening ? stopVoice() : startVoice();
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SR();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = false;
  voiceRecognition.lang = 'en-IN';

  voiceRecognition.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
    if (text.includes('emergency') || text.includes('help') || text.includes('sos') || text.includes('ambulance')) {
      stopVoice();
      showToast('Voice Trigger', '"Emergency" detected — initiating SOS…', 'danger');
      setTimeout(() => triggerSOS(), 500);
    }
  };
  voiceRecognition.onerror = () => stopVoice();
  voiceRecognition.onend = () => { if (voiceListening) voiceRecognition.start(); };

  voiceRecognition.start();
  voiceListening = true;
  document.getElementById('voice-toggle').classList.add('listening');
  document.getElementById('voice-label').textContent = 'Listening for "Emergency"…';
  showToast('Voice Active', 'Say "emergency" or "help" to trigger SOS.', 'info');
}

function stopVoice() {
  voiceListening = false;
  if (voiceRecognition) voiceRecognition.stop();
  document.getElementById('voice-toggle').classList.remove('listening');
  document.getElementById('voice-label').textContent = 'Enable Voice SOS';
}

// ── SOCKET EVENTS ──────────────────────────────────────────────────
onSocket('sos_assigned', (data) => {
  if (data.sos_id === currentSosId) {
    handleAssignment(data);
    fetchNearestHospital(patientLat, patientLng);
  }
});

onSocket('sos_pending', (data) => {
  if (data.sos_id === currentSosId) {
    showToast('SOS Queued', data.message, 'warning', 8000);
  }
});

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPatientMap();
});
