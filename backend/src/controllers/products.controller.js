import { getDb } from '../database/connection.js';

async function generateRef(db) {
  try {
    const last = await db.prepare('SELECT reference FROM products ORDER BY id DESC LIMIT 1').get();
    if (last && last.reference) {
      const parts = String(last.reference).split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        return `PRD-${String(num + 1).padStart(4, '0')}`;
      }
    }
  } catch (err) {
    console.warn('generateRef fallback:', err.message);
  }
  const timestamp = Date.now().toString().slice(-6);
  return `PRD-${timestamp}`;
}

export async function getProducts(req, res) {
  const { category_id, search, active_only } = req.query;
  const db = getDb();

  let query = `
    SELECT p.*, c.name AS category_name, s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (active_only !== 'false') { query += ' AND p.is_active = 1'; }
  if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.reference LIKE ? OR p.barcode LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  query += ' ORDER BY p.name';

  const rows = await db.prepare(query).all(...params);
  res.json(rows);
}

export async function getProduct(req, res) {
  const db = getDb();
  const product = await db.prepare(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.id = ?`
  ).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
  res.json(product);
}

export async function createProduct(req, res) {
  try {
    const {
      name, barcode, category_id, unit, unit_quantity,
      purchase_price, sale_price, stock_quantity,
      alert_threshold, supplier_id, image_path,
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom du produit est requis.' });
    if (sale_price === undefined || sale_price === '' || Number(sale_price) < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être supérieur ou égal à 0.' });
    }

    const db = getDb();
    const reference = await generateRef(db);
    const unitQty = unit_quantity && Number(unit_quantity) > 1 ? Number(unit_quantity) : null;

    const result = await db.prepare(
      `INSERT INTO products
       (name, reference, barcode, category_id, unit, unit_quantity, purchase_price, sale_price,
        stock_quantity, alert_threshold, supplier_id, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name.trim(),
      reference,
      barcode?.trim() || null,
      category_id ? Number(category_id) : null,
      unit || 'pièce',
      unitQty,
      purchase_price ? Number(purchase_price) : 0,
      Number(sale_price),
      stock_quantity ? Number(stock_quantity) : 0,
      alert_threshold ? Number(alert_threshold) : 5,
      supplier_id ? Number(supplier_id) : null,
      image_path || null
    );

    const initialStock = stock_quantity ? Number(stock_quantity) : 0;
    if (initialStock > 0) {
      const userId = req.user?.id || 1;
      await db.prepare(
        `INSERT INTO stock_movements
         (product_id, type, quantity, quantity_before, quantity_after, note, user_id)
         VALUES (?, 'initial', ?, 0, ?, 'Stock initial', ?)`
      ).run(result.lastInsertRowid, initialStock, initialStock, userId);
    }

    res.status(201).json({ id: result.lastInsertRowid, reference, message: 'Produit créé.' });
  } catch (err) {
    console.error('Erreur createProduct:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la création du produit.' });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    const {
      name, barcode, category_id, unit, unit_quantity,
      purchase_price, sale_price, alert_threshold, supplier_id, image_path,
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom du produit est requis.' });
    if (sale_price !== undefined && sale_price !== '' && Number(sale_price) < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être supérieur ou égal à 0.' });
    }

    const unitQty = unit_quantity && Number(unit_quantity) > 1 ? Number(unit_quantity) : null;

    await db.prepare(
      `UPDATE products SET
       name=?, barcode=?, category_id=?, unit=?, unit_quantity=?,
       purchase_price=?, sale_price=?, alert_threshold=?,
       supplier_id=?, image_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      name.trim(),
      barcode?.trim() || null,
      category_id ? Number(category_id) : null,
      unit || 'pièce',
      unitQty,
      purchase_price ? Number(purchase_price) : 0,
      sale_price !== undefined && sale_price !== '' ? Number(sale_price) : product.sale_price,
      alert_threshold ? Number(alert_threshold) : 5,
      supplier_id ? Number(supplier_id) : null,
      image_path || null,
      Number(id)
    );

    res.json({ message: 'Produit mis à jour.' });
  } catch (err) {
    console.error('Erreur updateProduct:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la mise à jour du produit.' });
  }
}

export async function updateProductStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;
  const db = getDb();
  await db.prepare('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(is_active ? 1 : 0, id);
  res.json({ message: `Produit ${is_active ? 'activé' : 'désactivé'}.` });
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const saleItem = await db.prepare('SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1').get(id);
    const purchaseItem = await db.prepare('SELECT 1 FROM purchase_items WHERE product_id = ? LIMIT 1').get(id);

    if (saleItem || purchaseItem) {
      await db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return res.json({
        message: 'Ce produit possède un historique de ventes ou d\'achats. Il a donc été désactivé pour conserver l\'intégrité des rapports.',
        deactivated: true
      });
    } else {
      await db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return res.json({
        message: 'Produit supprimé définitivement.',
        deleted: true
      });
    }
  } catch (err) {
    console.error('Erreur deleteProduct:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit.' });
  }
}

export async function getLowStockProducts(req, res) {
  const db = getDb();
  const rows = await db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1 AND p.stock_quantity <= p.alert_threshold
     ORDER BY p.stock_quantity ASC`
  ).all();
  res.json(rows);
}

export async function getUnitBreakdown(req, res) {
  const db = getDb();
  const products = await db.prepare(
    `SELECT id, name, unit, unit_quantity, stock_quantity FROM products
     WHERE is_active = 1 AND unit_quantity IS NOT NULL AND unit_quantity > 1`
  ).all();

  const breakdown = products.map((p) => {
    const containers = Math.floor(p.stock_quantity / p.unit_quantity);
    const remainder = p.stock_quantity % p.unit_quantity;
    return {
      ...p,
      containers_remaining: containers,
      units_remainder: remainder,
      display: containers > 0
        ? `${containers} ${p.unit}${containers > 1 ? 's' : ''} + ${remainder} pièce${remainder !== 1 ? 's' : ''}`
        : `${remainder} pièce${remainder !== 1 ? 's' : ''}`,
    };
  });

  res.json(breakdown);
}
