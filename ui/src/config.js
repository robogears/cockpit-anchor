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

module.exports = { DATA_DIR, LOG, KNOWN_GAMES, load, save, isCalibrated, clearAnchor, isLayerInstalled };
