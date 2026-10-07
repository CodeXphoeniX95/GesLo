import { getDb } from '../database/connection.js';

export async function getDashboard(req, res) {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    const salesToday = (await db.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue,
       COALESCE(SUM(total - discount - tax), 0) AS subtotal
       FROM sales WHERE date(created_at) = ? AND status = 'completed'`
    ).get(today)) || { count: 0, revenue: 0, subtotal: 0 };

    const profitToday = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) = ? AND s.status = 'completed'`
    ).get(today)) || { profit: 0 };

    const expensesToday = (await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE expense_date = ? AND is_deleted = 0`
    ).get(today)) || { total: 0 };

    const lowStock = (await db.prepare(
      `SELECT COUNT(*) AS count FROM products
       WHERE is_active = 1 AND stock_quantity <= alert_threshold`
    ).get()) || { count: 0 };

    const outOfStock = (await db.prepare(
      `SELECT COUNT(*) AS count FROM products WHERE is_active = 1 AND stock_quantity <= 0`
    ).get()) || { count: 0 };

    const recentSales = (await db.prepare(
      `SELECT s.sale_number, s.total, s.payment_method, s.created_at, u.full_name AS cashier
       FROM sales s LEFT JOIN users u ON s.user_id = u.id
       WHERE s.status = 'completed'
       ORDER BY s.created_at DESC LIMIT 10`
    ).all()) || [];

    const last7DaysRaw = (await db.prepare(
      `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS count
       FROM sales
       WHERE date(created_at) >= date('now', '-6 days') AND status = 'completed'
       GROUP BY day ORDER BY day`
    ).all()) || [];

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const found = Array.isArray(last7DaysRaw) ? last7DaysRaw.find((r) => r.day === dayStr) : null;
      last7Days.push({ day: dayStr, revenue: found ? Number(found.revenue) || 0 : 0, count: found ? Number(found.count) || 0 : 0 });
    }

    res.json({
      today: {
        revenue: Number(salesToday.revenue) || 0,
        sale_count: Number(salesToday.count) || 0,
        profit: Number(profitToday.profit) || 0,
        expenses: Number(expensesToday.total) || 0,
      },
      stock: {
        low_stock_count: Number(lowStock.count) || 0,
        out_of_stock_count: Number(outOfStock.count) || 0,
      },
      recent_sales: Array.isArray(recentSales) ? recentSales : [],
      chart_data: last7Days,
    });
  } catch (err) {
    console.error('Erreur getDashboard:', err);
    res.json({
      today: { revenue: 0, sale_count: 0, profit: 0, expenses: 0 },
      stock: { low_stock_count: 0, out_of_stock_count: 0 },
      recent_sales: [],
      chart_data: [],
    });
  }
}

export async function getSalesReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const db = getDb();

    const start = start_date || new Date().toISOString().slice(0, 10);
    const end = end_date || start;

    const summary = (await db.prepare(
      `SELECT COUNT(*) AS count,
       COALESCE(SUM(total), 0) AS revenue,
       COALESCE(SUM(discount), 0) AS total_discount,
       COALESCE(SUM(tax), 0) AS total_tax
       FROM sales
       WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'`
    ).get(start, end)) || { count: 0, revenue: 0, total_discount: 0, total_tax: 0 };

    const profit = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'`
    ).get(start, end)) || { profit: 0 };

    let commCat = await db.prepare("SELECT id FROM expense_categories WHERE name = 'Commissions / Rémunérations'").get();
    let commCatId = commCat ? commCat.id : null;

    let expensesQuery = `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date BETWEEN ? AND ? AND is_deleted = 0`;
    const expensesParams = [start, end];
    if (commCatId) {
      expensesQuery += ` AND (category_id IS NULL OR category_id != ?)`;
      expensesParams.push(commCatId);
    }

    const expenses = (await db.prepare(expensesQuery).get(...expensesParams)) || { total: 0 };

    const isAdminOrManager = req.user && ['admin', 'manager'].includes(req.user.role);

    let commQuery = `
      SELECT
        COALESCE(SUM(user_commission), 0) AS total_user_commissions,
        COALESCE(SUM(pool_commission), 0) AS total_pool_commissions,
        COALESCE(SUM(total_commission), 0) AS total_commissions
      FROM sale_commissions sc
      JOIN sales s ON sc.sale_id = s.id
      WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    `;
    const commParams = [start, end];

    if (!isAdminOrManager) {
      commQuery += ' AND sc.user_id = ?';
      commParams.push(req.user.id);
    }

    const commissions = (await db.prepare(commQuery).get(...commParams)) || { total_user_commissions: 0, total_pool_commissions: 0, total_commissions: 0 };

    const byPayment = (await db.prepare(
      `SELECT payment_method, COUNT(*) AS count, SUM(total) AS revenue
       FROM sales
       WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
       GROUP BY payment_method`
    ).all(start, end)) || [];

    const topProducts = (await db.prepare(
      `SELECT si.product_name, SUM(si.quantity) AS qty_sold, SUM(si.total) AS revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
       GROUP BY si.product_id ORDER BY qty_sold DESC LIMIT 20`
    ).all(start, end)) || [];

    const byDay = (await db.prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count, SUM(total) AS revenue
       FROM sales
       WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
       GROUP BY day ORDER BY day`
    ).all(start, end)) || [];

    const grossProfit = Number(profit.profit) || 0;
    const totalExpenses = Number(expenses.total) || 0;
    const netProfitAvailable = Math.max(0, grossProfit - totalExpenses);
    const totalCommissions = Number(commissions.total_commissions) || 0;
    const caisseNet = Math.max(0, netProfitAvailable - totalCommissions);
    const netProfit = caisseNet;

    res.json({
      period: { start, end },
      summary: {
        ...summary,
        gross_profit: grossProfit,
        profit: grossProfit,
        expenses: totalExpenses,
        commissions: commissions,
        caisse_net: caisseNet,
        net_profit: netProfit,
      },
      by_payment: Array.isArray(byPayment) ? byPayment : [],
      top_products: Array.isArray(topProducts) ? topProducts : [],
      by_day: Array.isArray(byDay) ? byDay : [],
    });
  } catch (err) {
    console.error('Erreur getSalesReport:', err);
    res.json({
      period: { start: '', end: '' },
      summary: { count: 0, revenue: 0, total_discount: 0, total_tax: 0, gross_profit: 0, profit: 0, expenses: 0, commissions: {}, caisse_net: 0, net_profit: 0 },
      by_payment: [],
      top_products: [],
      by_day: [],
    });
  }
}

export async function getStockReport(req, res) {
  try {
    const db = getDb();

    const stockValue = (await db.prepare(
      `SELECT COALESCE(SUM(stock_quantity * purchase_price), 0) AS total_value,
       COALESCE(SUM(stock_quantity * sale_price), 0) AS potential_value,
       COUNT(*) AS total_products
       FROM products WHERE is_active = 1`
    ).get()) || { total_value: 0, potential_value: 0, total_products: 0 };

    const lowStock = (await db.prepare(
      `SELECT p.name, p.reference, p.unit, p.stock_quantity, p.alert_threshold,
       c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1 AND p.stock_quantity <= p.alert_threshold
       ORDER BY p.stock_quantity ASC`
    ).all()) || [];

    const stockByCategory = (await db.prepare(
      `SELECT c.name AS category, COUNT(p.id) AS product_count,
       SUM(p.stock_quantity) AS total_qty,
       SUM(p.stock_quantity * p.purchase_price) AS total_value
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       GROUP BY p.category_id ORDER BY total_value DESC`
    ).all()) || [];

    res.json({
      stock_value: stockValue,
      low_stock: Array.isArray(lowStock) ? lowStock : [],
      by_category: Array.isArray(stockByCategory) ? stockByCategory : []
    });
  } catch (err) {
    console.error('Erreur getStockReport:', err);
    res.json({ stock_value: { total_value: 0, potential_value: 0, total_products: 0 }, low_stock: [], by_category: [] });
  }
}

export async function getExpensesReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date().toISOString().slice(0, 10);
    const end = end_date || start;
    const db = getDb();

    const summary = (await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM expenses WHERE expense_date BETWEEN ? AND ? AND is_deleted = 0`
    ).get(start, end)) || { total: 0, count: 0 };

    const byCategory = (await db.prepare(
      `SELECT ec.name AS category, SUM(e.amount) AS total, COUNT(*) AS count
       FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.expense_date BETWEEN ? AND ? AND e.is_deleted = 0
       GROUP BY e.category_id ORDER BY total DESC`
    ).all(start, end)) || [];

    const detail = (await db.prepare(
      `SELECT e.*, ec.name AS category_name, u.full_name AS user_name
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.expense_date BETWEEN ? AND ? AND e.is_deleted = 0
       ORDER BY e.expense_date DESC`
    ).all(start, end)) || [];

    res.json({
      period: { start, end },
      summary,
      by_category: Array.isArray(byCategory) ? byCategory : [],
      detail: Array.isArray(detail) ? detail : []
    });
  } catch (err) {
    console.error('Erreur getExpensesReport:', err);
    res.json({ period: { start: '', end: '' }, summary: { total: 0, count: 0 }, by_category: [], detail: [] });
  }
}

export async function getSettings(req, res) {
  try {
    const db = getDb();
    const settings = await db.prepare('SELECT * FROM business_settings LIMIT 1').get();
    res.json(settings || { name: 'GesLo Commerce', currency: 'FCFA', currency_symbol: 'FCFA' });
  } catch (err) {
    res.json({ name: 'GesLo Commerce', currency: 'FCFA', currency_symbol: 'FCFA' });
  }
}

export async function updateSettings(req, res) {
  try {
    const db = getDb();
    const settings = await db.prepare('SELECT id FROM business_settings LIMIT 1').get();
    const {
      name, address, phone, email, currency, currency_symbol,
      date_format, business_type, tax_rate, allow_negative_stock, receipt_footer,
      enable_commissions, pool_commission_rate, commission_period_type,
    } = req.body;

    const newPoolRate = Number(pool_commission_rate) || 0;
    if (enable_commissions && newPoolRate > 0) {
      const usersSum = (await db.prepare(
        "SELECT COALESCE(SUM(commission_rate), 0) AS total FROM users WHERE is_active = 1 AND commission_type = 'percentage'"
      ).get()) || { total: 0 };
      const totalAllocated = Number(usersSum.total || 0) + newPoolRate;
      if (totalAllocated > 100) {
        return res.status(400).json({
          error: `Impossible d'enregistrer : la somme des commissions (${totalAllocated.toFixed(1)}%) dépasserait 100%.`
        });
      }
    }

    if (settings) {
      await db.prepare(
        `UPDATE business_settings SET
         name=?, address=?, phone=?, email=?, currency=?, currency_symbol=?,
         date_format=?, business_type=?, tax_rate=?, allow_negative_stock=?,
         enable_commissions=?, pool_commission_rate=?, commission_period_type=?,
         receipt_footer=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).run(
        name, address || null, phone || null, email || null,
        currency || 'FCFA', currency_symbol || 'FCFA',
        date_format || 'DD/MM/YYYY', business_type || 'shop',
        tax_rate || 0, allow_negative_stock ? 1 : 0,
        enable_commissions ? 1 : 0, Number(pool_commission_rate) || 0,
        commission_period_type || 'monthly',
        receipt_footer || 'Merci de votre visite !', settings.id
      );
    } else {
      await db.prepare(
        `INSERT INTO business_settings
         (name, address, phone, email, currency, currency_symbol, date_format,
          business_type, tax_rate, allow_negative_stock, enable_commissions, pool_commission_rate, commission_period_type, receipt_footer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name, address || null, phone || null, email || null,
        currency || 'FCFA', currency_symbol || 'FCFA',
        date_format || 'DD/MM/YYYY', business_type || 'shop',
        tax_rate || 0, allow_negative_stock ? 1 : 0,
        enable_commissions ? 1 : 0, Number(pool_commission_rate) || 0,
        commission_period_type || 'monthly',
        receipt_footer || 'Merci de votre visite !'
      );
    }

    res.json({ message: 'Paramètres mis à jour.' });
  } catch (err) {
    console.error('Erreur updateSettings:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres.' });
  }
}

export async function getCommissionsReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date().toISOString().slice(0, 10);
    const end = end_date || start;
    const db = getDb();

    const settings = await db.prepare('SELECT * FROM business_settings LIMIT 1').get();
    const poolRate = settings?.pool_commission_rate || 0;
    const isAdminOrManager = req.user && ['admin', 'manager'].includes(req.user.role);

    const salesSummary = (await db.prepare(
      `SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS revenue
       FROM sales
       WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'`
    ).get(start, end)) || { sale_count: 0, revenue: 0 };

    const purchaseCostRow = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity * si.purchase_price), 0) AS cost
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'`
    ).get(start, end)) || { cost: 0 };

    const grossProfit = Number(salesSummary.revenue) - Number(purchaseCostRow.cost);

    let commCat = await db.prepare("SELECT id FROM expense_categories WHERE name = 'Commissions / Rémunérations'").get();
    let commCatId = commCat ? commCat.id : null;

    let expensesQuery = `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date BETWEEN ? AND ? AND is_deleted = 0`;
    const expensesParams = [start, end];
    if (commCatId) {
      expensesQuery += ` AND (category_id IS NULL OR category_id != ?)`;
      expensesParams.push(commCatId);
    }

    const expensesRow = (await db.prepare(expensesQuery).get(...expensesParams)) || { total: 0 };
    const totalExpenses = Number(expensesRow.total);

    const netProfit = Math.max(0, grossProfit - totalExpenses);
    const poolCommission = (netProfit * poolRate) / 100;

    if (isAdminOrManager) {
      const users = (await db.prepare(
        `SELECT u.id, u.full_name, u.username, u.commission_rate, u.commission_type
         FROM users u WHERE u.is_active = 1`
      ).all()) || [];

      let totalUserCommissions = 0;
      const byUser = [];

      for (const u of users) {
        const userSales = (await db.prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(s.total), 0) AS revenue
           FROM sales s WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND s.user_id = ?`
        ).get(start, end, u.id)) || { count: 0, revenue: 0 };

        const userProfitRow = (await db.prepare(
          `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
           FROM sale_items si JOIN sales s ON si.sale_id = s.id
           WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND s.user_id = ?`
        ).get(start, end, u.id)) || { profit: 0 };

        const userGrossProfit = Number(userProfitRow.profit) || 0;
        const isEligible = userSales.count > 0;

        let comm = 0;
        if (isEligible && u.commission_rate > 0) {
          if (u.commission_type === 'fixed') {
            comm = userSales.count * u.commission_rate;
          } else {
            // Directement % x Bénéfice Net Global de la période pour les vendeurs éligibles
            comm = (netProfit * u.commission_rate) / 100;
          }
        }

        totalUserCommissions += comm;

        byUser.push({
          user_id: u.id,
          full_name: u.full_name,
          username: u.username,
          is_eligible: isEligible,
          sale_count: userSales.count,
          total_sales: userSales.revenue,
          commission_rate: u.commission_rate,
          commission_type: u.commission_type,
          user_gross_profit: userGrossProfit,
          user_net_profit: netProfit,
          total_profit: netProfit,
          total_commission: comm,
        });
      }

      const totalCommissions = totalUserCommissions + poolCommission;
      const caisseNet = netProfit - totalCommissions;

      const detail = (await db.prepare(
        `SELECT sc.*, s.sale_number, u.full_name AS user_name
         FROM sale_commissions sc
         JOIN sales s ON sc.sale_id = s.id
         JOIN users u ON sc.user_id = u.id
         WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
         ORDER BY sc.created_at DESC`
      ).all(start, end)) || [];

      const settingsRow = await db.prepare('SELECT last_commission_closed_date, commission_period_type FROM business_settings LIMIT 1').get();

      res.json({
        is_admin: true,
        period: { start, end },
        last_commission_closed_date: settingsRow?.last_commission_closed_date || null,
        commission_period_type: settingsRow?.commission_period_type || 'monthly',
        financials: {
          revenue: salesSummary.revenue,
          purchase_cost: purchaseCostRow.cost,
          gross_profit: grossProfit,
          expenses: totalExpenses,
          net_profit: netProfit,
        },
        totals: {
          total_user_commissions: totalUserCommissions,
          total_pool_commissions: poolCommission,
          total_commissions: totalCommissions,
          total_caisse_net: caisseNet,
        },
        by_user: byUser,
        detail: Array.isArray(detail) ? detail : [],
      });
    } else {
      const userSales = (await db.prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(s.total), 0) AS revenue
         FROM sales s WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND s.user_id = ?`
      ).get(start, end, req.user.id)) || { count: 0, revenue: 0 };

      const userProfitRow = (await db.prepare(
        `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price)), 0) AS profit
         FROM sale_items si JOIN sales s ON si.sale_id = s.id
         WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND s.user_id = ?`
      ).get(start, end, req.user.id)) || { profit: 0 };

      const me = await db.prepare('SELECT commission_rate, commission_type FROM users WHERE id = ?').get(req.user.id);
      const userGrossProfit = Number(userProfitRow.profit) || 0;
      const isEligible = userSales.count > 0;

      let myComm = 0;
      if (isEligible && me && me.commission_rate > 0) {
        if (me.commission_type === 'fixed') {
          myComm = userSales.count * me.commission_rate;
        } else {
          myComm = (netProfit * me.commission_rate) / 100;
        }
      }

      const detail = (await db.prepare(
        `SELECT sc.id, sc.sale_id, sc.sale_total, sc.sale_profit, sc.user_commission, sc.created_at, s.sale_number
         FROM sale_commissions sc JOIN sales s ON sc.sale_id = s.id
         WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND sc.user_id = ?
         ORDER BY sc.created_at DESC`
      ).all(start, end, req.user.id)) || [];

      const settingsRow = await db.prepare('SELECT last_commission_closed_date, commission_period_type FROM business_settings LIMIT 1').get();

      res.json({
        is_admin: false,
        period: { start, end },
        last_commission_closed_date: settingsRow?.last_commission_closed_date || null,
        commission_period_type: settingsRow?.commission_period_type || 'monthly',
        totals: {
          my_total_commission: myComm,
          my_sale_count: userSales.count,
          my_total_sales: userSales.revenue,
          my_net_profit: netProfit,
        },
        detail: Array.isArray(detail) ? detail : [],
      });
    }
  } catch (err) {
    console.error('Erreur getCommissionsReport:', err);
    res.json({ is_admin: false, period: { start: '', end: '' }, totals: { my_total_commission: 0, my_sale_count: 0, my_total_sales: 0, my_net_profit: 0 }, detail: [] });
  }
}

export async function recordPeriodCommissionsAsExpenses(req, res) {
  try {
    const { start_date, end_date } = req.body;
    const start = start_date || new Date().toISOString().slice(0, 10);
    const end = end_date || start;
    const db = getDb();

    // Obtenir ou créer la catégorie "Commissions / Rémunérations"
    let category = await db.prepare("SELECT id FROM expense_categories WHERE name = 'Commissions / Rémunérations'").get();
    if (!category) {
      const resCat = await db.prepare("INSERT INTO expense_categories (name, description) VALUES ('Commissions / Rémunérations', 'Rémunérations et commissions de la période')").run();
      category = { id: resCat.lastInsertRowid };
    }

    const settings = await db.prepare('SELECT * FROM business_settings LIMIT 1').get();
    const poolRate = settings?.pool_commission_rate || 0;

    const salesSummary = (await db.prepare(
      `SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS revenue
       FROM sales WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'`
    ).get(start, end)) || { sale_count: 0, revenue: 0 };

    const purchaseCostRow = (await db.prepare(
      `SELECT COALESCE(SUM(si.quantity * si.purchase_price), 0) AS cost
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'`
    ).get(start, end)) || { cost: 0 };

    const grossProfit = Number(salesSummary.revenue) - Number(purchaseCostRow.cost);

    const expensesRow = (await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE expense_date BETWEEN ? AND ? AND is_deleted = 0 AND (category_id IS NULL OR category_id != ?)`
    ).get(start, end, category.id)) || { total: 0 };

    const totalExpenses = Number(expensesRow.total);
    const netProfit = Math.max(0, grossProfit - totalExpenses);

    const users = (await db.prepare(
      `SELECT u.id, u.full_name, u.username, u.commission_rate, u.commission_type
       FROM users u WHERE u.is_active = 1`
    ).all()) || [];

    let countCreated = 0;
    const expenseDate = end || new Date().toISOString().slice(0, 10);

    for (const u of users) {
      const userSales = (await db.prepare(
        `SELECT COUNT(*) AS count FROM sales s WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed' AND s.user_id = ?`
      ).get(start, end, u.id)) || { count: 0 };

      const isEligible = userSales.count > 0;
      let comm = 0;

      if (isEligible && u.commission_rate > 0) {
        if (u.commission_type === 'fixed') {
          comm = userSales.count * u.commission_rate;
        } else {
          comm = (netProfit * u.commission_rate) / 100;
        }
      }

      if (comm > 0) {
        await db.prepare(
          `INSERT INTO expenses (label, category_id, amount, expense_date, user_id, note)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          `Rémunération Commission — ${u.full_name} (${start} au ${end})`,
          category.id,
          comm,
          expenseDate,
          req.user.id,
          `Rémunération calculée à ${u.commission_rate}% sur bénéfice avant rémunérations (${netProfit} FCFA) — ${userSales.count} vente(s)`
        );
        countCreated++;
      }
    }

    if (poolRate > 0 && netProfit > 0) {
      const poolComm = (netProfit * poolRate) / 100;
      if (poolComm > 0) {
        await db.prepare(
          `INSERT INTO expenses (label, category_id, amount, expense_date, user_id, note)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          `Commission Pool Collectif (${start} au ${end})`,
          category.id,
          poolComm,
          expenseDate,
          req.user.id,
          `Commission Pool calculée à ${poolRate}% sur bénéfice avant rémunérations (${netProfit} FCFA)`
        );
        countCreated++;
      }
    }

    // Mettre à jour la date de dernière clôture de commission
    await db.prepare('UPDATE business_settings SET last_commission_closed_date = ?').run(end);

    await db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, details) VALUES (?, ?, ?, ?)`
    ).run(req.user.id, 'RECORD_COMMISSIONS_EXPENSES', 'expenses', `Enregistrement de ${countCreated} dépense(s) de commission pour la période ${start} au ${end}`);

    res.json({
      message: `Succès : ${countCreated} dépense(s) de rémunération enregistrée(s) avec succès dans la comptabilité.`,
      count: countCreated,
      last_commission_closed_date: end,
    });
  } catch (err) {
    console.error('Erreur recordPeriodCommissionsAsExpenses:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement des rémunérations comme dépenses.' });
  }
}

