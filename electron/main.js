const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { discoverServer, startClientPing } = require('./discovery-client');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Chemins ──────────────────────────────────────────────────────
const DATA_DIR = isDev
  ? path.join(__dirname, '..', 'data')
  : path.join(app.getPath('userData'), 'data');

const DB_PATH = path.join(DATA_DIR, 'geslopro.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const CONFIG_PATH = path.join(DATA_DIR, 'lan-config.json');
const ICON_PATH = path.join(__dirname, '..', 'frontend', 'public', 'icon.ico');

[DATA_DIR, BACKUP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Configuration LAN persistée ─────────────────────────────────
function loadLANConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {}
  return null;
}

function saveLANConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Variables globales ───────────────────────────────────────────
let mainWindow = null;
let setupWindow = null;
let backendProcess = null;
let stopClientPing = null;
let currentMode = null; // 'server' | 'client'
let serverInfo = null;  // { ip, port }

// ─── Backend Express ──────────────────────────────────────────────
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'backend', 'src', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'src', 'server.js');

  backendProcess = spawn('node', [backendPath], {
    env: { ...process.env, PORT: '3001', DATA_DIR },
    stdio: isDev ? 'inherit' : 'ignore',
  });

  backendProcess.on('error', (err) => console.error('[Electron] Erreur backend :', err));
  backendProcess.on('exit', (code) => {
    if (code && code !== 0) console.warn(`[Electron] Backend terminé (code ${code})`);
  });
}

// ─── Fenêtre principale ───────────────────────────────────────────
function createMainWindow(serverURL) {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'GesLo', icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.on('page-title-updated', (e) => e.preventDefault());
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(watchLowStock, 30000);
  });

  if (isDev && currentMode === 'server') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else if (serverURL) {
    mainWindow.loadURL(serverURL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Fenêtre de configuration LAN ────────────────────────────────
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 560, height: 480, resizable: false,
    title: 'GesLo — Configuration réseau', icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    show: false,
    center: true,
  });

  setupWindow.once('ready-to-show', () => setupWindow.show());
  setupWindow.loadFile(path.join(__dirname, 'setup.html'));
  setupWindow.on('closed', () => { setupWindow = null; });
}

// ─── Démarrage de l'application ──────────────────────────────────
app.whenReady().then(async () => {
  // 1. Charger la config LAN sauvegardée
  const savedConfig = loadLANConfig();

  if (savedConfig) {
    // Config existante — utiliser directement
    if (savedConfig.mode === 'server') {
      await startAsServer();
    } else {
      await startAsClient(savedConfig.serverIP, savedConfig.serverPort || 3001);
    }
  } else if (isDev) {
    // Dev : toujours en mode serveur
    await startAsServer();
  } else {
    // Première fois : découvrir ou configurer
    await autoDetectAndStart();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(getServerURL());
  });
});

// ─── Mode SERVEUR ─────────────────────────────────────────────────
async function startAsServer() {
  console.log('[GesLo] Démarrage en mode SERVEUR');
  currentMode = 'server';
  serverInfo = { ip: '127.0.0.1', port: 3001 };
  startBackend();
  await waitForBackend('http://127.0.0.1:3001/health', 10000);
  createMainWindow(isDev ? 'http://localhost:5173' : null);
}

// ─── Mode CLIENT ──────────────────────────────────────────────────
async function startAsClient(serverIP, serverPort = 3001) {
  console.log(`[GesLo] Démarrage en mode CLIENT → ${serverIP}:${serverPort}`);
  currentMode = 'client';
  serverInfo = { ip: serverIP, port: serverPort };

  // Vérifier que le serveur répond
  const ok = await waitForBackend(`http://${serverIP}:${serverPort}/health`, 8000);
  if (!ok) {
    // Serveur injoignable → afficher la fenêtre de config
    createSetupWindow();
    return;
  }

  // Envoyer un ping périodique pour apparaître dans la liste des clients connectés
  stopClientPing = startClientPing(serverIP, serverPort, app.getName(), 'client');

  // Charger le frontend depuis le serveur
  createMainWindow(`http://${serverIP}:${serverPort}/app`);
}

// ─── Découverte automatique ───────────────────────────────────────
async function autoDetectAndStart() {
  console.log('[GesLo] Recherche d\'un serveur GesLo sur le réseau…');
  createSetupWindow(); // Afficher l'écran d'attente pendant la recherche

  const found = await discoverServer();

  if (found) {
    console.log(`[GesLo] Serveur trouvé : ${found.ip}:${found.port}`);
    if (setupWindow) { setupWindow.webContents.send('server-found', found); }
    // Attendre confirmation de l'utilisateur ou démarrer auto
    // Pour l'instant : connexion automatique si trouvé
    saveLANConfig({ mode: 'client', serverIP: found.ip, serverPort: found.port });
    if (setupWindow) setupWindow.close();
    await startAsClient(found.ip, found.port);
  } else {
    console.log('[GesLo] Aucun serveur trouvé — affichage de la configuration');
    if (setupWindow) {
      setupWindow.webContents.send('no-server-found');
    }
  }
}

// ─── Utilitaire : attendre que le backend réponde ─────────────────
function waitForBackend(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (res.ok) { resolve(true); return; }
      } catch {}
      if (Date.now() - start > timeoutMs) { resolve(false); return; }
      setTimeout(check, 500);
    };
    check();
  });
}

function getServerURL() {
  if (!serverInfo) return null;
  if (currentMode === 'server') return isDev ? 'http://localhost:5173' : null;
  return `http://${serverInfo.ip}:${serverInfo.port}/app`;
}

// ─── Quitter ──────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (stopClientPing) stopClientPing();
  if (currentMode === 'server' && backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (stopClientPing) stopClientPing();
  if (currentMode === 'server' && backendProcess) backendProcess.kill();
});

// ─── Surveillance rupture stock ───────────────────────────────────
function watchLowStock() {
  const baseURL = serverInfo
    ? `http://${serverInfo.ip}:${serverInfo.port}`
    : 'http://127.0.0.1:3001';

  setInterval(async () => {
    try {
      const res = await fetch(`${baseURL}/api/products/low-stock`, {
        headers: { Authorization: `Bearer ${global.__gesloToken || ''}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const products = await res.json();
      const outOfStock = products.filter((p) => p.stock_quantity <= 0);
      const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.alert_threshold);

      if (outOfStock.length > 0) {
        new Notification('GesLo — Rupture de stock', {
          body: `${outOfStock.length} produit${outOfStock.length > 1 ? 's' : ''} en rupture : ${outOfStock.slice(0, 3).map((p) => p.name).join(', ')}`,
          icon: ICON_PATH,
        });
      } else if (lowStock.length > 0) {
        new Notification('GesLo — Stock faible', {
          body: `${lowStock.length} produit${lowStock.length > 1 ? 's' : ''} bientôt épuisé${lowStock.length > 1 ? 's' : ''}`,
          icon: ICON_PATH,
        });
      }
    } catch {}
  }, 5 * 60 * 1000);
}

// ─── IPC handlers ────────────────────────────────────────────────

// Démarrer en mode serveur (depuis l'écran de configuration)
ipcMain.handle('lan:start-as-server', async () => {
  saveLANConfig({ mode: 'server' });
  if (setupWindow) setupWindow.close();
  await startAsServer();
  return { success: true };
});

// Se connecter à un serveur manuel (saisie IP)
ipcMain.handle('lan:connect-to-server', async (_, { ip, port = 3001 }) => {
  const ok = await waitForBackend(`http://${ip}:${port}/health`, 5000);
  if (!ok) return { success: false, error: `Impossible de joindre ${ip}:${port}` };
  saveLANConfig({ mode: 'client', serverIP: ip, serverPort: port });
  if (setupWindow) setupWindow.close();
  await startAsClient(ip, port);
  return { success: true };
});

// Réinitialiser la configuration LAN
ipcMain.handle('lan:reset', async () => {
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
  saveLANConfig(null);
  return { success: true };
});

// Obtenir le mode actuel et les infos serveur
ipcMain.handle('lan:get-info', () => ({
  mode: currentMode,
  server: serverInfo,
  isDev,
}));

// Relancer la découverte
ipcMain.handle('lan:rediscover', async () => {
  const found = await discoverServer();
  return found;
});

// Obtenir les clients connectés (mode serveur uniquement)
ipcMain.handle('lan:get-clients', async () => {
  if (currentMode !== 'server') return [];
  try {
    const res = await fetch('http://127.0.0.1:3001/api/lan/clients');
    return await res.json();
  } catch { return []; }
});

// Token JWT pour les notifications
ipcMain.on('auth:token', (_, token) => { global.__gesloToken = token; });

// Sauvegarde BDD
ipcMain.handle('db:backup', async () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { success: false, error: 'Base de données introuvable.' };
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const backupPath = path.join(BACKUP_DIR, `geslo-${date}_${time}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    return { success: true, path: backupPath };
  } catch (err) { return { success: false, error: err.message }; }
});

// Restauration BDD
ipcMain.handle('db:restore', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Sélectionner une sauvegarde',
      defaultPath: BACKUP_DIR,
      filters: [{ name: 'Base de données', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true };

    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Confirmer la restauration',
      message: 'Cette action remplacera toutes les données actuelles.',
      detail: `Fichier : ${path.basename(result.filePaths[0])}`,
      buttons: ['Annuler', 'Restaurer'], defaultId: 0, cancelId: 0,
    });
    if (confirm.response !== 1) return { success: false, cancelled: true };

    if (backendProcess) backendProcess.kill();
    fs.copyFileSync(result.filePaths[0], DB_PATH);
    setTimeout(() => { startBackend(); if (mainWindow) mainWindow.reload(); }, 500);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('shell:openFolder', (_, folderPath) => shell.openPath(folderPath));
ipcMain.on('auth:token', (_, token) => { global.__gesloToken = token; });
