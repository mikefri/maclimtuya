// ============================================================
//  Airton Tuya Cloud Controller — app.js (Vercel)
//  Les appels API sont relatifs : /api/device/... 
//  (même domaine que le frontend, pas besoin de configurer l'URL)
// ============================================================

const CONFIG_KEY = 'airton_config';

// ── State ────────────────────────────────────────────────────
let state = {
  power: false, temp: 22, mode: 'cool', fanSpeed: 'auto',
  swingV: false, swingH: false, sleep: false, eco: false,
};

let deviceId = '';

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const powerBtn    = $('powerBtn');
const tempDisplay = $('tempDisplay');
const statusDot   = $('statusDot');
const statusText  = $('statusText');
const loading     = $('loading');
const toast       = $('toast');

// ── Init ─────────────────────────────────────────────────────
(function init() {
  const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  deviceId = saved.deviceId || '';
  $('deviceId').value = deviceId;
  bindEvents();
  if (deviceId) { fetchStatus(); $('diagBtn').style.display = 'block'; }
  else openConfig();
})();

// ── Config ────────────────────────────────────────────────────
function openConfig() {
  $('configBody').classList.add('open');
  $('configToggleIcon').classList.add('open');
}

$('saveConfig').addEventListener('click', () => {
  deviceId = $('deviceId').value.trim();
  if (!deviceId) { showToast('⚠️ Entrez un Device ID', 'error'); return; }
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ deviceId }));
  $('diagBtn').style.display = 'block';
  showToast('✅ Enregistré', 'success');
  fetchStatus();
});

$('diagBtn').addEventListener('click', async () => {
  const out = $('diagOutput');
  out.style.display = 'block';
  out.textContent = 'Chargement...';
  try {
    const res  = await fetch(`/api/functions/${deviceId}`);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = 'Erreur : ' + err.message;
  }
});

$('configHeader').addEventListener('click', () => {
  $('configBody').classList.toggle('open');
  $('configToggleIcon').classList.toggle('open');
});

// ── Events ────────────────────────────────────────────────────
function bindEvents() {
  powerBtn.addEventListener('click', () => sendCommand('switch', !state.power));

  $('tempUp').addEventListener('click', () => {
    if (state.temp < 30) sendCommand('temp_set', state.temp + 1);
  });
  $('tempDown').addEventListener('click', () => {
    if (state.temp > 16) sendCommand('temp_set', state.temp - 1);
  });

  document.querySelectorAll('.mode-btn').forEach(btn =>
    btn.addEventListener('click', () => sendCommand('mode', btn.dataset.mode))
  );
  document.querySelectorAll('.fan-btn').forEach(btn =>
    btn.addEventListener('click', () => sendCommand('fan_speed_enum', btn.dataset.speed))
  );

  $('swingVToggle').addEventListener('click', () => sendCommand('swing_vertical',   !state.swingV));
  $('swingHToggle').addEventListener('click', () => sendCommand('swing_horizontal', !state.swingH));
  $('sleepToggle').addEventListener('click',  () => sendCommand('sleep',            !state.sleep));
  $('ecoToggle').addEventListener('click',    () => sendCommand('eco',              !state.eco));
}

// ── API ───────────────────────────────────────────────────────
async function fetchStatus() {
  if (!deviceId) return;
  showLoading(true);
  try {
    const res  = await fetch(`/api/device/${deviceId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // data est un tableau [{ code, value }, ...]
    data.forEach(({ code, value }) => applyProp(code, value));
    setOnline(true);
    renderUI();
  } catch (err) {
    setOnline(false);
    showToast('❌ Impossible de lire l\'état', 'error');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

async function sendCommand(code, value) {
  if (!deviceId) { showToast('⚠️ Configurez le Device ID', 'error'); return; }

  // Optimistic UI
  applyProp(code, value);
  renderUI();

  showLoading(true);
  try {
    const res = await fetch(`/api/device/${deviceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, value }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    showToast('✅ Commande envoyée', 'success');
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
    console.error(err);
    // Rafraîchit l'état réel en cas d'erreur
    fetchStatus();
  } finally {
    showLoading(false);
  }
}

// ── State ─────────────────────────────────────────────────────
function applyProp(code, value) {
  const map = {
    switch: 'power', temp_set: 'temp', mode: 'mode',
    fan_speed_enum: 'fanSpeed', swing_vertical: 'swingV',
    swing_horizontal: 'swingH', sleep: 'sleep', eco: 'eco',
  };
  const key = map[code];
  if (!key) return;
  // temp_set vient de Tuya en dixièmes (220 → 22)
  state[key] = code === 'temp_set' ? Math.round(value / 10) : value;
}

// ── Render ────────────────────────────────────────────────────
function renderUI() {
  powerBtn.classList.toggle('on',  state.power);
  powerBtn.classList.toggle('off', !state.power);
  tempDisplay.textContent = state.temp;

  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode)
  );
  document.querySelectorAll('.fan-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.speed === state.fanSpeed)
  );
  $('swingVToggle').classList.toggle('active', state.swingV);
  $('swingHToggle').classList.toggle('active', state.swingH);
  $('sleepToggle').classList.toggle('active',  state.sleep);
  $('ecoToggle').classList.toggle('active',    state.eco);
}

// ── Helpers ───────────────────────────────────────────────────
function setOnline(on) {
  statusDot.className   = 'dot ' + (on ? 'online' : 'offline');
  statusText.textContent = on ? 'En ligne' : 'Hors ligne';
}

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = 'toast ' + type;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function showLoading(show) {
  loading.classList.toggle('show', show);
}

// Auto-refresh toutes les 30 secondes
setInterval(() => { if (deviceId) fetchStatus(); }, 30_000);
