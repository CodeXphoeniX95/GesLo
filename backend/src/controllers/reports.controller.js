import { getDb } from '../database/connection.js';

export function getDashboard(req, res) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const salesToday = db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue,
     COALESCE(SUM(total - discount - tax), 0) AS subtotal
     FROM sales WHERE date(created_at) = ? AND status = 'completed'`
  ).get(today);

  const profitToday = db.prepare(
    `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) = ? AND s.status = 'completed'`
  ).get(today);

  const expensesToday = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses WHERE expense_date = ? AND is_deleted = 0`
  ).get(today);

  const lowStock = db.prepare(
    `SELECT COUNT(*) AS count FROM products
     WHERE is_active = 1 AND stock_quantity <= alert_threshold`
  ).get();

  const outOfStock = db.prepare(
    `SELECT COUNT(*) AS count FROM products WHERE is_active = 1 AND stock_quantity <= 0`
  ).get();

  const recentSales = db.prepare(
    `SELECT s.sale_number, s.total, s.payment_method, s.created_at, u.full_name AS cashier
     FROM sales s LEFT JOIN users u ON s.user_id = u.id
     WHERE s.status = 'completed'
     ORDER BY s.created_at DESC LIMIT 10`
  ).all();

  // Ventes 7 derniers jours — générer tous les jours même sans vente
  const last7DaysRaw = db.prepare(
    `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS count
     FROM sales
     WHERE date(created_at) >= date('now', '-6 days') AND status = 'completed'
     GROUP BY day ORDER BY day`
  ).all();

  // Construire un tableau avec les 7 derniers jours, revenue=0 si aucune vente
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const found = last7DaysRaw.find((r) => r.day === dayStr);
    last7Days.push({ day: dayStr, revenue: found ? found.revenue : 0, count: found ? found.count : 0 });
  }

  res.json({
    today: {
      revenue: salesToday.revenue,
      sale_count: salesToday.count,
      profit: profitToday.profit,
      expenses: expensesToday.total,
    },
    stock: {
      low_stock_count: lowStock.count,
      out_of_stock_count: outOfStock.count,
    },
    recent_sales: recentSales,
    chart_data: last7Days,
  });
}

export function getSalesReport(req, res) {
  const { start_date, end_date, category_id, payment_method, user_id } = req.query;
  const db = getDb();

  const start = start_date || new Date().toISOString().slice(0, 10);
  const end = end_date || start;

  const summary = db.prepare(
    `SELECT COUNT(*) AS count,
     COALESCE(SUM(total), 0) AS revenue,
     COALESCE(SUM(discount), 0) AS total_discount,
     COALESCE(SUM(tax), 0) AS total_tax
     FROM sales
     WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'`
  ).get(start, end);

  const profit = db.prepare(
    `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'`
  ).get(start, end);

  const byPayment = db.prepare(
    `SELECT payment_method, COUNT(*) AS count, SUM(total) AS revenue
     FROM sales
     WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
     GROUP BY payment_method`
  ).all(start, end);

  const topProducts = db.prepare(
    `SELECT si.product_name, SUM(si.quantity) AS qty_sold, SUM(si.total) AS revenue
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
     GROUP BY si.product_id ORDER BY qty_sold DESC LIMIT 20`
  ).all(start, end);

  const byDay = db.prepare(
    `SELECT date(created_at) AS day, COUNT(*) AS count, SUM(total) AS revenue
     FROM sales
     WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
     GROUP BY day ORDER BY day`
  ).all(start, end);

  res.json({
    period: { start, end },
    summary: { ...summary, profit: profit.profit },
    by_payment: byPayment,
    top_products: topProducts,
    by_day: byDay,
  });
}

export function getStockReport(req, res) {
  const db = getDb();

  const stockValue = db.prepare(
    `SELECT COALESCE(SUM(stock_quantity * purchase_price), 0) AS total_value,
     COALESCE(SUM(stock_quantity * sale_price), 0) AS potential_value,
     COUNT(*) AS total_products
     FROM products WHERE is_active = 1`
  ).get();

  const lowStock = db.prepare(
    `SELECT p.name, p.reference, p.unit, p.stock_quantity, p.alert_threshold,
     c.name AS category_name
     FROM products p LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1 AND p.stock_quantity <= p.alert_threshold
     ORDER BY p.stock_quantity ASC`
  ).all();

  const stockByCategory = db.prepare(
    `SELECT c.name AS category, COUNT(p.id) AS product_count,
     SUM(p.stock_quantity) AS total_qty,
     SUM(p.stock_quantity * p.purchase_price) AS total_value
     FROM products p LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1
     GROUP BY p.category_id ORDER BY total_value DESC`
  ).all();

  res.json({ stock_value: stockValue, low_stock: lowStock, by_category: stockByCategory });
}

export function getExpensesReport(req, res) {
  const { start_date, end_date } = req.query;
  const start = start_date || new Date().toISOString().slice(0, 10);
  const end = end_date || start;
  const db = getDb();

  const summary = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM expenses WHERE expense_date BETWEEN ? AND ? AND is_deleted = 0`
  ).get(start, end);

  const byCategory = db.prepare(
    `SELECT ec.name AS category, SUM(e.amount) AS total, COUNT(*) AS count
     FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
     WHERE e.expense_date BETWEEN ? AND ? AND e.is_deleted = 0
     GROUP BY e.category_id ORDER BY total DESC`
  ).all(start, end);

  const detail = db.prepare(
    `SELECT e.*, ec.name AS category_name, u.full_name AS user_name
     FROM expenses e
     LEFT JOIN expense_categories ec ON e.category_id = ec.id
     LEFT JOIN users u ON e.user_id = u.id
     WHERE e.expense_date BETWEEN ? AND ? AND e.is_deleted = 0
     ORDER BY e.expense_date DESC`
  ).all(start, end);

  res.json({ period: { start, end }, summary, by_category: byCategory, detail });
}

export function getSettings(req, res) {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();
  res.json(settings || {});
}

export function updateSettings(req, res) {
  const db = getDb();
  const settings = db.prepare('SELECT id FROM business_settings LIMIT 1').get();
  const {
    name, address, phone, email, currency, currency_symbol,
    date_format, business_type, tax_rate, allow_negative_stock, receipt_footer,
  } = req.body;

  if (settings) {
    db.prepare(
      `UPDATE business_settings SET
       name=?, address=?, phone=?, email=?, currency=?, currency_symbol=?,
       date_format=?, business_type=?, tax_rate=?, allow_negative_stock=?,
       receipt_footer=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      name, address || null, phone || null, email || null,
      currency || 'FCFA', currency_symbol || 'FCFA',
      date_format || 'DD/MM/YYYY', business_type || 'shop',
      tax_rate || 0, allow_negative_stock ? 1 : 0,
      receipt_footer || 'Merci de votre visite !', settings.id
    );
  } else {
    db.prepare(
      `INSERT INTO business_settings
       (name, address, phone, email, currency, currency_symbol, date_format,
        business_type, tax_rate, allow_negative_stock, receipt_footer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name, address || null, phone || null, email || null,
      currency || 'FCFA', currency_symbol || 'FCFA',
      date_format || 'DD/MM/YYYY', business_type || 'shop',
      tax_rate || 0, allow_negative_stock ? 1 : 0,
      receipt_footer || 'Merci de votre visite !'
    );
  }

  res.json({ message: 'Paramètres mis à jour.' });
}
