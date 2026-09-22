import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './connection.js';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations() {
  const db = getDb();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Migrations ALTER TABLE pour les bases existantes
  try { db.exec('ALTER TABLE products ADD COLUMN unit_quantity INTEGER DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE day_closings ADD COLUMN closed_by_name TEXT'); } catch {}
  try { db.exec('ALTER TABLE business_settings ADD COLUMN enable_commissions INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE business_settings ADD COLUMN pool_commission_rate REAL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN commission_rate REAL DEFAULT 0'); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN commission_type TEXT DEFAULT 'percentage'"); } catch {}

  seedInitialData(db);
  console.log('Migrations exécutées avec succès.');
}

function seedInitialData(db) {  // Rôles
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)'
  );
  insertRole.run('admin', 'Accès complet à l\'application');
  insertRole.run('manager', 'Produits, stock, ventes, rapports et dépenses');
  insertRole.run('cashier', 'Enregistrement des ventes et consultation limitée');
  insertRole.run('waiter', 'Création et suivi des commandes de restaurant');

  // Utilisateur administrateur par défaut (mot de passe : admin123)
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'Administrateur', 1);
    console.log('Utilisateur admin créé (mot de passe : admin123)');
  }

  // Paramètres par défaut
  const existingSettings = db.prepare('SELECT id FROM business_settings').get();
  if (!existingSettings) {
    db.prepare(
      `INSERT INTO business_settings (name, currency, currency_symbol, business_type)
       VALUES (?, ?, ?, ?)`
    ).run('Mon Commerce', 'FCFA', 'FCFA', 'shop');
  }

  // Catégories de dépenses par défaut
  const insertExpCat = db.prepare(
    'INSERT OR IGNORE INTO expense_categories (name) VALUES (?)'
  );
  ['Transport', 'Électricité', 'Eau', 'Loyer', 'Salaire',
    'Matériel', 'Entretien', 'Communication', 'Autres'].forEach(c => insertExpCat.run(c));
}
