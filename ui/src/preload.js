// preload.js — safe bridge between the renderer (UI) and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cockpit', {
  getState:       ()           => ipcRenderer.invoke('get-state'),
  setMaster:      (v)          => ipcRenderer.invoke('set-master', v),
  toggleGame:     (exe, en)    => ipcRenderer.invoke('toggle-game', { exe, en }),
  addGame:        ()           => ipcRenderer.invoke('add-game'),
  addKnown:       (exe, name)  => ipcRenderer.invoke('add-known', { exe, name }),
  removeGame:     (exe)        => ipcRenderer.invoke('remove-game', exe),
  clearAnchor:    (exe)        => ipcRenderer.invoke('clear-anchor', exe),
  installLayer:   ()           => ipcRenderer.invoke('install-layer'),
  uninstallLayer: ()           => ipcRenderer.invoke('uninstall-layer'),
  openLogs:       ()           => ipcRenderer.invoke('open-logs'),
  openData:       ()           => ipcRenderer.invoke('open-data'),
  win:            (action)     => ipcRenderer.invoke('win', action),

  getAppVersion:    ()    => ipcRenderer.invoke('app:version'),
  checkForUpdates:  ()    => ipcRenderer.invoke('update:check'),
  canSelfInstall:   ()    => ipcRenderer.invoke('update:can-self-install'),
  downloadUpdate:   (url) => ipcRenderer.invoke('update:download', url),
  applyUpdate:      ()    => ipcRenderer.invoke('update:apply'),
  openExternal:     (url) => ipcRenderer.invoke('shell:open-external', url),
  onUpdateAvailable:(cb)  => ipcRenderer.on('update:available', (_e, p) => cb(p)),
  onUpdateProgress: (cb)  => ipcRenderer.on('update:download-progress', (_e, p) => cb(p)),
});
