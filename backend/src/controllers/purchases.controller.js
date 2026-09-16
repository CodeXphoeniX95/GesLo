import { getDb } from '../database/connection.js';

function generatePurchaseNumber(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = db.prepare(
    "SELECT purchase_number FROM purchases WHERE purchase_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`ACH-${today}%`);
  const seq = last ? parseInt(last.purchase_number.split('-').pop()) + 1 : 1;
  return `ACH-${today}-${String(seq).padStart(4, '0')}`;
}

export function getPurchases(req, res) {
  const { start_date, end_date, supplier_id } = req.query;
  const db = getDb();
  let query = `
    SELECT p.*, s.name AS supplier_name, u.full_name AS user_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (start_date) { query += ' AND date(p.created_at) >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND date(p.created_at) <= ?'; params.push(end_date); }
  if (supplier_id) { query += ' AND p.supplier_id = ?'; params.push(supplier_id); }
  query += ' ORDER BY p.created_at DESC LIMIT 100';
  res.json(db.prepare(query).all(...params));
}

export function getPurchase(req, res) {
  const db = getDb();
  const purchase = db.prepare(
    `SELECT p.*, s.name AS supplier_name, u.full_name AS user_name
     FROM purchases p
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     LEFT JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`
  ).get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Achat introuvable.' });
  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);
  res.json({ ...purchase, items });
}

export function createPurchase(req, res) {
  const { supplier_id, items, amount_paid, note } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'L\'achat doit contenir au moins un article.' });
  }

  const db = getDb();
  let total = 0;
  const enriched = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0 || !item.unit_price) {
      return res.status(400).json({ error: 'Chaque article nécessite produit, quantité et prix.' });
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) return res.status(404).json({ error: `Produit ${item.product_id} introuvable.` });
    const lineTotal = item.unit_price * item.quantity;
    total += lineTotal;
    enriched.push({ ...item, product_name: product.name, total: lineTotal, stock_before: product.stock_quantity });
  }

  const paid = amount_paid || total;
  const balanceDue = total - paid;

  const tx = db.transaction(() => {
    const number = generatePurchaseNumber(db);
    const result = db.prepare(
      `INSERT INTO purchases (purchase_number, supplier_id, user_id, total, amount_paid, balance_due, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(number, supplier_id || null, req.user.id, total, paid, balanceDue, note || null);

    const purchaseId = result.lastInsertRowid;

    for (const item of enriched) {
      db.prepare(
        `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(purchaseId, item.product_id, item.product_name, item.quantity, item.unit_price, item.total);

      const newQty = item.stock_before + item.quantity;
      db.prepare('UPDATE products SET stock_quantity = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newQty, item.unit_price, item.product_id);

      db.prepare(
        `INSERT INTO stock_movements
         (product_id, type, quantity, quantity_before, quantity_after, reference_id, reference_type, user_id)
         VALUES (?, 'purchase', ?, ?, ?, ?, 'purchase', ?)`
      ).run(item.product_id, item.quantity, item.stock_before, newQty, purchaseId, req.user.id);
    }

    if (supplier_id && balanceDue > 0) {
      db.prepare('UPDATE suppliers SET balance_due = balance_due + ? WHERE id = ?')
        .run(balanceDue, supplier_id);
    }

    return { purchaseId, number };
  });

  const result = tx();
  res.status(201).json({ id: result.purchaseId, purchase_number: result.number, message: 'Achat enregistré.' });
}
