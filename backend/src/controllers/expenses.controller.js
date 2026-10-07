import { getDb } from '../database/connection.js';

export async function getExpenseCategories(req, res) {
  try {
    const db = getDb();
    const rows = (await db.prepare('SELECT * FROM expense_categories ORDER BY name').all()) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getExpenseCategories:', err);
    res.json([]);
  }
}

export async function getExpenses(req, res) {
  try {
    const { start_date, end_date, category_id } = req.query;
    const db = getDb();
    let query = `
      SELECT e.*, ec.name AS category_name, u.full_name AS user_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.is_deleted = 0
    `;
    const params = [];
    if (start_date) { query += ' AND e.expense_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND e.expense_date <= ?'; params.push(end_date); }
    if (category_id) { query += ' AND e.category_id = ?'; params.push(category_id); }
    query += ' ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 200';
    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getExpenses:', err);
    res.json([]);
  }
}

export async function createExpense(req, res) {
  try {
    const { label, category_id, amount, expense_date, note } = req.body;
    if (!label) return res.status(400).json({ error: 'Le libellé est requis.' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Le montant doit être positif.' });
    if (!category_id) return res.status(400).json({ error: 'La catégorie est requise.' });

    const db = getDb();
    const result = await db.prepare(
      `INSERT INTO expenses (label, category_id, amount, expense_date, user_id, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(label, category_id, amount, expense_date || new Date().toISOString().slice(0, 10), req.user.id, note || null);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Dépense enregistrée.' });
  } catch (err) {
    console.error('Erreur createExpense:', err);
    res.status(500).json({ error: 'Erreur création dépense.' });
  }
}

export async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const { label, category_id, amount, expense_date, note } = req.body;
    if (!label) return res.status(400).json({ error: 'Le libellé est requis.' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Le montant doit être positif.' });

    const db = getDb();
    const exp = await db.prepare('SELECT * FROM expenses WHERE id = ? AND is_deleted = 0').get(id);
    if (!exp) return res.status(404).json({ error: 'Dépense introuvable.' });

    await db.prepare(
      `UPDATE expenses SET label=?, category_id=?, amount=?, expense_date=?, note=? WHERE id=?`
    ).run(label, category_id || exp.category_id, amount, expense_date || exp.expense_date, note || null, id);

    res.json({ message: 'Dépense mise à jour.' });
  } catch (err) {
    console.error('Erreur updateExpense:', err);
    res.status(500).json({ error: 'Erreur modification dépense.' });
  }
}

export async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.prepare('UPDATE expenses SET is_deleted = 1 WHERE id = ?').run(id);
    await db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'DELETE_EXPENSE', 'expenses', id);
    res.json({ message: 'Dépense supprimée.' });
  } catch (err) {
    console.error('Erreur deleteExpense:', err);
    res.status(500).json({ error: 'Erreur suppression dépense.' });
  }
}
