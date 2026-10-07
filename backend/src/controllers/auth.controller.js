import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/connection.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/config.js';

async function auditLog(db, userId, action, entity, entityId, details) {
  await db.prepare(
    'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, entity, entityId, details ? JSON.stringify(details) : null);
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
  }

  const db = getDb();
  const user = await db.prepare(
    `SELECT u.*, r.name AS role FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ? AND u.is_active = 1`
  ).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  await auditLog(db, user.id, 'LOGIN', 'users', user.id, { username: user.username });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  });
}

export function getMe(req, res) {
  res.json({ user: req.user });
}

export async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mots de passe requis.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  const db = getDb();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, req.user.id);

  await auditLog(db, req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null);
  res.json({ message: 'Mot de passe modifié avec succès.' });
}

export async function getUsers(req, res) {
  const db = getDb();
  const users = await db.prepare(
    `SELECT u.id, u.username, u.full_name, u.commission_rate, u.commission_type, u.is_active, u.created_at, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`
  ).all();
  res.json(users);
}

export async function createUser(req, res) {
  const { username, password, full_name, role, commission_rate = 0, commission_type = 'percentage' } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const db = getDb();
  const roleRow = await db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
  if (!roleRow) return res.status(400).json({ error: 'Rôle invalide.' });

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role_id, commission_rate, commission_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, hash, full_name, roleRow.id, Number(commission_rate) || 0, commission_type || 'percentage');

  await auditLog(db, req.user.id, 'CREATE_USER', 'users', result.lastInsertRowid, { username });
  res.status(201).json({ id: result.lastInsertRowid, message: 'Utilisateur créé.' });
}

export async function updateUserCommission(req, res) {
  const { id } = req.params;
  const { commission_rate, commission_type } = req.body;
  let rate = Number(commission_rate) || 0;
  const type = commission_type || 'percentage';

  if (type === 'percentage' && (rate < 0 || rate > 100)) {
    return res.status(400).json({ error: 'Le pourcentage de commission doit être compris entre 0 et 100%.' });
  }

  const db = getDb();

  if (type === 'percentage') {
    const settings = await db.prepare('SELECT pool_commission_rate FROM business_settings LIMIT 1').get();
    const poolRate = Number(settings?.pool_commission_rate || 0);

    const otherUsersSum = await db.prepare(
      "SELECT COALESCE(SUM(commission_rate), 0) AS total FROM users WHERE id != ? AND is_active = 1 AND commission_type = 'percentage'"
    ).get(id);

    const totalAllocated = (otherUsersSum?.total || 0) + poolRate + rate;
    if (totalAllocated > 100) {
      return res.status(400).json({
        error: `Impossible d'enregistrer : la somme des commissions (${totalAllocated.toFixed(1)}%) dépasserait 100%.`
      });
    }
  }

  await db.prepare(
    'UPDATE users SET commission_rate = ?, commission_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(rate, type, id);

  // Recalculate existing sale_commissions for this user
  try {
    const userSalesComms = await db.prepare(
      'SELECT id, sale_total, sale_profit, pool_commission FROM sale_commissions WHERE user_id = ?'
    ).all(id);

    for (const sc of userSalesComms) {
      let userComm = 0;
      if (type === 'fixed') {
        userComm = rate;
      } else {
        userComm = Math.max(0, (sc.sale_profit * rate) / 100);
      }
      const poolComm = sc.pool_commission || 0;
      const totalComm = userComm + poolComm;
      const caisseNet = sc.sale_total - totalComm;

      await db.prepare(
        `UPDATE sale_commissions
         SET user_commission = ?, total_commission = ?, caisse_net = ?
         WHERE id = ?`
      ).run(userComm, totalComm, caisseNet, sc.id);
    }
  } catch (recalcErr) {
    console.warn('Erreur recalcul sale_commissions:', recalcErr.message);
  }

  await auditLog(db, req.user.id, 'UPDATE_USER_COMMISSION', 'users', id, { commission_rate: rate, commission_type: type });
  res.json({ message: 'Taux de commission mis à jour et ventes recalculées.' });
}

export async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }

  const db = getDb();
  await db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(is_active ? 1 : 0, id);

  await auditLog(db, req.user.id, is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'users', id, null);
  res.json({ message: 'Statut mis à jour.' });
}

export async function getRoles(req, res) {
  const db = getDb();
  const roles = await db.prepare('SELECT * FROM roles').all();
  res.json(roles);
}
