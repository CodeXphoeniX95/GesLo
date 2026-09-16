import { getDb } from '../database/connection.js';

function generateRef(db) {
  const last = db.prepare('SELECT reference FROM products ORDER BY id DESC LIMIT 1').get();
  if (!last || !last.reference) return 'PRD-0001';
  const num = parseInt(last.reference.split('-')[1] || '0') + 1;
  return `PRD-${String(num).padStart(4, '0')}`;
}

export function getProducts(req, res) {
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

  res.json(db.prepare(query).all(...params));
}

export function getProduct(req, res) {
  const db = getDb();
  const product = db.prepare(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.id = ?`
  ).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
  res.json(product);
}

export function createProduct(req, res) {
  const {
    name, barcode, category_id, unit, unit_quantity,
    purchase_price, sale_price, stock_quantity,
    alert_threshold, supplier_id, image_path,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });
  if (sale_price === undefined || sale_price < 0) {
    return res.status(400).json({ error: 'Le prix de vente doit être ≥ 0.' });
  }

  const db = getDb();
  const reference = generateRef(db);

  // unit_quantity : nombre d'unités de base contenues dans l'unité (ex: 40 pour un carton de 40 pièces)
  // null = unité simple (pas de contenance)
  const unitQty = unit_quantity && Number(unit_quantity) > 1 ? Number(unit_quantity) : null;

  const result = db.prepare(
    `INSERT INTO products
     (name, reference, barcode, category_id, unit, unit_quantity, purchase_price, sale_price,
      stock_quantity, alert_threshold, supplier_id, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, reference, barcode || null, category_id || null,
    unit || 'pièce', unitQty,
    purchase_price || 0, sale_price,
    stock_quantity || 0, alert_threshold || 5,
    supplier_id || null, image_path || null
  );

  if (stock_quantity && stock_quantity > 0) {
    db.prepare(
      `INSERT INTO stock_movements
       (product_id, type, quantity, quantity_before, quantity_after, note, user_id)
       VALUES (?, 'initial', ?, 0, ?, 'Stock initial', ?)`
    ).run(result.lastInsertRowid, stock_quantity, stock_quantity, req.user.id);
  }

  res.status(201).json({ id: result.lastInsertRowid, reference, message: 'Produit créé.' });
}

export function updateProduct(req, res) {
  const { id } = req.params;
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

  const {
    name, barcode, category_id, unit, unit_quantity,
    purchase_price, sale_price, alert_threshold, supplier_id, image_path,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Le nom est requis.' });
  if (sale_price !== undefined && sale_price < 0) {
    return res.status(400).json({ error: 'Le prix de vente doit être ≥ 0.' });
  }

  const unitQty = unit_quantity && Number(unit_quantity) > 1 ? Number(unit_quantity) : null;

  db.prepare(
    `UPDATE products SET
     name=?, barcode=?, category_id=?, unit=?, unit_quantity=?,
     purchase_price=?, sale_price=?, alert_threshold=?,
     supplier_id=?, image_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(
    name, barcode || null, category_id || null, unit || 'pièce', unitQty,
    purchase_price || 0, sale_price ?? product.sale_price,
    alert_threshold || 5, supplier_id || null, image_path || null, id
  );

  res.json({ message: 'Produit mis à jour.' });
}

export function updateProductStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;
  const db = getDb();
  db.prepare('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(is_active ? 1 : 0, id);
  res.json({ message: `Produit ${is_active ? 'activé' : 'désactivé'}.` });
}

export function deleteProduct(req, res) {
  const { id } = req.params;
  const db = getDb();
  db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  res.json({ message: 'Produit désactivé.' });
}

export function getLowStockProducts(req, res) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1 AND p.stock_quantity <= p.alert_threshold
     ORDER BY p.stock_quantity ASC`
  ).all();
  res.json(rows);
}

// Retourne le nombre d'unités-contenants consommées et restantes
export function getUnitBreakdown(req, res) {
  const db = getDb();
  const products = db.prepare(
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
