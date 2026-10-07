import { getDb } from '../database/connection.js';

async function generatePurchaseNumber(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = await db.prepare(
    "SELECT purchase_number FROM purchases WHERE purchase_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`ACH-${today}%`);
  const seq = last ? parseInt(last.purchase_number.split('-').pop()) + 1 : 1;
  return `ACH-${today}-${String(seq).padStart(4, '0')}`;
}

export async function getPurchases(req, res) {
  try {
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
    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getPurchases:', err);
    res.json([]);
  }
}

export async function getPurchase(req, res) {
  try {
    const db = getDb();
    const purchase = await db.prepare(
      `SELECT p.*, s.name AS supplier_name, u.full_name AS user_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`
    ).get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Achat introuvable.' });
    const items = (await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id)) || [];
    res.json({ ...purchase, items: Array.isArray(items) ? items : [] });
  } catch (err) {
    console.error('Erreur getPurchase:', err);
    res.status(500).json({ error: 'Erreur chargement achat.' });
  }
}

export async function createPurchase(req, res) {
  try {
    const { supplier_id, items, amount_paid, note } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'L\'achat doit contenir au moins un article.' });
    }

    const db = getDb();
    let total = 0;
    const enriched = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0 || !item.unit_price) {
        return res.status(400).json({ error: 'Chaque article nécessite produit, quantité et prix.' });
      }
      const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) return res.status(404).json({ error: `Produit ${item.product_id} introuvable.` });
      const lineTotal = item.unit_price * item.quantity;
      total += lineTotal;
      enriched.push({ ...item, product_name: product.name, total: lineTotal, stock_before: Number(product.stock_quantity) || 0 });
    }

    const paid = amount_paid || total;
    const balanceDue = total - paid;
    const number = await generatePurchaseNumber(db);

    const result = await db.prepare(
      `INSERT INTO purchases (purchase_number, supplier_id, user_id, total, amount_paid, balance_due, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(number, supplier_id || null, req.user.id, total, paid, balanceDue, note || null);

    const purchaseId = result.lastInsertRowid;

    for (const item of enriched) {
      await db.prepare(
        `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(purchaseId, item.product_id, item.product_name, item.quantity, item.unit_price, item.total);

      const newQty = item.stock_before + item.quantity;
      await db.prepare('UPDATE products SET stock_quantity = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newQty, item.unit_price, item.product_id);

      await db.prepare(
        `INSERT INTO stock_movements
         (product_id, type, quantity, quantity_before, quantity_after, reference_id, reference_type, user_id)
         VALUES (?, 'purchase', ?, ?, ?, ?, 'purchase', ?)`
      ).run(item.product_id, item.quantity, item.stock_before, newQty, purchaseId, req.user.id);
    }

    if (supplier_id && balanceDue > 0) {
      await db.prepare('UPDATE suppliers SET balance_due = balance_due + ? WHERE id = ?')
        .run(balanceDue, supplier_id);
    }

    res.status(201).json({ id: purchaseId, purchase_number: number, message: 'Achat enregistré.' });
  } catch (err) {
    console.error('Erreur createPurchase:', err);
    res.status(500).json({ error: 'Erreur création achat.' });
  }
}
