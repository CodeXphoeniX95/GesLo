import { getDb } from '../database/connection.js';

export async function getCustomers(req, res) {
  try {
    const { search } = req.query;
    const db = getDb();
    let query = `SELECT * FROM customers WHERE is_active = 1`;
    const params = [];
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY name';
    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getCustomers:', err);
    res.json([]);
  }
}

export async function getCustomer(req, res) {
  try {
    const db = getDb();
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Client introuvable.' });

    const sales = (await db.prepare(
      `SELECT s.sale_number, s.total, s.payment_method, s.created_at
       FROM sales s WHERE s.customer_id = ? AND s.status = 'completed'
       ORDER BY s.created_at DESC LIMIT 20`
    ).all(req.params.id)) || [];

    res.json({ ...customer, recent_sales: Array.isArray(sales) ? sales : [] });
  } catch (err) {
    console.error('Erreur getCustomer:', err);
    res.status(500).json({ error: 'Erreur chargement client.' });
  }
}

export async function createCustomer(req, res) {
  try {
    const { name, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const result = await db.prepare(
      'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)'
    ).run(name, phone || null, address || null);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Client créé.' });
  } catch (err) {
    console.error('Erreur createCustomer:', err);
    res.status(500).json({ error: 'Erreur création client.' });
  }
}

export async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const customer = await db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ error: 'Client introuvable.' });

    await db.prepare(
      'UPDATE customers SET name=?, phone=?, address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name, phone || null, address || null, id);

    res.json({ message: 'Client mis à jour.' });
  } catch (err) {
    console.error('Erreur updateCustomer:', err);
    res.status(500).json({ error: 'Erreur modification client.' });
  }
}

export async function recordDebtPayment(req, res) {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const db = getDb();
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ error: 'Client introuvable.' });
    if (customer.balance_due < amount) {
      return res.status(400).json({ error: `Montant supérieur à la dette (${customer.balance_due}).` });
    }

    await db.prepare(
      'UPDATE customers SET balance_due = balance_due - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(amount, id);

    res.json({ message: 'Paiement de dette enregistré.', new_balance: customer.balance_due - amount });
  } catch (err) {
    console.error('Erreur recordDebtPayment:', err);
    res.status(500).json({ error: 'Erreur paiement dette.' });
  }
}
