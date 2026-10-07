import { getDb } from '../database/connection.js';

export async function getStock(req, res) {
  try {
    const { search, low_only } = req.query;
    const db = getDb();
    let query = `
      SELECT p.id, p.name, p.reference, p.unit, p.stock_quantity,
             p.alert_threshold, p.purchase_price, p.sale_price,
             c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];
    if (low_only === 'true') { query += ' AND p.stock_quantity <= p.alert_threshold'; }
    if (search) {
      query += ' AND (p.name LIKE ? OR p.reference LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY p.name';
    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getStock:', err);
    res.json([]);
  }
}

export async function addStockEntry(req, res) {
  try {
    const { product_id, quantity, note, type } = req.body;
    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Produit et quantité (> 0) requis.' });
    }

    const db = getDb();
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const movType = type || 'purchase';
    const stockBefore = Number(product.stock_quantity) || 0;
    const newQty = stockBefore + Number(quantity);

    await db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newQty, product_id);
    await db.prepare(
      `INSERT INTO stock_movements
       (product_id, type, quantity, quantity_before, quantity_after, note, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(product_id, movType, quantity, stockBefore, newQty, note || null, req.user.id);

    res.json({ message: 'Entrée de stock enregistrée.', new_quantity: newQty });
  } catch (err) {
    console.error('Erreur addStockEntry:', err);
    res.status(500).json({ error: 'Erreur entrée stock.' });
  }
}

export async function addStockExit(req, res) {
  try {
    const { product_id, quantity, note, type } = req.body;
    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Produit et quantité (> 0) requis.' });
    }

    const db = getDb();
    const settings = await db.prepare('SELECT allow_negative_stock FROM business_settings LIMIT 1').get();
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const stockBefore = Number(product.stock_quantity) || 0;
    if (!settings?.allow_negative_stock && stockBefore < quantity) {
      return res.status(400).json({ error: `Stock insuffisant. Disponible : ${stockBefore} ${product.unit}.` });
    }

    const movType = type || 'loss';
    const newQty = stockBefore - Number(quantity);

    await db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newQty, product_id);
    await db.prepare(
      `INSERT INTO stock_movements
       (product_id, type, quantity, quantity_before, quantity_after, note, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(product_id, movType, -quantity, stockBefore, newQty, note || null, req.user.id);

    res.json({ message: 'Sortie de stock enregistrée.', new_quantity: newQty });
  } catch (err) {
    console.error('Erreur addStockExit:', err);
    res.status(500).json({ error: 'Erreur sortie stock.' });
  }
}

export async function getStockMovements(req, res) {
  try {
    const { product_id, type, start_date, end_date, limit = 100 } = req.query;
    const db = getDb();
    let query = `
      SELECT sm.*, p.name AS product_name, p.unit, u.full_name AS user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (product_id) { query += ' AND sm.product_id = ?'; params.push(product_id); }
    if (type) { query += ' AND sm.type = ?'; params.push(type); }
    if (start_date) { query += ' AND date(sm.created_at) >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND date(sm.created_at) <= ?'; params.push(end_date); }
    query += ' ORDER BY sm.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const rows = (await db.prepare(query).all(...params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getStockMovements:', err);
    res.json([]);
  }
}

export async function manualCorrection(req, res) {
  try {
    const { product_id, new_quantity, note } = req.body;
    if (product_id === undefined || new_quantity === undefined) {
      return res.status(400).json({ error: 'Produit et nouvelle quantité requis.' });
    }
    if (!note) return res.status(400).json({ error: 'Une justification est requise pour une correction manuelle.' });

    const db = getDb();
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const stockBefore = Number(product.stock_quantity) || 0;
    const diff = Number(new_quantity) - stockBefore;

    await db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(new_quantity, product_id);
    await db.prepare(
      `INSERT INTO stock_movements
       (product_id, type, quantity, quantity_before, quantity_after, note, user_id)
       VALUES (?, 'manual_correction', ?, ?, ?, ?, ?)`
    ).run(product_id, diff, stockBefore, new_quantity, note, req.user.id);

    res.json({ message: 'Stock corrigé.', new_quantity });
  } catch (err) {
    console.error('Erreur manualCorrection:', err);
    res.status(500).json({ error: 'Erreur correction manuelle.' });
  }
}
