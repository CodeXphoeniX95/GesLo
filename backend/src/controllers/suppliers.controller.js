import { getDb } from '../database/connection.js';

export async function getSuppliers(req, res) {
  try {
    const { search } = req.query;
    const db = getDb();
    let query = 'SELECT * FROM suppliers WHERE is_active = 1';
    const params = [];
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY name';
    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getSuppliers:', err);
    res.json([]);
  }
}

export async function getSupplier(req, res) {
  try {
    const db = getDb();
    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable.' });

    const purchases = (await db.prepare(
      'SELECT purchase_number, total, amount_paid, balance_due, created_at FROM purchases WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(req.params.id)) || [];

    res.json({ ...supplier, recent_purchases: Array.isArray(purchases) ? purchases : [] });
  } catch (err) {
    console.error('Erreur getSupplier:', err);
    res.status(500).json({ error: 'Erreur chargement fournisseur.' });
  }
}

export async function createSupplier(req, res) {
  try {
    const { name, phone, email, address, note } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const result = await db.prepare(
      'INSERT INTO suppliers (name, phone, email, address, note) VALUES (?, ?, ?, ?, ?)'
    ).run(name, phone || null, email || null, address || null, note || null);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Fournisseur créé.' });
  } catch (err) {
    console.error('Erreur createSupplier:', err);
    res.status(500).json({ error: 'Erreur création fournisseur.' });
  }
}

export async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, email, address, note } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const supplier = await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable.' });

    await db.prepare(
      'UPDATE suppliers SET name=?, phone=?, email=?, address=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name, phone || null, email || null, address || null, note || null, id);

    res.json({ message: 'Fournisseur mis à jour.' });
  } catch (err) {
    console.error('Erreur updateSupplier:', err);
    res.status(500).json({ error: 'Erreur modification fournisseur.' });
  }
}
