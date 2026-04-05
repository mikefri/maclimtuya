// app.js — Airton Tuya Controller (codes réels de l'appareil)

const CONFIG_KEY = 'airton_config';

let state = {
  power: false, temp: 22, tempCurrent: null,
  mode: 'auto', fanSpeed: 'auto', windshake: 'off',
  sleep: false, eco: false, health: false, light: false,
};
let deviceId = '';

const $ = id => document.getElementById(id);
const powerBtn   = $('powerBtn');
const tempDisplay = $('tempDisplay');
const tempCurrent = $('tempCurrent');
const statusDot  = $('statusDot');
const statusText = $('statusText');
const loading    = $('loading');
const toast      = $('toast');

(function init() {
  const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  deviceId = saved.deviceId || '';
  $('deviceId').value = deviceId;
  bindEvents();
  if (deviceId) { fetchStatus(); $('diagBtn').style.display = 'block'; }
  else openConfig();
})();

function openConfig() {
  $('configBody').classList.add('open');
  $('configToggleIcon').classList.add('open');
}

$('configHeader').addEventListener('click', () => {
  $('configBody').classList.toggle('open');
  $('configToggleIcon').classList.toggle('open');
});

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
    const res = await fetch(`/api/device/${deviceId}?action=functions`);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = 'Erreur : ' + err.message;
  }
});

function bindEvents() {
  powerBtn.addEventListener('click', () => sendCommand('Power', !state.power));

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
    btn.addEventListener('click', () => sendCommand('windspeed', btn.dataset.speed))
  );
  document.querySelectorAll('.swing-btn').forEach(btn =>
    btn.addEventListener('click', () => sendCommand('windshake', btn.dataset.shake))
  );

  $('sleepToggle').addEventListener('click',  () => sendCommand('sleep',    !state.sleep));
  $('ecoToggle').addEventListener('click',    () => sendCommand('mode_ECO', !state.eco));
  $('healthToggle').addEventListener('click', () => sendCommand('health',   !state.health));
  $('lightToggle').addEventListener('click',  () => sendCommand('light',    !state.light));
}

async function fetchStatus() {
  if (!deviceId) return;
  showLoading(true);
  try {
    const res = await fetch(`/api/device/${deviceId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    data.forEach(({ code, value }) => applyProp(code, value));
    renderUI();
    setOnline(true);
    updateLastSync();
  } catch (err) {
    setOnline(false);
    showToast('❌ Impossible de lire l\'état', 'error');
  } finally {
    showLoading(false);
  }
}

async function sendCommand(code, value) {
  if (!deviceId) { showToast('⚠️ Configurez le Device ID', 'error'); return; }
  applyProp(code, value); renderUI();
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
    fetchStatus();
  } finally {
    showLoading(false);
  }
}

function applyProp(code, value) {
  switch (code) {
    case 'Power':       state.power      = value; break;
    case 'temp_set':    state.temp       = Math.round(value / 10); break;
    case 'temp_current':state.tempCurrent= Math.round(value / 10); break;
    case 'mode':        state.mode       = value; break;
    case 'windspeed':   state.fanSpeed   = value; break;
    case 'windshake':   state.windshake  = value; break;
    case 'sleep':       state.sleep      = value; break;
    case 'mode_ECO':    state.eco        = value; break;
    case 'health':      state.health     = value; break;
    case 'light':       state.light      = value; break;
  }
}

function updateLastSync() {
  const el = $('lastSync');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `Actualisé à ${hh}:${mm}`;
}

function renderUI() {
  powerBtn.classList.toggle('on',  state.power);
  powerBtn.classList.toggle('off', !state.power);
  tempDisplay.textContent = state.temp;
  tempCurrent.textContent = state.tempCurrent !== null ? `${state.tempCurrent}°C` : '—';

  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode)
  );
  document.querySelectorAll('.fan-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.speed === state.fanSpeed)
  );
  document.querySelectorAll('.swing-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.shake === state.windshake)
  );

  $('sleepToggle').classList.toggle('active',  state.sleep);
  $('ecoToggle').classList.toggle('active',    state.eco);
  $('healthToggle').classList.toggle('active', state.health);
  $('lightToggle').classList.toggle('active',  state.light);
}

function setOnline(on) {
  statusDot.className    = 'dot ' + (on ? 'online' : 'offline');
  statusText.textContent = on ? 'En ligne' : 'Hors ligne';
}

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function showLoading(show) { loading.classList.toggle('show', show); }

setInterval(() => { if (deviceId) fetchStatus(); }, 30_000);
