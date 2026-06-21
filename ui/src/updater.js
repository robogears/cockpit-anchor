// updater.js — checks GitHub Releases, downloads, and self-installs (Windows / NSIS).
// Degrades gracefully: in dev or unpackaged builds, canSelfInstall() is false and the
// renderer falls back to opening the release page in the browser.
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { app } = require('electron');

const OWNER = 'robogears';
const REPO = 'cockpit-anchor';
const ASSET_SUBSTR = 'Setup.exe';   // matches the NSIS artifact: CockpitAnchor-Setup.exe
const UA = `cockpit-anchor-ui/${app.getVersion()}`;

function fetchLatestRelease() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases/latest`,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github+json' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Numeric semver-ish compare (so 0.1.10 > 0.1.2), tolerant of a leading "v".
function isNewerVersion(remote, current) {
  const r = String(remote).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const c = String(current).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(r.length, c.length);
  for (let i = 0; i < len; i++) { const a = r[i] || 0, b = c[i] || 0; if (a > b) return true; if (a < b) return false; }
  return false;
}

async function getUpdateStatus() {
  const release = await fetchLatestRelease();
  if (!release || !release.tag_name) return { status: 'error', message: 'Could not reach GitHub' };
  if (!isNewerVersion(release.tag_name, app.getVersion())) return { status: 'up-to-date', version: app.getVersion() };
  let downloadUrl = release.html_url; // fallback: the release page
  if (process.platform === 'win32') {
    const asset = (release.assets || []).find((a) => a.name && a.name.includes(ASSET_SUBSTR));
    if (asset && asset.browser_download_url) downloadUrl = asset.browser_download_url;
  }
  return { status: 'available', version: release.tag_name, downloadUrl, releaseUrl: release.html_url };
}

function canSelfInstall() {
  return app.isPackaged && process.platform === 'win32';
}

function downloadToFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const get = (u, redirects = 0) => {
      const req = https.request(u, { method: 'GET', headers: { 'User-Agent': UA } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let downloaded = 0;
        const out = fs.createWriteStream(destPath);
        res.on('data', (chunk) => { downloaded += chunk.length; if (onProgress) onProgress(downloaded, total); });
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(60000, () => req.destroy(new Error('Download timed out')));
      req.end();
    };
    get(url);
  });
}

let pendingInstaller = null;

async function download(url, onProgress) {
  if (!canSelfInstall()) return { ok: false, error: 'Self-install not available' };
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return { ok: false, error: 'Invalid URL' };
  const dest = path.join(os.tmpdir(), `cockpitanchor-update-${Date.now()}.exe`);
  try {
    await downloadToFile(url, dest, onProgress);
    pendingInstaller = dest;
    return { ok: true, path: dest };
  } catch (e) {
    try { fs.unlinkSync(dest); } catch {}
    return { ok: false, error: e.message };
  }
}

// Apply the staged update and relaunch the new version. We don't rely on NSIS's own
// relaunch-after-silent-install (unreliable for a custom updater); instead a detached, hidden
// PowerShell helper: waits for THIS app to exit, runs the installer silently (NSIS replaces the
// files in place), then launches the new exe at the same path (process.execPath). The app's
// single-instance lock makes any double-launch harmless.
function apply() {
  if (!pendingInstaller) return false;
  const q = (s) => String(s).replace(/'/g, "''");
  const installer = q(pendingInstaller);
  const exe = q(process.execPath);
  const ps =
    `Start-Sleep -Milliseconds 800; ` +
    `Start-Process -FilePath '${installer}' -ArgumentList '/S' -Wait; ` +
    `Start-Process -FilePath '${exe}'`;
  const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', ps],
    { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  app.isQuitting = true;
  setTimeout(() => app.quit(), 200);
  return true;
}

module.exports = { getUpdateStatus, canSelfInstall, download, apply };
