import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { DB_PATH, BACKUP_DIR } from '../config/config.js';
import { getDb } from '../database/connection.js';

// S'assurer que le dossier backups existe au démarrage
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`[Backup] Dossier créé : ${BACKUP_DIR}`);
}

console.log(`[Backup] DB_PATH  = ${DB_PATH}`);
console.log(`[Backup] BACKUP_DIR = ${BACKUP_DIR}`);

export function createBackup(req, res) {
  console.log('[Backup] Demande de sauvegarde reçue');

  try {
    if (!existsSync(DB_PATH)) {
      console.error(`[Backup] DB introuvable : ${DB_PATH}`);
      return res.status(404).json({ error: `Base de données introuvable : ${DB_PATH}` });
    }

    const db = getDb();

    // Forcer l'écriture du WAL avant la copie (garantit une copie cohérente)
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {
      console.warn('[Backup] WAL checkpoint échoué (ignoré) :', e.message);
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `geslo-${date}_${time}.db`;
    const backupPath = join(BACKUP_DIR, filename);

    console.log(`[Backup] Copie vers : ${backupPath}`);
    copyFileSync(DB_PATH, backupPath);

    const stats = statSync(backupPath);
    console.log(`[Backup] Sauvegarde créée : ${filename} (${stats.size} bytes)`);

    // Journal d'audit
    try {
      db.prepare('INSERT INTO audit_log (user_id, action, entity, details) VALUES (?,?,?,?)')
        .run(req.user?.id || null, 'BACKUP', 'database', JSON.stringify({ filename, size: stats.size }));
    } catch {}

    return res.json({
      success: true,
      filename,
      path: backupPath,
      size: stats.size,
      message: `Sauvegarde créée : ${filename}`,
    });
  } catch (err) {
    console.error('[Backup] Erreur :', err);
    return res.status(500).json({ error: `Erreur : ${err.message}` });
  }
}

export function listBackups(req, res) {
  try {
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
      return res.json([]);
    }

    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const filePath = join(BACKUP_DIR, f);
        const stats = statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          created_at: stats.mtime,
          path: filePath,
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json(files);
  } catch (err) {
    console.error('[Backup] Erreur liste :', err);
    return res.status(500).json({ error: err.message });
  }
}
