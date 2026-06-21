// main.js — Electron main process: tray + frameless control-panel window + IPC.
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const cfg = require('./config');
const updater = require('./updater');

let win = null;
let tray = null;
app.isQuitting = false;

// Where install.ps1 / the DLL live. Dev: the repo's api-layer. Packaged: resources/layer.
function layerDir() {
  const dev = path.join(__dirname, '..', '..', 'api-layer');
  if (fs.existsSync(path.join(dev, 'install.ps1'))) return dev;
  return path.join(process.resourcesPath || '', 'layer');
}

function createWindow() {
  win = new BrowserWindow({
    width: 560, height: 500, minWidth: 470, minHeight: 430,
    frame: false, backgroundColor: '#080a0d', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } }); // close = hide to tray
  win.on('closed', () => { win = null; });
}

function showWin() { try { cfg.syncBounceKey(); } catch {} if (!win) createWindow(); else { win.show(); win.focus(); } }

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
    if (img.isEmpty()) return;   // no icon -> skip the tray; the window still works
    tray = new Tray(img);
    tray.setToolTip('Cockpit Anchor');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Cockpit Anchor', click: showWin },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('click', showWin);
  } catch (e) { console.error('tray init failed:', e.message); }
}

// Extract the game's own icon from its .exe (needs the stored full path). Returns a data URL or null.
async function gameIcon(g) {
  try {
    if (g.path && fs.existsSync(g.path)) {
      const img = await app.getFileIcon(g.path, { size: 'large' });
      if (img && !img.isEmpty()) return img.toDataURL();
    }
  } catch { /* fall through to the wheel placeholder */ }
  return null;
}

async function fullState() {
  const s = cfg.load();
  const games = await Promise.all(s.games.map(async (g) => ({
    ...g,
    calibrated: cfg.isCalibrated(g.exe),
    icon: await gameIcon(g),
  })));
  return {
    masterEnabled: s.masterEnabled,
    installed: cfg.isLayerInstalled(),
    dataDir: cfg.DATA_DIR,
    known: cfg.KNOWN_GAMES,
    games,
  };
}

function runElevated(file) {
  return new Promise((resolve) => {
    const inner = `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${file.replace(/'/g, "''")}'`;
    execFile('powershell', ['-NoProfile', '-Command', inner], (err) => resolve(!err));
  });
}

ipcMain.handle('get-state', () => fullState());
ipcMain.handle('set-master', (_e, v) => { const s = cfg.load(); s.masterEnabled = !!v; cfg.save(s); return fullState(); });
ipcMain.handle('toggle-game', (_e, { exe, en }) => {
  const s = cfg.load(); const g = s.games.find(x => x.exe.toLowerCase() === exe.toLowerCase());
  if (g) g.enabled = !!en; cfg.save(s); return fullState();
});
ipcMain.handle('remove-game', (_e, exe) => {
  const s = cfg.load(); s.games = s.games.filter(x => x.exe.toLowerCase() !== exe.toLowerCase()); cfg.save(s); return fullState();
});
ipcMain.handle('clear-anchor', (_e, exe) => { cfg.clearAnchor(exe); return fullState(); });
ipcMain.handle('add-known', (_e, { exe, name }) => {
  const s = cfg.load();
  if (!s.games.some(x => x.exe.toLowerCase() === exe.toLowerCase())) s.games.push({ name, exe, enabled: true });
  cfg.save(s); return fullState();
});
ipcMain.handle('add-game', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Pick the game's .exe",
    filters: [{ name: 'Programs', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return fullState();
  const fullPath = r.filePaths[0];
  const exe = path.basename(fullPath);
  const name = exe.replace(/\.exe$/i, '');
  const s = cfg.load();
  const existing = s.games.find(x => x.exe.toLowerCase() === exe.toLowerCase());
  if (existing) existing.path = fullPath;                          // refresh path so its icon resolves
  else s.games.push({ name, exe, enabled: true, path: fullPath });
  cfg.save(s); return fullState();
});
ipcMain.handle('install-layer', () => runElevated(path.join(layerDir(), 'install.ps1')));
ipcMain.handle('uninstall-layer', () => runElevated(path.join(layerDir(), 'uninstall.ps1')));
ipcMain.handle('open-logs', () => shell.openPath(cfg.LOG));
ipcMain.handle('open-data', () => shell.openPath(cfg.DATA_DIR));
ipcMain.handle('win', (_e, action) => { if (!win) return; if (action === 'min') win.minimize(); else if (action === 'close') win.close(); });

// --- updater ---
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:check', async () => {
  const r = await updater.getUpdateStatus();
  if (r.status === 'available' && win && !win.isDestroyed()) {
    win.webContents.send('update:available', { version: r.version, downloadUrl: r.downloadUrl, releaseUrl: r.releaseUrl });
  }
  return r;
});
ipcMain.handle('update:can-self-install', () => updater.canSelfInstall());
ipcMain.handle('update:download', (_e, url) => updater.download(url, (downloaded, total) => {
  if (win && !win.isDestroyed()) win.webContents.send('update:download-progress', { downloaded, total });
}));
ipcMain.handle('update:apply', () => updater.apply());
ipcMain.handle('shell:open-external', (_e, url) => { if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url); });

async function checkOnLaunch() {
  const r = await updater.getUpdateStatus().catch(() => null);
  if (!r || r.status !== 'available' || !win || win.isDestroyed()) return;
  const send = () => win.webContents.send('update:available', { version: r.version, downloadUrl: r.downloadUrl, releaseUrl: r.releaseUrl });
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send); else send();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWin);
  app.on('window-all-closed', () => { /* stay alive in the tray */ });
  app.whenReady().then(() => { try { cfg.syncBounceKey(); } catch {} createWindow(); createTray(); checkOnLaunch(); });
}
