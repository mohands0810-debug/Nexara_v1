/* ═══════════════════════════════════════════════════════════════
   NEXARA — Socket.IO Client (socket.js)
   ═══════════════════════════════════════════════════════════════ */

let _socket = null;
const _listeners = {};

function initSocket() {
  if (_socket) return _socket;

  _socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.log('[Socket] Connected:', _socket.id);
    updateConnectionStatus(true);
    // Re-request drivers on reconnect
    _socket.emit('request_drivers', {});
    if (window._onSocketConnect) window._onSocketConnect();
  });

  _socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    updateConnectionStatus(false);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
    updateConnectionStatus(false);
  });

  // Forward all events to registered listeners
  const events = [
    'drivers_update', 'driver_moved', 'sos_assigned',
    'sos_pending', 'sos_list_update',
  ];
  events.forEach(evt => {
    _socket.on(evt, (data) => {
      if (_listeners[evt]) _listeners[evt].forEach(fn => fn(data));
    });
  });

  return _socket;
}

function onSocket(event, fn) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(fn);
}

function emitSocket(event, data) {
  if (_socket && _socket.connected) {
    _socket.emit(event, data);
  }
}

function updateConnectionStatus(online) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.className = `status-pill ${online ? 'status-online' : 'status-offline'}`;
  el.textContent = online ? 'Live' : 'Reconnecting…';
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only init socket on pages that need it (have socket.io available)
  if (typeof io !== 'undefined') {
    initSocket();
  }
});

window.NexSocket = { initSocket, onSocket, emitSocket, get socket() { return _socket; } };
