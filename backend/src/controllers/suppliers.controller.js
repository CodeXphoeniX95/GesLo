import { getDb } from '../database/connection.js';

export function getSuppliers(req, res) {
  const { search } = req.query;
  const db = getDb();
  let query = 'SELECT * FROM suppliers WHERE is_active = 1';
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
}

export function getSupplier(req, res) {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable.' });

  const purchases = db.prepare(
    'SELECT purchase_number, total, amount_paid, balance_due, created_at FROM purchases WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(req.params.id);

  res.json({ ...supplier, recent_purchases: purchases });
}

export function createSupplier(req, res) {
  const { name, phone, email, address, note } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO suppliers (name, phone, email, address, note) VALUES (?, ?, ?, ?, ?)'
  ).run(name, phone || null, email || null, address || null, note || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Fournisseur créé.' });
}

export function updateSupplier(req, res) {
  const { id } = req.params;
  const { name, phone, email, address, note } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

  const db = getDb();
  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable.' });

  db.prepare(
    'UPDATE suppliers SET name=?, phone=?, email=?, address=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(name, phone || null, email || null, address || null, note || null, id);

  res.json({ message: 'Fournisseur mis à jour.' });
}
