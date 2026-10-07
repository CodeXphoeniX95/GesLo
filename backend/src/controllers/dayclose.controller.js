import { getDb } from '../database/connection.js';

export async function closeDay(req, res) {
  try {
    const db = getDb();
    const date = req.body.date || new Date().toISOString().slice(0, 10);

    const existing = await db.prepare('SELECT id FROM day_closings WHERE closing_date = ?').get(date);
    if (existing) {
      return res.status(409).json({ error: `La journée du ${date} est déjà clôturée.` });
    }

    const sales = (await db.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue,
       COALESCE(SUM(discount),0) AS total_discount
       FROM sales WHERE date(created_at) = ? AND status = 'completed'`
    ).get(date)) || { count: 0, revenue: 0, total_discount: 0 };

    const profit = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity*(si.unit_price - si.purchase_price)),0) AS profit
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) = ? AND s.status = 'completed'`
    ).get(date)) || { profit: 0 };

    const expenses = (await db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE expense_date = ? AND is_deleted = 0`
    ).get(date)) || { total: 0 };

    await db.prepare(
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

    await db.prepare(
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
  } catch (err) {
    console.error('Erreur closeDay:', err);
    res.status(500).json({ error: 'Erreur lors de la clôture de journée.' });
  }
}

export async function getDayClosings(req, res) {
  try {
    const db = getDb();
    const rows = (await db.prepare(
      `SELECT dc.*, u.full_name AS closed_by_name
       FROM day_closings dc LEFT JOIN users u ON dc.closed_by = u.id
       ORDER BY dc.closing_date DESC LIMIT 30`
    ).all()) || [];
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('Erreur getDayClosings:', err);
    res.json([]);
  }
}

export async function getTodayStatus(req, res) {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const closed = await db.prepare(
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
  } catch (err) {
    console.error('Erreur getTodayStatus:', err);
    const today = new Date().toISOString().slice(0, 10);
    res.json({ date: today, is_closed: false, closed_by_name: null, closed_at: null, revenue: 0, sale_count: 0 });
  }
}

export async function getStatistics(req, res) {
  try {
    const db = getDb();
    const { period = '30' } = req.query;
    const days = Math.min(Math.max(parseInt(period) || 30, 1), 365);
    const dateFilter = days === 1 ? "date(created_at) = date('now')" : `date(created_at) >= date('now', '-${days} days')`;
    const expFilter = days === 1 ? "expense_date = date('now')" : `expense_date >= date('now', '-${days} days')`;

    const salesByDay = (await db.prepare(
      `SELECT date(created_at) AS day,
       COUNT(*) AS count, SUM(total) AS revenue,
       SUM(total - discount) AS net_revenue
       FROM sales
       WHERE ${dateFilter} AND status = 'completed'
       GROUP BY day ORDER BY day`
    ).all()) || [];

    const topProducts = (await db.prepare(
      `SELECT si.product_name, SUM(si.quantity) AS qty,
       SUM(si.total) AS revenue,
       SUM(si.quantity*(si.unit_price - si.purchase_price)) AS profit
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE ${dateFilter.replace(/created_at/g, 's.created_at')}
       AND s.status = 'completed'
       GROUP BY si.product_id ORDER BY qty DESC LIMIT 10`
    ).all()) || [];

    const byPayment = (await db.prepare(
      `SELECT payment_method, COUNT(*) AS count, SUM(total) AS revenue
       FROM sales
       WHERE ${dateFilter} AND status = 'completed'
       GROUP BY payment_method ORDER BY revenue DESC`
    ).all()) || [];

    const expByCategory = (await db.prepare(
      `SELECT ec.name AS category, SUM(e.amount) AS total
       FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE ${expFilter.replace(/expense_date/g, 'e.expense_date')} AND e.is_deleted = 0
       GROUP BY e.category_id ORDER BY total DESC`
    ).all()) || [];

    const totals = (await db.prepare(
      `SELECT COUNT(*) AS sale_count,
       COALESCE(SUM(total),0) AS revenue,
       COALESCE(SUM(discount),0) AS total_discount
       FROM sales
       WHERE ${dateFilter} AND status = 'completed'`
    ).get()) || { sale_count: 0, revenue: 0, total_discount: 0 };

    const totalProfit = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.purchase_price)),0) AS profit
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE ${dateFilter.replace(/created_at/g, 's.created_at')}
       AND s.status = 'completed'`
    ).get()) || { profit: 0 };

    const totalExpenses = (await db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE ${expFilter} AND is_deleted = 0`
    ).get()) || { total: 0 };

    const byHour = (await db.prepare(
      `SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count, SUM(total) AS revenue
       FROM sales
       WHERE ${dateFilter} AND status = 'completed'
       GROUP BY hour ORDER BY hour`
    ).all()) || [];

    const closings = (await db.prepare(
      `SELECT * FROM day_closings ORDER BY closing_date DESC LIMIT ${days}`
    ).all()) || [];

    res.json({
      period: days,
      totals: {
        sale_count: totals.sale_count,
        revenue: totals.revenue,
        profit: totalProfit.profit,
        expenses: totalExpenses.total,
        net: totalProfit.profit - totalExpenses.total,
        avg_per_day: totals.sale_count > 0
          ? (totals.revenue / Math.max(Array.isArray(salesByDay) ? salesByDay.length : 1, 1)).toFixed(0)
          : 0,
      },
      sales_by_day: Array.isArray(salesByDay) ? salesByDay : [],
      top_products: Array.isArray(topProducts) ? topProducts : [],
      by_payment: Array.isArray(byPayment) ? byPayment : [],
      expenses_by_category: Array.isArray(expByCategory) ? expByCategory : [],
      by_hour: Array.isArray(byHour) ? byHour : [],
      day_closings: Array.isArray(closings) ? closings : [],
    });
  } catch (err) {
    console.error('Erreur getStatistics:', err);
    res.json({
      period: 30,
      totals: { sale_count: 0, revenue: 0, profit: 0, expenses: 0, net: 0, avg_per_day: 0 },
      sales_by_day: [],
      top_products: [],
      by_payment: [],
      expenses_by_category: [],
      by_hour: [],
      day_closings: [],
    });
  }
}
