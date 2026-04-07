/* ═══════════════════════════════════════════════════════════════
   NEXARA — Dispatch Command Center JS (dispatch.js)
   ═══════════════════════════════════════════════════════════════ */

let map;
const driverMarkers  = {};   // driver_id → L.Marker
const sosMarkers     = {};   // sos_id    → L.Marker
let driversList      = [];
let sosList          = [];

// ── MAP ───────────────────────────────────────────────────────────
function initDispatchMap() {
  map = createMap('dispatch-map', 12.9716, 77.5946, 12);
  map.zoomControl.setPosition('bottomright');
}

// ── DRIVER RENDERING ──────────────────────────────────────────────
function renderDrivers(drivers) {
  driversList = drivers;

  // Remove markers for drivers no longer in list
  const ids = drivers.map(d => d.id);
  Object.keys(driverMarkers).forEach(id => {
    if (!ids.includes(id)) {
      map.removeLayer(driverMarkers[id]);
      delete driverMarkers[id];
    }
  });

  const onlineCount = drivers.filter(d => d.status === 'online' || d.status === 'busy').length;
  document.getElementById('dc-online').textContent = onlineCount;
  document.getElementById('ov-drivers').textContent = drivers.length;

  // Update / create markers
  drivers.forEach(d => {
    if (!d.lat || !d.lng || (d.lat === 0 && d.lng === 0)) return;

    const icon = d.status === 'busy'
      ? makePulsingIcon('🚨', '#ff2d55')
      : makeIcon(d.status === 'online' ? '🚑' : '🔘', 36, d.status === 'online' ? '#00f5ff' : '#444');

    if (driverMarkers[d.id]) {
      driverMarkers[d.id].setLatLng([d.lat, d.lng]).setIcon(icon);
    } else {
      driverMarkers[d.id] = L.marker([d.lat, d.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:var(--font-display); font-size:0.75rem;">
            <strong>${d.name}</strong><br>
            <span style="color:#7090b0;">${d.vehicle_number}</span><br>
            Status: <span style="color:${d.status === 'online' ? '#00ff88' : d.status === 'busy' ? '#ffb800' : '#888'};">${d.status}</span>
          </div>
        `);
    }
  });

  // Sidebar list
  renderDriverQueue(drivers);
}

function renderDriverQueue(drivers) {
  const el = document.getElementById('driver-queue');
  const online = drivers.filter(d => d.status !== 'offline');
  if (!online.length) {
    el.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">No drivers online</div>`;
    return;
  }
  el.innerHTML = online.map(d => `
    <div class="sos-queue-item ${d.status}" onclick="if(driverMarkers['${d.id}']) driverMarkers['${d.id}'].openPopup()">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="sos-queue-name">${d.name}</div>
        <span class="status-pill status-${d.status}">${d.status}</span>
      </div>
      <div class="sos-queue-time">${d.vehicle_number} · ${d.vehicle_type}</div>
    </div>
  `).join('');
}

// ── SOS RENDERING ─────────────────────────────────────────────────
function renderSOS(list) {
  sosList = list;
  const active = list.filter(s => s.status !== 'completed');
  document.getElementById('dc-sos').textContent = active.length;

  // Remove stale markers
  const ids = list.map(s => s.id);
  Object.keys(sosMarkers).forEach(id => {
    if (!ids.includes(id)) {
      map.removeLayer(sosMarkers[id]);
      delete sosMarkers[id];
    }
  });

  // Render markers for pending/assigned SOS
  list.forEach(s => {
    if (s.status === 'completed') {
      if (sosMarkers[s.id]) { map.removeLayer(sosMarkers[s.id]); delete sosMarkers[s.id]; }
      return;
    }
    if (!s.lat || !s.lng) return;

    const icon = s.status === 'pending'
      ? makePulsingIcon('📍', '#ff2d55')
      : makeIcon('📍', 36, '#00f5ff');

    if (sosMarkers[s.id]) {
      sosMarkers[s.id].setLatLng([s.lat, s.lng]).setIcon(icon);
    } else {
      sosMarkers[s.id] = L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:var(--font-display); font-size:0.75rem;">
            <strong>🆘 ${s.patient_name}</strong><br>
            <span style="color:#7090b0;">${s.patient_phone}</span><br>
            <span style="color:#7090b0; font-size:0.7rem;">${s.address || ''}</span><br>
            Status: <span style="color:${s.status === 'pending' ? '#ff2d55' : '#00f5ff'};">${s.status}</span>
            ${s.eta ? `<br>ETA: ${s.eta} min` : ''}
          </div>
        `);
    }
  });

  renderSOSQueue(list);
}

function renderSOSQueue(list) {
  const el = document.getElementById('sos-queue');
  const active = list.filter(s => s.status !== 'completed');
  if (!active.length) {
    el.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">No active requests</div>`;
    return;
  }
  el.innerHTML = active.map(s => `
    <div class="sos-queue-item ${s.status}" onclick="sosMarkers['${s.id}']?.openPopup()">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="sos-queue-name">${s.patient_name}</div>
        <span class="status-pill status-${s.status}">${s.status}</span>
      </div>
      <div class="sos-queue-time">${s.patient_phone} · ${formatDate(s.created_at)}</div>
    </div>
  `).join('');
}

// ── STATS ─────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await apiGet('/api/admin/stats');
    document.getElementById('ov-total').textContent = data.total_sos ?? 0;
    document.getElementById('ov-avg').textContent   = data.avg_response_min ?? '—';
    document.getElementById('ov-drivers').textContent = data.total_drivers ?? 0;

    const avgResp = data.avg_response_min;
    document.getElementById('response-ticker').textContent =
      `⚡ AVG RESPONSE TIME: ${avgResp ? avgResp + ' MIN' : 'CALCULATING…'} · TOTAL DISPATCHES: ${data.total_sos} · ACTIVE DRIVERS: ${data.active_drivers}`;
  } catch {}
}

async function loadInitialData() {
  try {
    const [dData, sData] = await Promise.all([
      apiGet('/api/drivers'),
      apiGet('/api/sos'),
    ]);
    renderDrivers(dData.drivers || []);
    renderSOS(sData.sos_list || []);
  } catch (e) {
    showToast('Error', 'Could not load dispatch data.', 'danger');
  }
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────
onSocket('drivers_update', (data) => {
  renderDrivers(data.drivers || []);
});

onSocket('driver_moved', (data) => {
  const { driver_id, lat, lng } = data;
  if (driverMarkers[driver_id]) {
    driverMarkers[driver_id].setLatLng([lat, lng]);
  }
  // Update our local list
  const d = driversList.find(x => x.id === driver_id);
  if (d) { d.lat = lat; d.lng = lng; }
});

onSocket('sos_assigned', (data) => {
  loadInitialData();
  showToast('SOS Assigned', `SOS dispatched to a driver.`, 'success');
});

onSocket('sos_pending', () => {
  showToast('SOS Pending', 'New SOS request — no driver available.', 'warning');
  loadInitialData();
});

onSocket('sos_list_update', (data) => {
  renderSOS(data.sos_list || []);
});

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDispatchMap();
  loadInitialData();
  loadStats();
  setInterval(loadStats, 10000);
});
