const sheetEl = document.getElementById('sheet');
const sheetTitleEl = document.getElementById('sheetTitle');
const sheetBodyEl = document.getElementById('sheetBody');
// Full remote and compact widget each carry a power key, an LED and a status line.
const powerKeys = document.querySelectorAll('.key.power');
const statusEls = document.querySelectorAll('[data-status]');
const ledEls = document.querySelectorAll('.led');

// The widget is too narrow for the full sentence, so it gets the short form.
function setStatus(text, cls, short) {
  statusEls.forEach((el) => { el.textContent = el.hasAttribute('data-short') ? (short || text) : text; });
  ledEls.forEach((el) => { el.className = 'led ' + cls; });
}

let lastStatus = { connected: false };
let appCache = null;

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.result;
}

function parseCmd(str) {
  // "POST /api/path" or 'POST /api/path {"json":true}'
  const spaceIdx = str.indexOf(' ');
  const method = str.slice(0, spaceIdx);
  const rest = str.slice(spaceIdx + 1);
  const braceIdx = rest.indexOf(' {');
  if (braceIdx === -1) return { method, url: rest, body: null };
  return { method, url: rest.slice(0, braceIdx), body: JSON.parse(rest.slice(braceIdx + 1)) };
}

function flashErr(el) {
  if (!el) return;
  el.classList.add('flash-err');
  setTimeout(() => el.classList.remove('flash-err'), 500);
}

function showError(message, el) {
  flashErr(el);
  setStatus('שגיאה: ' + message, 'led-err', 'שגיאה');
}

async function runCmd(str, el) {
  const { method, url, body } = parseCmd(str);
  try {
    const result = await call(method, url, body);
    if (url === '/api/mute/toggle' && result) setMuted(result.mute);
    return result;
  } catch (err) {
    showError(err.message, el);
    return null;
  }
}

function setMuted(on) {
  document.querySelectorAll('.key.mute').forEach((b) => b.classList.toggle('is-muted', !!on));
}

/* ---------- key presses, with hold-to-repeat like the hardware ---------- */

const HOLD_DELAY = 420;
const HOLD_INTERVAL = 170;
let holdTimer = null;
let holdInterval = null;

function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdInterval);
  holdTimer = holdInterval = null;
  document.querySelectorAll('.pressed').forEach((el) => el.classList.remove('pressed'));
}

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-cmd]');
  if (!el || e.button !== 0) return;
  el.classList.add('pressed');
  runCmd(el.dataset.cmd, el);
  if (el.dataset.repeat !== '1') return;
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => runCmd(el.dataset.cmd, el), HOLD_INTERVAL);
  }, HOLD_DELAY);
});

document.addEventListener('pointerup', stopHold);
document.addEventListener('pointercancel', stopHold);
window.addEventListener('blur', stopHold);

/* Keyboard: the app window is the remote, so the obvious keys should just work. */
const KEY_MAP = {
  ArrowUp: 'POST /api/button/UP',
  ArrowDown: 'POST /api/button/DOWN',
  ArrowLeft: 'POST /api/button/LEFT',
  ArrowRight: 'POST /api/button/RIGHT',
  Enter: 'POST /api/button/ENTER',
  Backspace: 'POST /api/button/BACK',
  Escape: 'POST /api/button/EXIT',
  ' ': 'POST /api/media/pause',
  h: 'POST /api/button/HOME',
  m: 'POST /api/mute/toggle',
  '+': 'POST /api/volume/up',
  '=': 'POST /api/volume/up',
  '-': 'POST /api/volume/down',
};

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches('input, textarea')) return;
  if (!sheetEl.hidden && e.key === 'Escape') { closeSheet(); e.preventDefault(); return; }
  const cmd = KEY_MAP[e.key] || (/^[0-9]$/.test(e.key) ? `POST /api/button/${e.key}` : null);
  if (!cmd) return;
  e.preventDefault();
  runCmd(cmd, null);
});

/* ---------- power: one key, same as the physical remote ---------- */

powerKeys.forEach((btn) => btn.addEventListener('click', async () => {
  const turnOn = !lastStatus.connected;
  const res = await runCmd(turnOn ? 'POST /api/power/on' : 'POST /api/power/off', btn);
  if (res !== null) {
    const msg = turnOn ? 'שולח Wake-on-LAN...' : 'מכבה...';
    statusEls.forEach((el) => { el.textContent = msg; });
    setTimeout(refreshStatus, 1500);
  }
}));

/* ---------- status ---------- */

async function refreshStatus() {
  try {
    const s = await (await fetch('/api/status')).json();
    lastStatus = s;
    if (s.keyError) {
      // The pairing key could not be persisted, so the TV will prompt again next launch.
      setStatus('שמירת מפתח החיבור נכשלה — האישור יידרש שוב', 'led-err', 'שמירת מפתח נכשלה');
    } else if (s.connected) {
      setStatus(`מחובר · ${s.ip}`, 'led-ok', 'מחובר');
    } else if (s.awaitingAuth) {
      setStatus('אשר פעם אחת על מסך הטלוויזיה — האישור יישמר', 'led-warn', 'אשר בטלוויזיה');
    } else {
      setStatus(`מחפש את הטלוויזיה · ${s.ip}`, 'led-warn', 'מחפש טלוויזיה');
    }
    powerKeys.forEach((btn) => {
      btn.classList.toggle('on-state', !s.connected);
      btn.title = s.connected ? 'כיבוי' : 'הדלקה (Wake-on-LAN)';
    });
  } catch {
    lastStatus = { connected: false };
    setStatus('השרת המקומי לא זמין', 'led-err', 'השרת לא זמין');
  }
}

/* ---------- apps ---------- */

const HOTKEY_STYLES = [
  { match: /netflix/i, cls: 'netflix', label: 'NETFLIX' },
  { match: /youtube/i, cls: 'youtube', label: 'YouTube' },
  { match: /disney/i, cls: 'disney', label: 'Disney+' },
  { match: /prime video|amazon/i, cls: 'prime', label: 'prime video' },
];

async function loadApps() {
  if (appCache) return appCache;
  const res = await call('GET', '/api/apps');
  appCache = (res.launchPoints || [])
    .filter((a) => a.title)
    .sort((a, b) => a.title.localeCompare(b.title, 'he'));
  return appCache;
}

// TV icon URLs are https with a self-signed cert; go through the local proxy.
function iconUrl(raw) {
  return /^https?:/i.test(raw || '') ? `/api/icon?url=${encodeURIComponent(raw)}` : '';
}

function launchApp(id, el) {
  return runCmd(`POST /api/apps/launch {"id":${JSON.stringify(id)}}`, el);
}

async function buildHotkeys() {
  const host = document.getElementById('hotkeys');
  try {
    const apps = await loadApps();
    const chosen = [];
    for (const style of HOTKEY_STYLES) {
      const app = apps.find((a) => style.match.test(a.title) || style.match.test(a.id));
      if (app) chosen.push({ app, style });
    }
    host.innerHTML = '';
    for (const { app, style } of chosen) {
      const btn = document.createElement('button');
      btn.className = `hotkey ${style.cls}`;
      btn.textContent = style.label;
      btn.title = app.title;
      btn.addEventListener('click', () => launchApp(app.id, btn));
      host.appendChild(btn);
    }
    if (!chosen.length) host.innerHTML = '';
  } catch {
    host.innerHTML = '';
  }
}

/* ---------- sheets ---------- */

function openSheet(title, render) {
  sheetTitleEl.textContent = title;
  sheetBodyEl.innerHTML = '<div class="empty">טוען...</div>';
  sheetEl.hidden = false;
  render(sheetBodyEl);
}

function closeSheet() {
  sheetEl.hidden = true;
  sheetBodyEl.innerHTML = '';
}

document.getElementById('sheetClose').addEventListener('click', closeSheet);
sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) closeSheet(); });

const SHEETS = {
  apps: () => openSheet('אפליקציות', async (body) => {
    try {
      const apps = await loadApps();
      if (!apps.length) { body.innerHTML = '<div class="empty">לא נמצאו אפליקציות</div>'; return; }
      const grid = document.createElement('div');
      grid.className = 'tile-grid';
      for (const app of apps) {
        const tile = document.createElement('button');
        tile.className = 'tile';
        const icon = iconUrl(app.icon);
        tile.innerHTML = `${icon ? `<img src="${icon}" alt="" onerror="this.remove()" />` : ''}<span></span>`;
        tile.querySelector('span').textContent = app.title;
        tile.addEventListener('click', () => { launchApp(app.id, tile); closeSheet(); });
        grid.appendChild(tile);
      }
      body.innerHTML = '';
      body.appendChild(grid);
    } catch (err) {
      body.innerHTML = '<div class="empty"></div>';
      body.firstChild.textContent = 'לא ניתן לטעון אפליקציות: ' + err.message;
    }
  }),

  inputs: () => openSheet('מקורות', async (body) => {
    try {
      const res = await call('GET', '/api/inputs');
      const devices = res.devices || [];
      if (!devices.length) { body.innerHTML = '<div class="empty">לא נמצאו מקורות</div>'; return; }
      const grid = document.createElement('div');
      grid.className = 'tile-grid';
      for (const dev of devices) {
        const tile = document.createElement('button');
        tile.className = 'tile' + (dev.connected ? '' : ' off');
        tile.innerHTML = '<span></span>';
        tile.querySelector('span').textContent = dev.label || dev.id;
        tile.title = dev.connected ? 'מחובר' : 'לא מחובר';
        tile.addEventListener('click', () => {
          runCmd(`POST /api/input {"inputId":${JSON.stringify(dev.id)}}`, tile);
          closeSheet();
        });
        grid.appendChild(tile);
      }
      body.innerHTML = '';
      body.appendChild(grid);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'מקורות מעומעמים אינם מחוברים כרגע.';
      body.appendChild(hint);
    } catch (err) {
      body.innerHTML = '<div class="empty"></div>';
      body.firstChild.textContent = 'לא ניתן לטעון מקורות: ' + err.message;
    }
  }),

  toast: () => openSheet('הודעה למסך הטלוויזיה', (body) => {
    body.innerHTML = `
      <div class="composer">
        <input id="toastMsg" type="text" placeholder="כתוב הודעה שתקפוץ במסך" />
        <button id="toastSend">שלח</button>
      </div>
      <p class="hint">ההודעה תופיע כ-Toast בפינת מסך הטלוויזיה.</p>
    `;
    const input = body.querySelector('#toastMsg');
    const send = async () => {
      const msg = input.value.trim();
      if (!msg) return;
      const res = await runCmd(`POST /api/toast {"message":${JSON.stringify(msg)}}`, null);
      if (res !== null) closeSheet();
    };
    body.querySelector('#toastSend').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();
  }),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-sheet]');
  if (el) SHEETS[el.dataset.sheet]();
});

/* ---------- compact (widget) mode ---------- */

const COMPACT_PREF = 'remotec:compact';
// Present only inside the Electron shell; in a plain browser tab the layout still
// switches, there is just no window to resize.
const shell = window.remoteShell;
let compact = false;

function setCompact(on) {
  compact = !!on;
  document.body.classList.toggle('is-compact', compact);
  // A sheet opened from the full remote has nowhere to go at widget size.
  if (compact && !sheetEl.hidden) closeSheet();
  try { localStorage.setItem(COMPACT_PREF, compact ? '1' : '0'); } catch { /* private mode */ }
  if (shell) shell.setCompact(compact);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-compact]');
  if (el) setCompact(el.dataset.compact === '1');
});

if (shell) {
  document.body.classList.add('is-shell');
  shell.onToggleCompact(() => setCompact(!compact));
}

/* ---------- boot ---------- */

try {
  if (localStorage.getItem(COMPACT_PREF) === '1') setCompact(true);
} catch { /* private mode */ }

refreshStatus();
setInterval(refreshStatus, 3000);

async function initFromTv() {
  try {
    const audio = await call('GET', '/api/audio');
    setMuted(audio.mute);
  } catch { /* TV not ready yet */ }
  buildHotkeys();
}
setTimeout(initFromTv, 1200);
