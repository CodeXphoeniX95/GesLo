import { getDb } from '../database/connection.js';

export function getCustomers(req, res) {
  const { search } = req.query;
  const db = getDb();
  let query = `SELECT * FROM customers WHERE is_active = 1`;
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY name';
  res.json(db.prepare(query).all(...params));
}

export function getCustomer(req, res) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable.' });

  const sales = db.prepare(
    `SELECT s.sale_number, s.total, s.payment_method, s.created_at
     FROM sales s WHERE s.customer_id = ? AND s.status = 'completed'
     ORDER BY s.created_at DESC LIMIT 20`
  ).all(req.params.id);

  res.json({ ...customer, recent_sales: sales });
}

export function createCustomer(req, res) {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)'
  ).run(name, phone || null, address || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Client créé.' });
}

export function updateCustomer(req, res) {
  const { id } = req.params;
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

  const db = getDb();
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable.' });

  db.prepare(
    'UPDATE customers SET name=?, phone=?, address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(name, phone || null, address || null, id);

  res.json({ message: 'Client mis à jour.' });
}

export function recordDebtPayment(req, res) {
  const { id } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable.' });
  if (customer.balance_due < amount) {
    return res.status(400).json({ error: `Montant supérieur à la dette (${customer.balance_due}).` });
  }

  db.prepare(
    'UPDATE customers SET balance_due = balance_due - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(amount, id);

  res.json({ message: 'Paiement de dette enregistré.', new_balance: customer.balance_due - amount });
}
