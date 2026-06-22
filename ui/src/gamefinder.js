// gamefinder.js — best-effort: find a game's full .exe path so the UI can show its real icon.
// Games added by file-picker already have a path; the default Assetto Corsa and quick-added games
// don't, so we locate them. Strategies, fast→slow (first hit wins): known install paths, a Steam
// library scan, then a running process with that exe. Everything is wrapped so it can never throw.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Non-Steam games we can guess at. Steam games are found by the library scan instead.
const KNOWN_PATHS = {
  'iracingsim64dx11.exe': [
    'C:\\Program Files\\iRacing\\iRacingSim64DX11.exe',
    'C:\\Program Files (x86)\\iRacing\\iRacingSim64DX11.exe',
  ],
};

function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

function fromKnownPaths(exe) {
  for (const p of (KNOWN_PATHS[exe.toLowerCase()] || [])) if (exists(p)) return p;
  return null;
}

function steamRoots() {
  const roots = [];
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', timeout: 4000 });
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) roots.push(m[1].trim().replace(/\//g, '\\'));
  } catch { /* no Steam in registry */ }
  for (const p of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']) if (!roots.includes(p)) roots.push(p);
  return roots.filter(exists);
}

function steamLibraries() {
  const libs = [];
  for (const root of steamRoots()) {
    libs.push(root);
    try {
      const txt = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      let m;
      const reNew = /"path"\s*"([^"]+)"/g;                       // 2021+ format: "path" "D:\\SteamLibrary"
      while ((m = reNew.exec(txt))) libs.push(m[1].replace(/\\\\/g, '\\'));
      const reOld = /"\d+"\s+"([A-Za-z]:[^"]+)"/g;               // legacy: "1"  "D:\\SteamLibrary"
      while ((m = reOld.exec(txt))) libs.push(m[1].replace(/\\\\/g, '\\'));
    } catch { /* no/odd libraryfolders.vdf */ }
  }
  return [...new Set(libs)];
}

function fromSteam(exe) {
  for (const lib of steamLibraries()) {
    const common = path.join(lib, 'steamapps', 'common');
    let entries;
    try { entries = fs.readdirSync(common, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const candidate = path.join(common, e.name, exe);          // e.g. ...\common\assettocorsa\acs.exe
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

function fromRunningProcess(exe) {
  try {
    const name = exe.replace(/\.exe$/i, '').replace(/'/g, "''");
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      `Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path`],
      { encoding: 'utf8', timeout: 4000 }).trim();
    if (out && exists(out) && path.basename(out).toLowerCase() === exe.toLowerCase()) return out;
  } catch { /* not running / no access */ }
  return null;
}

// Return the full .exe path for a known game basename, or null if it can't be located.
function resolveGameExe(exe) {
  if (!exe || typeof exe !== 'string') return null;
  try { return fromKnownPaths(exe) || fromSteam(exe) || fromRunningProcess(exe) || null; }
  catch { return null; }
}

module.exports = { resolveGameExe };
