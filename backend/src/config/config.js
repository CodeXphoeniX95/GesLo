import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT || 3001;
export const JWT_SECRET = process.env.JWT_SECRET || 'geslopro_secret_key_change_in_production';
export const JWT_EXPIRES_IN = '24h';

// Dossier data à la racine du projet ou /tmp sur Vercel serverless
export const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp' : join(__dirname, '..', '..', '..', '..', 'data'));
export const DB_PATH = join(DATA_DIR, 'geslopro.db');
export const BACKUP_DIR = join(DATA_DIR, 'backups');

// Obtenir l'IP locale du serveur (pour affichage multi-postes)
export function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}
