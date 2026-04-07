/* ═══════════════════════════════════════════════════════════════
   NEXARA — Chatbot Assistant (chatbot.js)
   Uses Anthropic Claude API for intelligent responses
   ═══════════════════════════════════════════════════════════════ */

let chatOpen = false;
const chatHistory = [];

const BOT_SYSTEM = `You are ARIA (Automated Response Intelligence Assistant), the embedded AI assistant for NEXARA — a next-generation emergency ambulance dispatch platform.

NEXARA capabilities you know about:
- Emergency SOS: patients send SOS with GPS coordinates, system auto-assigns nearest ambulance
- Driver Portal: drivers register, toggle online/offline, auto-receive dispatch assignments
- Dispatch Center: live map view of all drivers and SOS incidents
- Admin Panel: system analytics, complaint management, driver oversight
- Real-time sync: all changes update instantly via WebSocket across all devices
- Auto-queue: SOS requests queue when no drivers are available and auto-assign on driver arrival

Be helpful, concise, and professional. For medical emergencies, always urge the user to use the SOS button immediately. For complaints, direct them to the chatbot complaint form.

Speak in a calm, authoritative, empathetic tone appropriate for an emergency system.`;

function toggleChatbot() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chatbot-panel');
  panel.classList.toggle('open', chatOpen);

  if (chatOpen && chatHistory.length === 0) {
    addBotMessage("Hello. I'm **ARIA**, NEXARA's AI assistant. I can help you with emergency procedures, system guidance, or complaints.\n\n🚨 If this is a medical emergency, please use the **SOS button** immediately rather than chatting.");
  }
}

function addBotMessage(text) {
  const el = document.getElementById('chatbot-messages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `<div class="chat-bubble">${text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function addUserMessage(text) {
  const el = document.getElementById('chatbot-messages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `<div class="chat-bubble">${text}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function addTypingIndicator() {
  const el = document.getElementById('chatbot-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="chat-bubble" style="color:var(--text-muted);">ARIA is thinking…</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  const text = input?.value.trim();
  if (!text) return;

  input.value = '';
  addUserMessage(text);
  chatHistory.push({ role: 'user', content: text });

  addTypingIndicator();

  // Simulate thinking delay for a natural feel
  await new Promise(r => setTimeout(r, 600));
  removeTypingIndicator();

  // Check for complaint keywords → show form
  if (text.toLowerCase().includes('complaint') || text.toLowerCase().includes('report an issue')) {
    showComplaintPrompt();
    return;
  }

  const reply = getFallbackResponse(text);
  chatHistory.push({ role: 'assistant', content: reply });
  addBotMessage(reply);
}

function getFallbackResponse(text) {
  const t = text.toLowerCase();

  if (t.includes('sos') || t.includes('emergency') || t.includes('ambulance') || t.includes('help'))
    return '🚨 For a medical emergency, please click the **SOS button** immediately on the Patient page. Do not delay — every second counts!\n\n➡️ Go to **Emergency SOS** page now.';

  if (t.includes('driver') && (t.includes('register') || t.includes('sign up') || t.includes('join')))
    return 'To register as a driver:\n1. Visit the **Driver Portal** page\n2. Enter your name, phone, and vehicle details\n3. Click **Register & Go Online**\n\nNEXARA will auto-remember you on future visits via local storage.';

  if (t.includes('driver') && t.includes('offline'))
    return 'Drivers can toggle their status using the **status switch** on the Driver Portal page. When offline, no SOS requests will be assigned to you.';

  if (t.includes('dispatch') || t.includes('center') || t.includes('command'))
    return 'The **Dispatch Center** at /dispatch.html shows a live map of all drivers and SOS incidents in real-time. No login required.';

  if (t.includes('admin') || t.includes('login') || t.includes('password') || t.includes('credential'))
    return '**Admin Panel** is at /admin.html\n\n🔐 Default credentials:\n**Username:** nexara_admin\n**Password:** nexara@2025\n\nYou can view stats, manage drivers, view SOS logs and complaints.';

  if (t.includes('complaint') || t.includes('feedback') || t.includes('report'))
    return 'I can log a complaint for you. Please say **"report an issue"** to open the complaint form, or fill it on the Admin page.';

  if (t.includes('how') || t.includes('work') || t.includes('steps'))
    return 'NEXARA works in 3 steps:\n1. 📱 Patient taps **SOS** — GPS coords sent instantly\n2. 🧠 AI auto-selects the nearest online driver using Haversine distance\n3. 🚑 Driver receives patient details and navigates live\n\nAll updates happen in real-time via WebSockets.';

  if (t.includes('gps') || t.includes('location') || t.includes('map'))
    return '📍 NEXARA uses your browser\'s GPS. When you open the SOS page, it auto-detects your location and reverse-geocodes the address.\n\nDrivers broadcast their GPS position every few seconds when online.';

  if (t.includes('assign') || t.includes('nearest') || t.includes('closest'))
    return '🤖 NEXARA uses the **Haversine formula** to calculate real Earth-surface distance between a patient and all online drivers. The nearest available driver is auto-assigned instantly.';

  if (t.includes('pending') || t.includes('queue') || t.includes('no driver') || t.includes('waiting'))
    return '⏳ If no drivers are online when an SOS is sent, it enters a **smart queue**. The moment any driver goes online, NEXARA auto-assigns them to the pending SOS.';

  if (t.includes('call') || t.includes('phone') || t.includes('contact'))
    return '📞 After dispatch, both the patient and driver can call each other directly using the **call link** shown on their respective screens.';

  if (t.includes('voice') || t.includes('speech') || t.includes('speak'))
    return '🎙️ Voice SOS is available on the Emergency SOS page. Click **Enable Voice SOS** and say "emergency", "help", "SOS", or "ambulance" to trigger an alert hands-free.';

  if (t.includes('status') || t.includes('online') || t.includes('available'))
    return '🟢 Driver statuses:\n**online** — available for dispatch\n**busy** — currently on a trip\n**offline** — not accepting calls\n\nDrivers can toggle between online/offline on the Driver Portal.';

  if (t.includes('stat') || t.includes('analytic') || t.includes('chart') || t.includes('dashboard'))
    return '📊 The **Admin Analytics** tab shows:\n- Driver status distribution (pie chart)\n- SOS status breakdown\n- Response time trends\n- Daily dispatch chart for last 7 days';

  if (t.includes('hello') || t.includes('hi') || t.includes('hey') || t.includes('greet'))
    return 'Hello! 👋 I\'m **ARIA**, NEXARA\'s AI assistant.\n\nI can help you with:\n• Emergency procedures\n• Driver registration\n• System navigation\n• Admin access\n• Complaints\n\nWhat do you need?';

  if (t.includes('thank'))
    return 'You\'re welcome! Stay safe and remember — in any medical emergency, use the 🚨 **SOS button** immediately. Every second counts.';

  return "I'm **ARIA**, your NEXARA assistant. Here's what I can help with:\n\n• 🚨 Emergency SOS procedures\n• 🚑 Driver registration & portal\n• 🛰️ Dispatch center guidance\n• 🔑 Admin panel access\n• 📩 Submitting complaints\n• 🗺️ GPS & map features\n\nJust ask me anything about NEXARA!";
}

function showComplaintPrompt() {
  addBotMessage('I can submit a complaint on your behalf. Please fill in the form below:');

  const el = document.getElementById('chatbot-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `
    <div class="chat-bubble" style="min-width:260px;">
      <div style="margin-bottom:10px; font-family:var(--font-display); font-size:0.7rem; letter-spacing:0.1em; color:var(--purple);">📩 SUBMIT COMPLAINT</div>
      <input id="cmp-name"  placeholder="Your name"    style="width:100%; margin-bottom:6px; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; color:#fff; font-size:0.85rem;" />
      <input id="cmp-email" placeholder="Email (opt.)" style="width:100%; margin-bottom:6px; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; color:#fff; font-size:0.85rem;" />
      <input id="cmp-phone" placeholder="Phone (opt.)" style="width:100%; margin-bottom:6px; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; color:#fff; font-size:0.85rem;" />
      <textarea id="cmp-msg" placeholder="Describe your complaint…" style="width:100%; margin-bottom:8px; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; color:#fff; font-size:0.85rem; resize:none; height:70px;"></textarea>
      <button onclick="submitComplaint()" style="width:100%; padding:8px; border:1px solid var(--purple); background:var(--purple-dim); color:var(--purple); border-radius:6px; cursor:pointer; font-family:var(--font-display); font-size:0.7rem; letter-spacing:0.08em;">SUBMIT →</button>
    </div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function submitComplaint() {
  const name  = document.getElementById('cmp-name')?.value.trim();
  const email = document.getElementById('cmp-email')?.value.trim();
  const phone = document.getElementById('cmp-phone')?.value.trim();
  const msg   = document.getElementById('cmp-msg')?.value.trim();

  if (!name || !msg) { addBotMessage('Please fill in your name and complaint message.'); return; }

  try {
    await apiPost('/api/complaints', { name, email, phone, message: msg });
    addBotMessage(`✅ Your complaint has been submitted, **${name}**. Our admin team will review it shortly. Thank you for your feedback.`);
  } catch {
    addBotMessage('⚠️ Could not submit complaint right now. Please try again or contact us directly.');
  }
}

// Enter key to send
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chatbot-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
});
