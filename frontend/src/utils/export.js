// ─── Export CSV ──────────────────────────────────────────────────
export function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
  const headerLine = headers.map((h) => `"${h}"`).join(';');
  const dataLines = rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return '""';
      const val = String(cell).replace(/"/g, '""');
      return `"${val}"`;
    }).join(';')
  );
  const csv = BOM + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Helpers formatage
export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR');
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

// ─── Export CSV Ventes ───────────────────────────────────────────
export function exportSalesCSV(sales) {
  exportCSV('ventes', [
    'N° Vente', 'Date', 'Caissier', 'Client', 'Articles',
    'Sous-total', 'Remise', 'Total', 'Paiement', 'Statut'
  ], sales.map((s) => [
    s.sale_number,
    fmtDate(s.created_at),
    s.cashier_name,
    s.customer_name || 'Anonyme',
    s.item_count || '',
    fmtNum(s.subtotal),
    fmtNum(s.discount),
    fmtNum(s.total),
    s.payment_method,
    s.status,
  ]));
}

// ─── Export CSV Dépenses ─────────────────────────────────────────
export function exportExpensesCSV(expenses) {
  exportCSV('depenses', [
    'Date', 'Libellé', 'Catégorie', 'Montant', 'Saisi par', 'Commentaire'
  ], expenses.map((e) => [
    e.expense_date,
    e.label,
    e.category_name,
    fmtNum(e.amount),
    e.user_name,
    e.note || '',
  ]));
}

// ─── Export CSV Stock ────────────────────────────────────────────
export function exportStockCSV(stock) {
  exportCSV('stock', [
    'Référence', 'Nom', 'Catégorie', 'Unité', 'Stock actuel',
    'Seuil alerte', 'Prix achat', 'Prix vente', 'Valeur stock', 'Statut'
  ], stock.map((p) => [
    p.reference,
    p.name,
    p.category_name || '',
    p.unit,
    p.stock_quantity,
    p.alert_threshold,
    fmtNum(p.purchase_price),
    fmtNum(p.sale_price),
    fmtNum(p.stock_quantity * p.purchase_price),
    p.stock_quantity <= 0 ? 'Rupture' : p.stock_quantity <= p.alert_threshold ? 'Alerte' : 'OK',
  ]));
}

// ─── Export CSV Mouvements stock ─────────────────────────────────
export function exportMovementsCSV(movements) {
  exportCSV('mouvements_stock', [
    'Date', 'Produit', 'Type', 'Quantité', 'Avant', 'Après', 'Note', 'Utilisateur'
  ], movements.map((m) => [
    fmtDate(m.created_at),
    m.product_name,
    m.type,
    m.quantity,
    m.quantity_before,
    m.quantity_after,
    m.note || '',
    m.user_name || '',
  ]));
}
