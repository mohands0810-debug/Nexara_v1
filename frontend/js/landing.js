/* ═══════════════════════════════════════════════════════════════
   NEXARA — Landing Page JS (landing.js)
   ═══════════════════════════════════════════════════════════════ */

async function loadLiveStats() {
  try {
    const data = await apiGet('/api/admin/stats');
    const dEl = document.getElementById('stat-drivers');
    const sEl = document.getElementById('stat-sos');
    if (dEl) dEl.textContent = data.active_drivers ?? 0;
    if (sEl) sEl.textContent = data.pending_sos ?? 0;

    // Hero card — response time
    const rt = document.getElementById('count-response');
    if (rt && data.avg_response_min) rt.textContent = data.avg_response_min;
  } catch {
    // Backend might not be running — silently fail on landing page
  }
}

// Parallax on hero text
function initParallax() {
  document.addEventListener('mousemove', (e) => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 20;
    const my = (e.clientY / window.innerHeight - 0.5) * 20;
    const hero = document.querySelector('.hero-title');
    if (hero) hero.style.transform = `translate(${mx * 0.3}px, ${my * 0.3}px)`;
    const cards = document.querySelectorAll('.hero-card');
    cards.forEach((c, i) => {
      c.style.transform = `translate(${mx * (0.1 + i * 0.05)}px, ${my * (0.1 + i * 0.05)}px)`;
    });
  });
}

// Intersection observer for fade-in
function initScrollReveal() {
  const els = document.querySelectorAll('.step-card, .feature-card, .glass-card');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'fade-in-up 0.6s ease forwards';
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => { el.style.opacity = '0'; obs.observe(el); });
}

document.addEventListener('DOMContentLoaded', () => {
  loadLiveStats();
  setInterval(loadLiveStats, 10000);
  initParallax();
  setTimeout(initScrollReveal, 100);
});
