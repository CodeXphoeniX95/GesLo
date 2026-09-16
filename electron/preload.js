const { contextBridge, ipcRenderer } = require('electron');

// ─── API pour la fenêtre principale (React) ──────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // Sauvegarde / restauration
  backup: () => ipcRenderer.invoke('db:backup'),
  restore: () => ipcRenderer.invoke('db:restore'),

  // Infos app
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Ouvrir un dossier
  openFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),

  // Token JWT pour les notifications
  sendToken: (token) => ipcRenderer.send('auth:token', token),

  // ─── LAN ─────────────────────────────────────────────────────
  lan: {
    getInfo: () => ipcRenderer.invoke('lan:get-info'),
    getClients: () => ipcRenderer.invoke('lan:get-clients'),
    reset: () => ipcRenderer.invoke('lan:reset'),
    rediscover: () => ipcRenderer.invoke('lan:rediscover'),
  },
});

// ─── API pour la fenêtre de configuration LAN (setup.html) ───────
contextBridge.exposeInMainWorld('electronSetup', {
  startAsServer: () => ipcRenderer.invoke('lan:start-as-server'),
  connectToServer: (opts) => ipcRenderer.invoke('lan:connect-to-server', opts),

  onServerFound: (cb) => ipcRenderer.on('server-found', (_, data) => cb(data)),
  onNoServerFound: (cb) => ipcRenderer.on('no-server-found', () => cb()),
});
