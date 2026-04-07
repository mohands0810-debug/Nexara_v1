/* ═══════════════════════════════════════════════════════════════
   NEXARA — Global Utilities (app.js)
   ═══════════════════════════════════════════════════════════════ */

const API = window.location.origin;

// ── Toast Notifications ───────────────────────────────────────────
function showToast(title, msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { info: '💡', danger: '🚨', success: '✅', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'info' ? '' : type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '💡'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── API Helper ─────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Geolocation ────────────────────────────────────────────────────
function getCurrentPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 5000, ...opts
    });
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const data = await res.json();
    return data.display_name || 'Unknown Location';
  } catch {
    return 'Unknown Location';
  }
}

// ── Formatting ─────────────────────────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDistance(km) {
  if (!km && km !== 0) return '—';
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// ── Leaflet Map Factory ─────────────────────────────────────────────
function createMap(elementId, lat = 12.9716, lng = 77.5946, zoom = 13) {
  const map = L.map(elementId, {
    center: [lat, lng], zoom,
    zoomControl: true,
    attributionControl: false,
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © Carto',
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  return map;
}

// ── Custom Map Icons ────────────────────────────────────────────────
function makeIcon(emoji, size = 36, glowColor = '#00f5ff') {
  const html = `
    <div style="
      width:${size}px; height:${size}px;
      display:flex; align-items:center; justify-content:center;
      font-size:${Math.round(size * 0.6)}px;
      filter: drop-shadow(0 0 8px ${glowColor});
      animation: float 3s ease-in-out infinite;
    ">${emoji}</div>`;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makePulsingIcon(emoji, color = '#ff2d55') {
  const html = `
    <div style="position:relative; width:50px; height:50px; display:flex; align-items:center; justify-content:center;">
      <div style="
        position:absolute; width:50px; height:50px; border-radius:50%;
        border:2px solid ${color}; animation:sos-ring-expand 2s ease-out infinite;
      "></div>
      <div style="
        position:absolute; width:50px; height:50px; border-radius:50%;
        border:2px solid ${color}; animation:sos-ring-expand 2s ease-out 1s infinite;
      "></div>
      <span style="font-size:22px; filter:drop-shadow(0 0 8px ${color});">${emoji}</span>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [50, 50], iconAnchor: [25, 25] });
}

// ── Siren Sound ─────────────────────────────────────────────────────
function playSiren(durationMs = 5000) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const end = ctx.currentTime + durationMs / 1000;

    function beep(freq, start, dur) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 1.5, start + dur / 2);
      osc.frequency.linearRampToValueAtTime(freq, start + dur);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.setValueAtTime(0, start + dur);
      osc.start(start); osc.stop(start + dur);
    }

    for (let t = ctx.currentTime; t < end; t += 0.5) {
      beep(880, t, 0.45);
    }
  } catch (e) {
    console.warn('Audio context not available');
  }
}

// ── LocalStorage Helpers ────────────────────────────────────────────
const Store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// ── Countdown Timer ─────────────────────────────────────────────────
function startCountdown(seconds, displayEl, onComplete, onCancel) {
  let remaining = seconds;
  displayEl.textContent = remaining;
  const iv = setInterval(() => {
    remaining--;
    displayEl.textContent = remaining;
    if (remaining <= 0) { clearInterval(iv); onComplete(); }
  }, 1000);
  return () => { clearInterval(iv); if (onCancel) onCancel(); };
}

// ── Page-specific init marker ───────────────────────────────────────
window.NEXARA = { API, showToast, apiGet, apiPost, createMap, makeIcon, makePulsingIcon, playSiren, Store, formatDate, formatDistance, getCurrentPosition, reverseGeocode, startCountdown };
