import { getDb } from '../database/connection.js';

function generateSaleNumber(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = db.prepare(
    "SELECT sale_number FROM sales WHERE sale_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`VTE-${today}%`);
  const seq = last ? parseInt(last.sale_number.split('-').pop()) + 1 : 1;
  return `VTE-${today}-${String(seq).padStart(4, '0')}`;
}

export function getSales(req, res) {
  const { start_date, end_date, payment_method, user_id, limit = 50, offset = 0 } = req.query;
  const db = getDb();
  let query = `
    SELECT s.*, u.full_name AS cashier_name,
           c.name AS customer_name,
           COUNT(si.id) AS item_count
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.status != 'pending'
  `;
  const params = [];
  if (start_date) { query += ' AND date(s.created_at) >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND date(s.created_at) <= ?'; params.push(end_date); }
  if (payment_method) { query += ' AND s.payment_method = ?'; params.push(payment_method); }
  if (user_id) { query += ' AND s.user_id = ?'; params.push(user_id); }
  query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json(db.prepare(query).all(...params));
}

export function getSale(req, res) {
  const db = getDb();
  const sale = db.prepare(
    `SELECT s.*, u.full_name AS cashier_name, c.name AS customer_name
     FROM sales s
     LEFT JOIN users u ON s.user_id = u.id
     LEFT JOIN customers c ON s.customer_id = c.id
     WHERE s.id = ?`
  ).get(req.params.id);

  if (!sale) return res.status(404).json({ error: 'Vente introuvable.' });

  const items = db.prepare(
    'SELECT * FROM sale_items WHERE sale_id = ?'
  ).all(req.params.id);

  res.json({ ...sale, items });
}

export function createSale(req, res) {
  const { items, payment_method, customer_id, discount = 0, note } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'La vente doit contenir au moins un article.' });
  }

  const db = getDb();
  const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();

  // Vérifier le stock et calculer les totaux
  let subtotal = 0;
  const enrichedItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ error: 'Chaque article doit avoir un produit et une quantité > 0.' });
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
    if (!product) return res.status(404).json({ error: `Produit ${item.product_id} introuvable.` });

    if (!settings?.allow_negative_stock && product.stock_quantity < item.quantity) {
      return res.status(400).json({
        error: `Stock insuffisant pour "${product.name}". Disponible : ${product.stock_quantity} ${product.unit}.`
      });
    }

    const unitPrice = item.unit_price ?? product.sale_price;
    const lineTotal = unitPrice * item.quantity - (item.discount || 0);
    subtotal += lineTotal;

    enrichedItems.push({
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      purchase_price: product.purchase_price,
      discount: item.discount || 0,
      total: lineTotal,
      stock_before: product.stock_quantity,
    });
  }

  const taxRate = settings?.tax_rate || 0;
  const tax = (subtotal - discount) * taxRate / 100;
  const total = subtotal - discount + tax;

  const processSale = db.transaction(() => {
    const saleNumber = generateSaleNumber(db);

    const saleResult = db.prepare(
      `INSERT INTO sales
       (sale_number, user_id, customer_id, subtotal, discount, tax, total,
        amount_paid, payment_method, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      saleNumber, req.user.id, customer_id || null,
      subtotal, discount, tax, total, total,
      payment_method || 'cash', note || null
    );

    const saleId = saleResult.lastInsertRowid;

    let saleProfit = 0;
    for (const item of enrichedItems) {
      db.prepare(
        `INSERT INTO sale_items
         (sale_id, product_id, product_name, quantity, unit_price, purchase_price, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(saleId, item.product_id, item.product_name, item.quantity,
        item.unit_price, item.purchase_price, item.discount, item.total);

      saleProfit += (item.unit_price - item.purchase_price) * item.quantity - item.discount;

      const newQty = item.stock_before - item.quantity;
      db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newQty, item.product_id);

      db.prepare(
        `INSERT INTO stock_movements
         (product_id, type, quantity, quantity_before, quantity_after, reference_id, reference_type, user_id)
         VALUES (?, 'sale', ?, ?, ?, ?, 'sale', ?)`
      ).run(item.product_id, -item.quantity, item.stock_before, newQty, saleId, req.user.id);
    }

    // Traçabilité des commissions (si activé)
    if (settings?.enable_commissions) {
      const seller = db.prepare('SELECT commission_rate, commission_type FROM users WHERE id = ?').get(req.user.id);
      let userCommission = 0;
      if (seller && seller.commission_rate > 0) {
        if (seller.commission_type === 'fixed') {
          userCommission = seller.commission_rate;
        } else {
          userCommission = Math.max(0, (saleProfit * seller.commission_rate) / 100);
        }
      }

      let poolCommission = 0;
      const poolRate = settings.pool_commission_rate || 0;
      if (poolRate > 0) {
        poolCommission = Math.max(0, (saleProfit * poolRate) / 100);
      }

      const totalCommission = userCommission + poolCommission;
      const caisseNet = total - totalCommission;

      db.prepare(
        `INSERT INTO sale_commissions
         (sale_id, user_id, sale_total, sale_profit, user_commission, pool_commission, total_commission, caisse_net)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(saleId, req.user.id, total, saleProfit, userCommission, poolCommission, totalCommission, caisseNet);
    }

    // Mettre à jour les stats client
    if (customer_id) {
      db.prepare(
        `UPDATE customers SET
         total_purchases = total_purchases + ?,
         last_transaction_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(total, customer_id);
    }

    return { saleId, saleNumber, total };
  });

  const result = processSale();
  res.status(201).json({
    id: result.saleId,
    sale_number: result.saleNumber,
    total: result.total,
    message: 'Vente enregistrée avec succès.',
  });
}

export function cancelSale(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const db = getDb();

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return res.status(404).json({ error: 'Vente introuvable.' });
  if (sale.status === 'cancelled') return res.status(400).json({ error: 'Vente déjà annulée.' });

  // Seul admin/gérant peut annuler
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à annuler une vente.' });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);

  const cancelTx = db.transaction(() => {
    db.prepare(
      'UPDATE sales SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('cancelled', `Annulée : ${reason || 'sans motif'}`, id);

    for (const item of items) {
      const product = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.product_id);
      const newQty = product.stock_quantity + item.quantity;
      db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newQty, item.product_id);

      db.prepare(
        `INSERT INTO stock_movements
         (product_id, type, quantity, quantity_before, quantity_after, reference_id, reference_type, note, user_id)
         VALUES (?, 'return_customer', ?, ?, ?, ?, 'sale', ?, ?)`
      ).run(item.product_id, item.quantity, product.stock_quantity, newQty, id,
        `Annulation vente ${sale.sale_number}`, req.user.id);
    }

    // Supprimer les commissions annulées
    db.prepare('DELETE FROM sale_commissions WHERE sale_id = ?').run(id);

    db.prepare(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'CANCEL_SALE', 'sales', id, JSON.stringify({ reason }));
  });

  cancelTx();
  res.json({ message: 'Vente annulée et stock restauré.' });
}
