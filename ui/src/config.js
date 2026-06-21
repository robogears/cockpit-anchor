// config.js — reads/writes Cockpit Anchor's data files and checks install state.
// The GUI owns games.json (rich state) and DERIVES enabled-games.txt for the DLL.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DATA_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), 'CockpitAnchor');
const GAMES_JSON = path.join(DATA_DIR, 'games.json');
const ENABLED_TXT = path.join(DATA_DIR, 'enabled-games.txt');
const LOG = path.join(DATA_DIR, 'cockpit-anchor.log');

// Built-in known seated VR sims, for one-click "quick add" (manual-add model).
const KNOWN_GAMES = [
  { name: 'Assetto Corsa', exe: 'acs.exe' },
  { name: 'Assetto Corsa Competizione', exe: 'acc.exe' },
  { name: 'DiRT Rally 2.0', exe: 'dirtrally2.exe' },
  { name: 'iRacing', exe: 'iRacingSim64DX11.exe' },
  { name: 'Automobilista 2', exe: 'AMS2AVX.exe' },
  { name: 'rFactor 2', exe: 'rFactor2.exe' },
  { name: 'RaceRoom', exe: 'RRRE64.exe' },
  { name: 'Le Mans Ultimate', exe: 'Le Mans Ultimate.exe' },
];

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function defaultState() {
  return { masterEnabled: true, games: [{ name: 'Assetto Corsa', exe: 'acs.exe', enabled: true }] };
}

function load() {
  ensureDir();
  try {
    const s = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    if (!Array.isArray(s.games)) s.games = [];
    if (typeof s.masterEnabled !== 'boolean') s.masterEnabled = true;
    return s;
  } catch {
    const d = defaultState();
    save(d);
    return d;
  }
}

function save(state) {
  ensureDir();
  fs.writeFileSync(GAMES_JSON, JSON.stringify(state, null, 2));
  // Derive the simple list the DLL reads: enabled exes, one per line (empty if master off).
  const lines = state.masterEnabled ? state.games.filter(g => g.enabled).map(g => g.exe.toLowerCase()) : [];
  fs.writeFileSync(ENABLED_TXT, lines.join('\r\n') + (lines.length ? '\r\n' : ''));
}

function anchorPathFor(exe) {
  const stem = exe.replace(/\.[^.]*$/, '').toLowerCase();
  return path.join(DATA_DIR, `seat-anchor-${stem}.json`);
}
function isCalibrated(exe) {
  if (fs.existsSync(anchorPathFor(exe))) return true;
  if (exe.toLowerCase() === 'acs.exe' && fs.existsSync(path.join(DATA_DIR, 'seat-anchor.json'))) return true; // legacy
  return false;
}
function clearAnchor(exe) {
  try { fs.unlinkSync(anchorPathFor(exe)); } catch {}
  if (exe.toLowerCase() === 'acs.exe') { try { fs.unlinkSync(path.join(DATA_DIR, 'seat-anchor.json')); } catch {} }
}

// Is a Cockpit Anchor manifest registered as an implicit OpenXR layer (HKLM)?
function isLayerInstalled() {
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Khronos\\OpenXR\\1\\ApiLayers\\Implicit'], { encoding: 'utf8' });
    return /CockpitAnchor/i.test(out);
  } catch { return false; }
}

// --- Virtual Desktop "Toggle VR Mode" key resolution -------------------------
// The layer's black-screen auto-bounce sends VD's "Toggle VR Mode" hotkey (default Shift+Win+D). If the
// user remapped it in VD, we read VD's BindingSettings.json and write the resolved chord to bounce-key.txt
// (decimal Windows VK codes) for the layer to send instead. CONSERVATIVE BY DESIGN: VD's JSON schema is
// undocumented, so we only override when a combo parses cleanly — otherwise the layer keeps its Shift+Win+D
// default, so this can never make the bounce worse than before.
const VD_BINDINGS = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Virtual Desktop', 'BindingSettings.json');
const BOUNCE_KEY = path.join(DATA_DIR, 'bounce-key.txt');
const VK_MODS = { shift: 0xA0, lshift: 0xA0, ctrl: 0x11, control: 0x11, alt: 0x12, menu: 0x12, win: 0x5B, windows: 0x5B, meta: 0x5B, super: 0x5B, cmd: 0x5B };
const MOD_VK = new Set(Object.values(VK_MODS));

function tokenToVk(tok) {
  const t = String(tok).trim().toLowerCase();
  if (t in VK_MODS) return VK_MODS[t];
  if (/^[a-z]$/.test(t)) return t.toUpperCase().charCodeAt(0);   // A-Z  -> 0x41..0x5A
  if (/^[0-9]$/.test(t)) return t.charCodeAt(0);                 // 0-9  -> 0x30..0x39
  const f = t.match(/^f([1-9]|1[0-2])$/);
  if (f) return 0x70 + (parseInt(f[1], 10) - 1);                 // F1..F12 -> 0x70..0x7B
  return null;
}

// "Shift+Windows+D" (and similar separators) -> [mod VKs..., main key VK], or null if not cleanly parseable.
function comboFromString(s) {
  const toks = String(s).split(/[+\-\s,]+/).filter(Boolean);
  if (toks.length < 2) return null;
  const vks = toks.map(tokenToVk);
  if (vks.some(v => v == null)) return null;
  const keys = vks.filter(v => !MOD_VK.has(v));
  const mods = vks.filter(v => MOD_VK.has(v));
  if (keys.length !== 1 || mods.length < 1) return null;        // need exactly one main key + >=1 modifier
  return [...mods, keys[0]];
}

// Best-effort: resolve a remapped "Toggle VR Mode" chord from VD's BindingSettings.json, or null for default.
function resolveVdBounceKey() {
  try {
    const data = JSON.parse(fs.readFileSync(VD_BINDINGS, 'utf8'));
    const b = data && data.Bindings;
    if (!b || typeof b !== 'object') return null;               // empty {} = user is on stock defaults
    let val = null;
    for (const k of Object.keys(b)) {
      const n = k.toLowerCase().replace(/[^a-z]/g, '');
      if (n.includes('togglevrmode') || n.includes('vrmode') || (n.includes('vr') && n.includes('mode'))) { val = b[k]; break; }
    }
    if (val == null) return null;
    if (typeof val === 'string') return comboFromString(val);
    if (val && typeof val === 'object') {
      for (const f of ['Shortcut', 'shortcut', 'Combo', 'combo', 'Keys', 'keys', 'Binding', 'binding', 'Value', 'value', 'Text', 'text']) {
        if (typeof val[f] === 'string') { const c = comboFromString(val[f]); if (c) return c; }
      }
      const mods = val.Modifiers || val.modifiers, key = val.Key || val.key;
      if (Array.isArray(mods) && typeof key === 'string') { const c = comboFromString([...mods, key].join('+')); if (c) return c; }
    }
    return null;
  } catch { return null; }
}

// Sync bounce-key.txt from VD: write the override when a custom chord is found, else remove it (use default).
function syncBounceKey() {
  ensureDir();
  const vks = resolveVdBounceKey();
  try {
    if (Array.isArray(vks) && vks.length >= 2) fs.writeFileSync(BOUNCE_KEY, vks.join(',') + '\r\n');
    else if (fs.existsSync(BOUNCE_KEY)) fs.unlinkSync(BOUNCE_KEY);
  } catch { /* non-fatal */ }
  return vks;
}

module.exports = { DATA_DIR, LOG, KNOWN_GAMES, load, save, isCalibrated, clearAnchor, isLayerInstalled, resolveVdBounceKey, syncBounceKey, VD_BINDINGS };
