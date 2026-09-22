import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { DB_PATH, DATA_DIR } from '../config/config.js';

// Créer le dossier data s'il n'existe pas
try {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Erreur création dossier DATA_DIR:', e);
}

let db;

export function getDb() {
  if (!db) {
    try {
      db = new Database(DB_PATH);
      if (!process.env.VERCEL) {
        db.pragma('journal_mode = WAL');
      } else {
        db.pragma('journal_mode = DELETE');
      }
      db.pragma('foreign_keys = ON');
    } catch (err) {
      console.error('Erreur ouverture SQLite (fallback :memory:):', err);
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
    }
  }
  return db;
}

export function closeDb() {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
}

export default getDb;
