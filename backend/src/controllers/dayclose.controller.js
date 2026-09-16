import { getDb } from '../database/connection.js';

// Clôturer la journée : enregistre un snapshot du résumé du jour
export function closeDay(req, res) {
  const db = getDb();
  const date = req.body.date || new Date().toISOString().slice(0, 10);

  // Vérifier si déjà clôturée
  const existing = db.prepare('SELECT id FROM day_closings WHERE closing_date = ?').get(date);
  if (existing) {
    return res.status(409).json({ error: `La journée du ${date} est déjà clôturée.` });
  }

  const sales = db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue,
     COALESCE(SUM(discount),0) AS total_discount
     FROM sales WHERE date(created_at) = ? AND status = 'completed'`
  ).get(date);

  const profit = db.prepare(
    `SELECT COALESCE(SUM(si.quantity*(si.unit_price - si.purchase_price)),0) AS profit
     FROM sale_items si JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) = ? AND s.status = 'completed'`
  ).get(date);

  const expenses = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
     WHERE expense_date = ? AND is_deleted = 0`
  ).get(date);

  db.prepare(
    `INSERT INTO day_closings
     (closing_date, sale_count, revenue, profit, expenses, total_discount, closed_by)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    date,
    sales.count,
    sales.revenue,
    profit.profit,
    expenses.total,
    sales.total_discount,
    req.user.id
  );

  db.prepare(
    'INSERT INTO audit_log (user_id, action, entity, details) VALUES (?,?,?,?)'
  ).run(req.user.id, 'CLOSE_DAY', 'day_closings', JSON.stringify({ date }));

  res.status(201).json({
    message: `Journée du ${date} clôturée avec succès.`,
    summary: {
      date,
      sale_count: sales.count,
      revenue: sales.revenue,
      profit: profit.profit,
      expenses: expenses.total,
    },
  });
}

export function getDayClosings(req, res) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT dc.*, u.full_name AS closed_by_name
     FROM day_closings dc LEFT JOIN users u ON dc.closed_by = u.id
     ORDER BY dc.closing_date DESC LIMIT 30`
  ).all();
  res.json(rows);
}

export function getTodayStatus(req, res) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const closed = db.prepare(
    `SELECT dc.*, u.full_name AS closed_by_name
     FROM day_closings dc
     LEFT JOIN users u ON dc.closed_by = u.id
     WHERE dc.closing_date = ?`
  ).get(today);
  res.json({
    date: today,
    is_closed: !!closed,
    closed_by_name: closed?.closed_by_name || null,
    closed_at: closed?.created_at || null,
    revenue: closed?.revenue || 0,
    sale_count: closed?.sale_count || 0,
  });
}

// Rapport statistiques avancées
export function getStatistics(req, res) {
  const db = getDb();
  const { period = '30' } = req.query; // jours
  const days = Math.min(Math.max(parseInt(period), 7), 365);

  // Ventes par jour sur la période
  const salesByDay = db.prepare(
    `SELECT date(created_at) AS day,
     COUNT(*) AS count, SUM(total) AS revenue,
     SUM(total - discount) AS net_revenue
     FROM sales
     WHERE date(created_at) >= date('now', '-${days} days')
     AND status = 'completed'
     GROUP BY day ORDER BY day`
  ).all();

  // Top 10 produits
  const topProducts = db.prepare(
    `SELECT si.product_name, SUM(si.quantity) AS qty,
     SUM(si.total) AS revenue,
     SUM(si.quantity*(si.unit_price - si.purchase_price)) AS profit
     FROM sale_items si JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) >= date('now', '-${days} days')
     AND s.status = 'completed'
     GROUP BY si.product_id ORDER BY qty DESC LIMIT 10`
  ).all();

  // Répartition paiements
  const byPayment = db.prepare(
    `SELECT payment_method, COUNT(*) AS count, SUM(total) AS revenue
     FROM sales
     WHERE date(created_at) >= date('now', '-${days} days')
     AND status = 'completed'
     GROUP BY payment_method ORDER BY revenue DESC`
  ).all();

  // Dépenses par catégorie
  const expByCategory = db.prepare(
    `SELECT ec.name AS category, SUM(e.amount) AS total
     FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
     WHERE e.expense_date >= date('now', '-${days} days') AND e.is_deleted = 0
     GROUP BY e.category_id ORDER BY total DESC`
  ).all();

  // Totaux globaux
  const totals = db.prepare(
    `SELECT COUNT(*) AS sale_count,
     COALESCE(SUM(total),0) AS revenue,
     COALESCE(SUM(discount),0) AS total_discount
     FROM sales
     WHERE date(created_at) >= date('now', '-${days} days')
     AND status = 'completed'`
  ).get();

  const totalProfit = db.prepare(
    `SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.purchase_price)),0) AS profit
     FROM sale_items si JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) >= date('now', '-${days} days')
     AND s.status = 'completed'`
  ).get();

  const totalExpenses = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
     WHERE expense_date >= date('now', '-${days} days') AND is_deleted = 0`
  ).get();

  // Ventes par heure (patterns)
  const byHour = db.prepare(
    `SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count, SUM(total) AS revenue
     FROM sales
     WHERE date(created_at) >= date('now', '-${days} days') AND status = 'completed'
     GROUP BY hour ORDER BY hour`
  ).all();

  // Clôtures récentes
  const closings = db.prepare(
    `SELECT * FROM day_closings ORDER BY closing_date DESC LIMIT ${days}`
  ).all();

  res.json({
    period: days,
    totals: {
      sale_count: totals.sale_count,
      revenue: totals.revenue,
      profit: totalProfit.profit,
      expenses: totalExpenses.total,
      net: totalProfit.profit - totalExpenses.total,
      avg_per_day: totals.sale_count > 0
        ? (totals.revenue / Math.max(salesByDay.length, 1)).toFixed(0)
        : 0,
    },
    sales_by_day: salesByDay,
    top_products: topProducts,
    by_payment: byPayment,
    expenses_by_category: expByCategory,
    by_hour: byHour,
    day_closings: closings,
  });
}
