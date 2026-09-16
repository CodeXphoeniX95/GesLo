import { jsPDF } from 'jspdf';

function addHeader(doc, title, subtitle, pageWidth) {
  doc.setFillColor(26, 47, 90); // bleu marine
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GesLo', 10, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 13, { align: 'center' });
  doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - 10, 13, { align: 'right' });

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  if (subtitle) {
    doc.text(subtitle, 10, 28);
  }
  return subtitle ? 32 : 26;
}

function addTable(doc, headers, rows, startY, pageWidth) {
  const colCount = headers.length;
  const colWidth = (pageWidth - 20) / colCount;
  const rowH = 7;
  let y = startY;
  const pageH = doc.internal.pageSize.height;

  // En-tête tableau
  doc.setFillColor(79, 70, 229);
  doc.rect(10, y, pageWidth - 20, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    doc.text(String(h), 12 + i * colWidth, y + 5, { maxWidth: colWidth - 3 });
  });
  y += rowH;

  doc.setFont('helvetica', 'normal');
  rows.forEach((row, rowIdx) => {
    if (y + rowH > pageH - 15) {
      doc.addPage();
      y = 15;
    }
    // Alternance de couleur
    if (rowIdx % 2 === 0) {
      doc.setFillColor(245, 247, 255);
      doc.rect(10, y, pageWidth - 20, rowH, 'F');
    }
    doc.setTextColor(50, 50, 50);
    row.forEach((cell, i) => {
      const text = cell !== null && cell !== undefined ? String(cell) : '';
      doc.text(text, 12 + i * colWidth, y + 5, { maxWidth: colWidth - 3 });
    });
    y += rowH;
  });

  // Ligne de fin
  doc.setDrawColor(200, 200, 200);
  doc.line(10, y, pageWidth - 10, y);
  return y + 5;
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} / ${pageCount}`, pageW / 2, pageH - 5, { align: 'center' });
    doc.text('GesLo — Rapport généré automatiquement', 10, pageH - 5);
  }
}

// ─── PDF Rapport de ventes ───────────────────────────────────────
export function exportSalesPDF(salesData, period) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageW = doc.internal.pageSize.width;

  const subtitle = `Période : ${period.start} → ${period.end} | ${salesData.summary?.count} ventes | CA : ${Number(salesData.summary?.revenue).toLocaleString('fr-FR')} FCFA`;
  let y = addHeader(doc, 'Rapport des Ventes', subtitle, pageW);

  // Résumé
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Résumé', 10, y);
  y += 6;

  const summaryRows = [
    ['Chiffre d\'affaires', `${Number(salesData.summary?.revenue).toLocaleString('fr-FR')} FCFA`],
    ['Bénéfice estimé', `${Number(salesData.summary?.profit).toLocaleString('fr-FR')} FCFA`],
    ['Remises accordées', `${Number(salesData.summary?.total_discount).toLocaleString('fr-FR')} FCFA`],
    ['Nombre de ventes', salesData.summary?.count],
  ];
  y = addTable(doc, ['Indicateur', 'Valeur'], summaryRows, y, pageW);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Produits les plus vendus', 10, y);
  y += 6;

  const productRows = (salesData.top_products || []).map((p) => [
    p.product_name,
    p.qty_sold,
    `${Number(p.revenue).toLocaleString('fr-FR')} FCFA`,
  ]);
  y = addTable(doc, ['Produit', 'Qté vendue', 'Revenu'], productRows, y, pageW);

  addFooter(doc);
  doc.save(`rapport_ventes_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── PDF Rapport stock ───────────────────────────────────────────
export function exportStockPDF(stockData) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageW = doc.internal.pageSize.width;

  const sv = stockData.stock_value || {};
  const subtitle = `Valeur stock : ${Number(sv.total_value).toLocaleString('fr-FR')} FCFA | ${sv.total_products} produits actifs`;
  let y = addHeader(doc, 'État du Stock', subtitle, pageW);

  const rows = (stockData.low_stock || []).map((p) => [
    p.name,
    p.category_name || '—',
    p.unit,
    p.stock_quantity,
    p.alert_threshold,
    p.stock_quantity <= 0 ? 'RUPTURE' : 'ALERTE',
  ]);

  if (rows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Produits en alerte / rupture', 10, y);
    y += 6;
    y = addTable(doc, ['Produit', 'Catégorie', 'Unité', 'Stock', 'Seuil', 'Statut'], rows, y, pageW);
  }

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Stock par catégorie', 10, y);
  y += 6;

  const catRows = (stockData.by_category || []).map((c) => [
    c.category || 'Sans catégorie',
    c.product_count,
    c.total_qty,
    `${Number(c.total_value).toLocaleString('fr-FR')} FCFA`,
  ]);
  addTable(doc, ['Catégorie', 'Produits', 'Quantité totale', 'Valeur'], catRows, y, pageW);

  addFooter(doc);
  doc.save(`rapport_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── PDF Rapport dépenses ────────────────────────────────────────
export function exportExpensesPDF(expData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.width;

  const subtitle = `Total : ${Number(expData.summary?.total).toLocaleString('fr-FR')} FCFA | ${expData.summary?.count} dépenses`;
  let y = addHeader(doc, 'Rapport des Dépenses', subtitle, pageW);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Détail des dépenses', 10, y);
  y += 6;

  const rows = (expData.detail || []).map((e) => [
    e.expense_date,
    e.label,
    e.category_name || '—',
    `${Number(e.amount).toLocaleString('fr-FR')} FCFA`,
    e.user_name || '—',
  ]);
  addTable(doc, ['Date', 'Libellé', 'Catégorie', 'Montant', 'Saisi par'], rows, y, pageW);

  addFooter(doc);
  doc.save(`rapport_depenses_${new Date().toISOString().slice(0, 10)}.pdf`);
}
