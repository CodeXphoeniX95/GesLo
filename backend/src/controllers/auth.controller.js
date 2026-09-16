import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/connection.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/config.js';

function auditLog(db, userId, action, entity, entityId, details) {
  db.prepare(
    'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, entity, entityId, details ? JSON.stringify(details) : null);
}

export function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
  }

  const db = getDb();
  const user = db.prepare(
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

  auditLog(db, user.id, 'LOGIN', 'users', user.id, { username: user.username });

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

export function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mots de passe requis.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, req.user.id);

  auditLog(db, req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, null);
  res.json({ message: 'Mot de passe modifié avec succès.' });
}

export function getUsers(req, res) {
  const db = getDb();
  const users = db.prepare(
    `SELECT u.id, u.username, u.full_name, u.is_active, u.created_at, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`
  ).all();
  res.json(users);
}

export function createUser(req, res) {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const db = getDb();
  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
  if (!roleRow) return res.status(400).json({ error: 'Rôle invalide.' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)'
  ).run(username, hash, full_name, roleRow.id);

  auditLog(db, req.user.id, 'CREATE_USER', 'users', result.lastInsertRowid, { username });
  res.status(201).json({ id: result.lastInsertRowid, message: 'Utilisateur créé.' });
}

export function updateUserStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }

  const db = getDb();
  db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(is_active ? 1 : 0, id);

  auditLog(db, req.user.id, is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'users', id, null);
  res.json({ message: 'Statut mis à jour.' });
}

export function getRoles(req, res) {
  const db = getDb();
  const roles = db.prepare('SELECT * FROM roles').all();
  res.json(roles);
}
