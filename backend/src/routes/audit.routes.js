import { Router } from 'express';
import { getDb } from '../database/connection.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, requireAdmin, (req, res) => {
  const { limit = 100, offset = 0, user_id, action } = req.query;
  const db = getDb();
  let query = `
    SELECT al.*, u.full_name AS user_name
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }
  if (action) { query += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json(db.prepare(query).all(...params));
});

export default router;
