const $ = (s) => document.querySelector(s);
let state = null;

const api = window.cockpit;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// A synthesized "sad trombone" (wah-wah-waaah) — the universal sound of "not yet!". No audio asset needed.
function playFunnySound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    const notes = [233.08, 220.00, 207.65]; // Bb3, A3, Ab3 — descending
    const step = 0.24;
    notes.forEach((f, i) => {
      const t = t0 + i * step;
      const last = i === notes.length - 1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1100;       // muffled, trombone-ish
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      const len = last ? 0.6 : step * 0.9;
      if (last) {
        osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.55); // the "waaah" bend down
        const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
        lfo.type = 'sine'; lfo.frequency.value = 6.5; lfoGain.gain.value = 6; // wobble/vibrato
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start(t); lfo.stop(t + len);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(lp).connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + len + 0.05);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1700);
  } catch {}
}

// Representative state used only when there's no Electron bridge (i.e. a plain-browser preview),
// so the panel renders fully populated for design review. In the real app, api.getState() always wins.
const DEMO_STATE = {
  installed: true,
  masterEnabled: true,
  games: [
    { name: 'Assetto Corsa', exe: 'acs.exe', enabled: true, calibrated: true },
    { name: 'iRacing', exe: 'iRacingSim64DX11.exe', enabled: true, calibrated: false },
    { name: 'Automobilista 2', exe: 'AMS2AVX.exe', enabled: false, calibrated: false },
  ],
  known: [
    { name: 'Assetto Corsa Competizione', exe: 'acc.exe' },
    { name: 'DiRT Rally 2.0', exe: 'dirtrally2.exe' },
    { name: 'rFactor 2', exe: 'rFactor2.exe' },
    { name: 'RaceRoom', exe: 'RRRE64.exe' },
  ],
};

async function refresh(next) {
  if (!api) { state = DEMO_STATE; render(); return; }
  state = next || await api.getState();
  render();
}

function setLamp(id, cls, text) {
  const el = $('#' + id);
  if (!el) return;
  el.className = 'lamp' + (cls ? ' ' + cls : '');
  el.querySelector('.lamp-state').textContent = text;
}

function render() {
  $('#master').checked = state.masterEnabled;

  const installed = !!state.installed;
  const armed = installed && state.masterEnabled;

  // Dashboard lamps
  setLamp('lampLayer',  installed ? 'on' : 'warn', installed ? 'ACTIVE' : 'OFFLINE');
  setLamp('lampAnchor', !installed ? 'off' : armed ? 'live' : 'warn', !installed ? 'STANDBY' : armed ? 'ARMED' : 'PAUSED');
  setLamp('lampFix',    installed ? 'on' : 'off', installed ? 'ON' : '—');

  // Install action lives under the cluster when the layer isn't registered yet
  const foot = $('#clusterFoot');
  foot.innerHTML = '';
  if (!installed) {
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = 'Install layer';
    btn.onclick = async () => { btn.textContent = 'Installing…'; await api.installLayer(); setTimeout(async () => refresh(await api.getState()), 1500); };
    foot.appendChild(btn);
  }

  const g = $('#games');
  g.innerHTML = '';
  if (!state.games.length) { g.innerHTML = '<div class="empty">No games yet — add one below.</div>'; }
  state.games.forEach((game) => g.appendChild(gameCard(game)));

  const k = $('#known');
  k.innerHTML = '';
  state.known
    .filter((kg) => !state.games.some((x) => x.exe.toLowerCase() === kg.exe.toLowerCase()))
    .forEach((kg) => {
      const c = document.createElement('button');
      c.className = 'chip'; c.textContent = kg.name;
      c.onclick = async () => refresh(await api.addKnown(kg.exe, kg.name));
      k.appendChild(c);
    });
}

function gameCard(game) {
  const el = document.createElement('div');
  const lit = game.enabled && game.calibrated;
  el.className = 'game' + (game.enabled ? '' : ' off') + (lit ? ' lit' : '');
  const [cls, label] = !game.enabled
    ? ['off', 'OFFLINE']
    : game.calibrated
      ? ['live', 'SEAT LOCKED']
      : ['warn', 'CALIBRATE · CTRL+SHIFT+S'];
  el.innerHTML = `
    <div class="g-icon">${game.icon ? `<img class="g-img" src="${esc(game.icon)}" alt="">` : '<div class="wheel"></div>'}</div>
    <div class="g-main">
      <div class="g-name">${esc(game.name)}</div>
      <div class="g-sub"><span class="dot ${cls}"></span>${label}</div>
      <div class="g-exe">${esc(game.exe)}</div>
    </div>
    <div class="g-actions">
      <button class="icon" data-act="clear" title="Clear saved seat">&#8634;</button>
      <button class="icon danger" data-act="remove" title="Remove game">&#10005;</button>
      <label class="switch"><input type="checkbox" data-act="toggle" ${game.enabled ? 'checked' : ''}><span class="slider"></span></label>
    </div>`;
  el.querySelector('[data-act="toggle"]').onchange = async (e) => refresh(await api.toggleGame(game.exe, e.target.checked));
  el.querySelector('[data-act="clear"]').onclick = async () => { if (confirm(`Clear the saved seat for ${game.name}? You'll recalibrate in-game with Ctrl+Shift+S.`)) refresh(await api.clearAnchor(game.exe)); };
  el.querySelector('[data-act="remove"]').onclick = async () => { if (confirm(`Remove ${game.name} from the list?`)) refresh(await api.removeGame(game.exe)); };
  return el;
}

/* ---------- updates ---------- */
let surfaceReady = false;
let pendingUpdate = null;

function showUpdateNotice(p) {
  const el = $('#updateNotice');
  if (!el || el.dataset.v === p.version) return;
  el.dataset.v = p.version;
  el.hidden = false;
  el.innerHTML = `<span class="dot ok"></span><span>Update available · <b>${esc(p.version)}</b></span>`;
  const btn = document.createElement('button');
  btn.className = 'btn small'; btn.id = 'upBtn';
  el.appendChild(btn);
  wireUpdateButton(btn, p);
}

async function wireUpdateButton(btn, p) {
  const selfInstall = await (api && api.canSelfInstall ? api.canSelfInstall().catch(() => false) : false);
  if (!selfInstall) {
    btn.textContent = 'Get the update';
    btn.onclick = () => api.openExternal(p.releaseUrl || p.downloadUrl);
    return;
  }
  let st = 'idle';
  btn.textContent = 'Get the update';
  btn.onclick = async () => {
    if (st === 'idle') {
      // download + stage the installer in the background; the silent install runs on restart
      st = 'downloading'; btn.disabled = true; btn.textContent = 'Getting update…';
      const r = await api.downloadUpdate(p.downloadUrl);
      if (!r || !r.ok) { st = 'idle'; btn.disabled = false; btn.textContent = 'Update failed — retry'; return; }
      st = 'ready'; btn.disabled = false; btn.classList.add('ready'); btn.textContent = 'Click to restart';
    } else if (st === 'ready') {
      st = 'restarting'; btn.disabled = true; btn.textContent = 'Restarting…'; api.applyUpdate();
    }
  };
}

if (api) {
  api.onUpdateAvailable((p) => { if (surfaceReady) showUpdateNotice(p); else pendingUpdate = p; });
  api.onUpdateProgress(({ downloaded, total }) => {
    const btn = $('#upBtn'); if (!btn) return;
    btn.textContent = total > 0 ? `Installing… ${Math.floor((downloaded / total) * 100)}%` : `Installing… ${(downloaded / 1048576).toFixed(1)} MB`;
  });
  api.getAppVersion().then((v) => { const e = document.querySelector('.ver'); if (e && v) e.textContent = 'v' + v; });

  $('#master').onchange = async (e) => refresh(await api.setMaster(e.target.checked));
  $('#addGame').onclick = async () => refresh(await api.addGame());
  $('#openLogs').onclick = () => api.openLogs();
  $('#openData').onclick = () => api.openData();
  $('#uninstall').onclick = async () => { if (confirm('Uninstall the Cockpit Anchor layer? Your saved seats are kept.')) { await api.uninstallLayer(); setTimeout(async () => refresh(await api.getState()), 1500); } };
  $('#min').onclick = () => api.win('min');
  $('#close').onclick = () => api.win('close');
  $('#checkUpdates').onclick = async () => {
    const b = $('#checkUpdates'); const orig = b.textContent; b.disabled = true; b.textContent = 'Checking…';
    const r = await api.checkForUpdates().catch(() => ({ status: 'error' }));
    if (r.status === 'available') { b.textContent = `${r.version} available!`; showUpdateNotice(r); }
    else if (r.status === 'up-to-date') b.textContent = 'Up to date ✓';
    else b.textContent = 'Check failed';
    setTimeout(() => { b.disabled = false; b.textContent = orig; }, 2500);
  };
}

const comingSoonBtn = $('#comingSoon');
if (comingSoonBtn) comingSoonBtn.onclick = () => playFunnySound();

refresh().then(() => { surfaceReady = true; if (pendingUpdate) { showUpdateNotice(pendingUpdate); pendingUpdate = null; } });
