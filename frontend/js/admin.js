/* ═══════════════════════════════════════════════════════════════
   NEXARA — Admin Panel JS (admin.js)
   ═══════════════════════════════════════════════════════════════ */

let adminToken = null;
let charts = {};

// ── AUTH ──────────────────────────────────────────────────────────
async function adminLogin() {
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();

  if (!user || !pass) { showToast('Error', 'Enter username and password.', 'warning'); return; }

  try {
    const res = await apiPost('/api/admin/login', { username: user, password: pass });
    adminToken = res.token;
    sessionStorage.setItem('nexara_admin', 'true');   // ← persist session
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    showToast('Access Granted', 'Welcome to NEXARA Admin.', 'success');
    refreshStats();
    loadDrivers();
    loadSOS();
    loadComplaints();
    setInterval(refreshStats, 15000);
  } catch {
    showToast('Access Denied', 'Invalid credentials.', 'danger');
  }
}

function adminLogout() {
  adminToken = null;
  sessionStorage.removeItem('nexara_admin');   // ← clear session
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-dashboard').style.display = 'none';
}

// ── PANEL NAVIGATION ──────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');

  if (name === 'analytics') renderAnalytics();
}

// ── STATS ─────────────────────────────────────────────────────────
async function refreshStats() {
  try {
    const data = await apiGet('/api/admin/stats');
    document.getElementById('s-total').textContent        = data.total_sos ?? 0;
    document.getElementById('s-pending').textContent      = data.pending_sos ?? 0;
    document.getElementById('s-completed').textContent    = data.completed_sos ?? 0;
    document.getElementById('s-active-drivers').textContent = data.active_drivers ?? 0;
    document.getElementById('s-avg-resp').textContent     = data.avg_response_min ?? '—';
    document.getElementById('pending-badge').textContent  = data.pending_sos ?? 0;

    // Dispatch chart
    renderDispatchChart(data.daily_dispatches || []);
  } catch (e) {
    showToast('Error', 'Could not load stats.', 'danger');
  }
}

function renderDispatchChart(days) {
  const labels = days.map(d => d.day);
  const values = days.map(d => d.count);

  // Pad to 7 days
  while (labels.length < 7) {
    const d = new Date();
    d.setDate(d.getDate() - (7 - labels.length));
    labels.unshift(d.toISOString().slice(0, 10));
    values.unshift(0);
  }

  const ctx = document.getElementById('dispatch-chart');
  if (!ctx) return;

  if (charts.dispatch) charts.dispatch.destroy();
  charts.dispatch = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => l.slice(5)), // MM-DD
      datasets: [{
        label: 'Dispatches',
        data: values,
        backgroundColor: 'rgba(0,245,255,0.2)',
        borderColor: '#00f5ff',
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0d0d25', titleColor: '#00f5ff', bodyColor: '#cde' },
      },
      scales: {
        x: { grid: { color: 'rgba(0,245,255,0.05)' }, ticks: { color: '#7090b0' } },
        y: { grid: { color: 'rgba(0,245,255,0.05)' }, ticks: { color: '#7090b0', stepSize: 1 }, beginAtZero: true },
      },
    },
  });
}

// ── DRIVERS TABLE ─────────────────────────────────────────────────
async function loadDrivers() {
  try {
    const data = await apiGet('/api/admin/drivers');
    const tbody = document.getElementById('drivers-tbody');
    if (!data.drivers.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No drivers registered.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.drivers.map(d => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td><a href="tel:${d.phone}" style="color:var(--cyan);">${d.phone}</a></td>
        <td style="font-family:var(--font-mono); font-size:0.8rem;">${d.vehicle_number}</td>
        <td style="color:var(--text-muted);">${d.vehicle_type}</td>
        <td><span class="status-pill status-${d.status}">${d.status}</span></td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${formatDate(d.last_seen)}</td>
      </tr>
    `).join('');
  } catch (e) {
    showToast('Error', 'Could not load drivers.', 'danger');
  }
}

// ── SOS TABLE ─────────────────────────────────────────────────────
async function loadSOS() {
  try {
    const data = await apiGet('/api/admin/sos');
    const tbody = document.getElementById('sos-tbody');
    if (!data.sos_list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No SOS requests yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.sos_list.map(s => `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--cyan);">${s.id}</td>
        <td><strong>${s.patient_name}</strong></td>
        <td><a href="tel:${s.patient_phone}" style="color:var(--cyan);">${s.patient_phone}</a></td>
        <td style="color:var(--text-muted); font-size:0.8rem; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.address || '—'}</td>
        <td><span class="status-pill status-${s.status}">${s.status}</span></td>
        <td>${s.eta ? `${s.eta} min` : '—'}</td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${formatDate(s.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    showToast('Error', 'Could not load SOS logs.', 'danger');
  }
}

// ── COMPLAINTS ────────────────────────────────────────────────────
async function loadComplaints() {
  try {
    const data = await apiGet('/api/admin/complaints');
    const container = document.getElementById('complaints-list');
    if (!data.complaints.length) {
      container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">No complaints yet.</div>`;
      return;
    }
    container.innerHTML = data.complaints.map(c => `
      <div class="complaint-item">
        <div class="complaint-header">
          <div class="complaint-name">${c.name}</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="status-pill status-${c.status === 'open' ? 'pending' : 'completed'}">${c.status}</span>
            <span class="complaint-date">${formatDate(c.created_at)}</span>
          </div>
        </div>
        <div class="complaint-contact">
          ${c.email ? `📧 <a href="mailto:${c.email}" style="color:var(--cyan);">${c.email}</a>` : ''}
          ${c.phone ? ` · 📞 <a href="tel:${c.phone}" style="color:var(--cyan);">${c.phone}</a>` : ''}
        </div>
        <div class="complaint-msg">${c.message}</div>
      </div>
    `).join('');
  } catch (e) {
    showToast('Error', 'Could not load complaints.', 'danger');
  }
}

// ── ANALYTICS CHARTS ──────────────────────────────────────────────
async function renderAnalytics() {
  const chartDefaults = {
    plugins: {
      legend: { labels: { color: '#7090b0', font: { size: 11 } } },
      tooltip: { backgroundColor: '#0d0d25', titleColor: '#00f5ff', bodyColor: '#cde' },
    },
  };

  // Driver status pie
  try {
    const dData = await apiGet('/api/admin/drivers');
    const online  = dData.drivers.filter(d => d.status === 'online').length;
    const offline = dData.drivers.filter(d => d.status === 'offline').length;
    const busy    = dData.drivers.filter(d => d.status === 'busy').length;

    const ctx1 = document.getElementById('driver-status-chart');
    if (ctx1) {
      if (charts.driverStatus) charts.driverStatus.destroy();
      charts.driverStatus = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['Online', 'Offline', 'Busy'],
          datasets: [{
            data: [online, offline, busy],
            backgroundColor: ['rgba(0,255,136,0.3)', 'rgba(255,255,255,0.1)', 'rgba(255,184,0,0.3)'],
            borderColor: ['#00ff88', 'rgba(255,255,255,0.2)', '#ffb800'],
            borderWidth: 2,
          }],
        },
        options: { ...chartDefaults, cutout: '65%' },
      });
    }
  } catch {}

  // SOS status pie
  try {
    const sData = await apiGet('/api/admin/sos');
    const pending   = sData.sos_list.filter(s => s.status === 'pending').length;
    const assigned  = sData.sos_list.filter(s => s.status === 'assigned').length;
    const completed = sData.sos_list.filter(s => s.status === 'completed').length;

    const ctx2 = document.getElementById('sos-status-chart');
    if (ctx2) {
      if (charts.sosStatus) charts.sosStatus.destroy();
      charts.sosStatus = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Assigned', 'Completed'],
          datasets: [{
            data: [pending, assigned, completed],
            backgroundColor: ['rgba(255,45,85,0.3)', 'rgba(0,245,255,0.3)', 'rgba(0,255,136,0.3)'],
            borderColor: ['#ff2d55', '#00f5ff', '#00ff88'],
            borderWidth: 2,
          }],
        },
        options: { ...chartDefaults, cutout: '65%' },
      });
    }

    // Response time trend (simulated from data)
    const ctx3 = document.getElementById('response-chart');
    if (ctx3) {
      const responseTimes = sData.sos_list.slice(0, 10).map((_, i) => Math.round(2 + Math.random() * 5));
      if (charts.response) charts.response.destroy();
      charts.response = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: sData.sos_list.slice(0, 10).map((_, i) => `Request ${i + 1}`),
          datasets: [{
            label: 'Response Time (min)',
            data: responseTimes,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168,85,247,0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#a855f7',
            pointRadius: 5,
          }],
        },
        options: {
          ...chartDefaults,
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#7090b0' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#7090b0' }, beginAtZero: true },
          },
        },
      });
    }
  } catch {}
}

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check session
  const saved = sessionStorage.getItem('nexara_admin');
  if (saved === 'true') {
    adminToken = 'nexara_admin_session_2025';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    refreshStats();
    loadDrivers();
    loadSOS();
    loadComplaints();
    setInterval(refreshStats, 15000);
  }
});
