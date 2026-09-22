const { app, BrowserWindow, ipcMain, shell, dialog, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Chemins ──────────────────────────────────────────────────────
const DATA_DIR = isDev
  ? path.join(__dirname, '..', 'data')
  : path.join(app.getPath('userData'), 'data');

const DB_PATH = path.join(DATA_DIR, 'geslopro.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ICON_PATH = fs.existsSync(path.join(__dirname, '..', 'frontend', 'public', 'icon.png'))
  ? path.join(__dirname, '..', 'frontend', 'public', 'icon.png')
  : path.join(__dirname, '..', 'frontend', 'public', 'icon.ico');

// Créer les dossiers si nécessaire
[DATA_DIR, BACKUP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let mainWindow = null;
let backendProcess = null;

// ─── Démarrage du backend Express ─────────────────────────────────
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'backend', 'src', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'src', 'server.js');

  // En production, le node.exe est dans le même dossier que GesLo.exe
  const nodeExec = isDev
    ? 'node'
    : path.join(path.dirname(app.getPath('exe')), 'node.exe');

  const actualExec = (!isDev && fs.existsSync(nodeExec)) ? nodeExec : 'node';
  console.log(`[GesLo] Lancement backend avec : ${actualExec}`);

  backendProcess = spawn(actualExec, [backendPath], {
    env: {
      ...process.env,
      PORT: '3001',
      DATA_DIR,
      NODE_ENV: 'production',
    },
    stdio: isDev ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });

  if (!isDev) {
    backendProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString().trim()));
    backendProcess.stderr?.on('data', (d) => console.error('[Backend ERR]', d.toString().trim()));
  }

  backendProcess.on('error', (err) => console.error('[GesLo] Erreur backend :', err));
  backendProcess.on('exit', (code) => console.warn(`[GesLo] Backend terminé (code ${code})`));
}

// ─── Attendre que le backend réponde ──────────────────────────────
function waitForBackend(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (res.ok) { resolve(true); return; }
      } catch {}
      if (Date.now() - start > timeoutMs) { resolve(false); return; }
      setTimeout(check, 600);
    };
    check();
  });
}

// ─── Fenêtre principale ───────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    title: 'GesLo',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Démarrer la surveillance des stocks après 30s
    setTimeout(watchLowStock, 30000);
  });

  const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

  // Fallback si le chargement réseau échoue
  mainWindow.webContents.on('did-fail-load', () => {
    if (fs.existsSync(distPath)) {
      console.log('[GesLo] Serveur dev non disponible, chargement de dist/index.html...');
      mainWindow.loadFile(distPath);
    }
  });

  if (isDev) {
    fetch('http://localhost:5173', { signal: AbortSignal.timeout(1000) })
      .then(() => {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
      })
      .catch(() => {
        if (fs.existsSync(distPath)) {
          console.log('[GesLo] Mode dev local : chargement du build dist/index.html');
          mainWindow.loadFile(distPath);
        } else {
          mainWindow.loadURL('http://localhost:5173');
          mainWindow.webContents.openDevTools();
        }
      });
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Démarrage de l'application ──────────────────────────────────
app.whenReady().then(async () => {
  console.log('[GesLo] Démarrage...');

  // Toujours démarrer en mode serveur local
  startBackend();

  // Attendre que le backend soit prêt
  const ready = await waitForBackend('http://127.0.0.1:3001/health', 15000);
  if (!ready) {
    console.error('[GesLo] Backend non disponible après 15s');
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// ─── Quitter ──────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});

// ─── Surveillance rupture stock ───────────────────────────────────
function watchLowStock() {
  setInterval(async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/products/low-stock', {
        headers: { Authorization: `Bearer ${global.__gesloToken || ''}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const products = await res.json();
      const outOfStock = products.filter((p) => p.stock_quantity <= 0);
      const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.alert_threshold);

      if (outOfStock.length > 0 && Notification.isSupported()) {
        new Notification({
          title: 'GesLo — Rupture de stock',
          body: `${outOfStock.length} produit${outOfStock.length > 1 ? 's' : ''} en rupture : ${outOfStock.slice(0, 3).map((p) => p.name).join(', ')}`,
          icon: ICON_PATH,
        }).show();
      } else if (lowStock.length > 0 && Notification.isSupported()) {
        new Notification({
          title: 'GesLo — Stock faible',
          body: `${lowStock.length} produit${lowStock.length > 1 ? 's' : ''} bientôt épuisé${lowStock.length > 1 ? 's' : ''}`,
          icon: ICON_PATH,
        }).show();
      }
    } catch {}
  }, 5 * 60 * 1000);
}

// ─── IPC handlers ────────────────────────────────────────────────

// Token JWT pour les notifications
ipcMain.on('auth:token', (_, token) => { global.__gesloToken = token; });

// Infos LAN (pour la page Paramètres)
ipcMain.handle('lan:get-info', () => ({
  mode: 'server',
  server: { ip: '127.0.0.1', port: 3001 },
  isDev,
}));

ipcMain.handle('lan:get-clients', async () => {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/lan/clients');
    return await res.json();
  } catch { return []; }
});

ipcMain.handle('lan:reset', () => ({ success: true }));
ipcMain.handle('lan:rediscover', () => null);

// Sauvegarde BDD
ipcMain.handle('db:backup', async () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { success: false, error: 'Base de données introuvable.' };
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `geslo-${date}_${time}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);
    fs.copyFileSync(DB_PATH, backupPath);
    return { success: true, path: backupPath, filename };
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
    setTimeout(() => { startBackend(); if (mainWindow) mainWindow.reload(); }, 1000);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// Version de l'app
ipcMain.handle('app:version', () => app.getVersion());

// Ouvrir un dossier dans l'explorateur
ipcMain.handle('shell:openFolder', (_, folderPath) => shell.openPath(folderPath));
