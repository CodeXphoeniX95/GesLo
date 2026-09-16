import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { DB_PATH, DATA_DIR } from '../config/config.js';

// Créer le dossier data s'il n'existe pas
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
