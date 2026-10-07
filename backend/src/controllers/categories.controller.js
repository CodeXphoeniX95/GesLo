import { getDb } from '../database/connection.js';

export async function getCategories(req, res) {
  try {
    const db = getDb();
    const rows = (await db.prepare(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE c.is_active = 1
       GROUP BY c.id ORDER BY c.name`
    ).all()) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getCategories:', err);
    res.json([]);
  }
}

export async function createCategory(req, res) {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const existing = await db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Cette catégorie existe déjà.' });

    const result = await db.prepare(
      'INSERT INTO categories (name, description, color) VALUES (?, ?, ?)'
    ).run(name, description || null, color || '#4f46e5');

    res.status(201).json({ id: result.lastInsertRowid, name, description, color });
  } catch (err) {
    console.error('Erreur createCategory:', err);
    res.status(500).json({ error: 'Erreur création catégorie.' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom est requis.' });

    const db = getDb();
    const cat = await db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!cat) return res.status(404).json({ error: 'Catégorie introuvable.' });

    await db.prepare(
      'UPDATE categories SET name = ?, description = ?, color = ? WHERE id = ?'
    ).run(name, description || null, color || '#4f46e5', id);

    res.json({ message: 'Catégorie mise à jour.' });
  } catch (err) {
    console.error('Erreur updateCategory:', err);
    res.status(500).json({ error: 'Erreur modification catégorie.' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const products = (await db.prepare(
      'SELECT COUNT(*) AS cnt FROM products WHERE category_id = ? AND is_active = 1'
    ).get(id)) || { cnt: 0 };

    if (products.cnt > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer : cette catégorie contient des produits actifs.' });
    }

    await db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id);
    res.json({ message: 'Catégorie supprimée.' });
  } catch (err) {
    console.error('Erreur deleteCategory:', err);
    res.status(500).json({ error: 'Erreur suppression catégorie.' });
  }
}
