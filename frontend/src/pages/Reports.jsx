import { useEffect, useState } from 'react';
import { BarChart2, Package, Receipt, TrendingUp, AlertTriangle, DollarSign, Download } from 'lucide-react';
import { reportsApi } from '../services/api';
import { exportSalesCSV, exportStockCSV, exportExpensesCSV } from '../utils/export';
import { exportSalesPDF, exportStockPDF, exportExpensesPDF } from '../utils/exportPDF';
import Spinner from '../components/Spinner';

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.5rem 1.25rem', border: 'none',
      borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
      background: 'none', fontWeight: active ? 600 : 400,
      color: active ? 'var(--primary)' : 'var(--gray-500)',
      cursor: 'pointer', fontSize: 'var(--font-size-sm)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon size={15} />{children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon stat-icon-${colorClass}`}><Icon size={22} strokeWidth={1.8} /></div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [salesData, setSalesData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [expensesData, setExpensesData] = useState(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [salesFilter, setSalesFilter] = useState({ start_date: firstOfMonth, end_date: today });
  const [expFilter, setExpFilter] = useState({ start_date: firstOfMonth, end_date: today });

  useEffect(() => {
    if (tab === 'sales') {
      setLoading(true);
      reportsApi.getSales(salesFilter).then((r) => setSalesData(r.data)).finally(() => setLoading(false));
    }
    if (tab === 'stock') {
      setLoading(true);
      reportsApi.getStock().then((r) => setStockData(r.data)).finally(() => setLoading(false));
    }
    if (tab === 'expenses') {
      setLoading(true);
      reportsApi.getExpenses(expFilter).then((r) => setExpensesData(r.data)).finally(() => setLoading(false));
    }
  }, [tab, salesFilter, expFilter]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-header-title">Rapports</h1>
      </div>

      <div style={{ borderBottom: '1px solid var(--gray-200)', display: 'flex' }}>
        <TabButton active={tab === 'sales'} onClick={() => setTab('sales')} icon={BarChart2}>Ventes</TabButton>
        <TabButton active={tab === 'stock'} onClick={() => setTab('stock')} icon={Package}>Stock</TabButton>
        <TabButton active={tab === 'expenses'} onClick={() => setTab('expenses')} icon={Receipt}>Dépenses</TabButton>
      </div>

      {loading && <Spinner />}

      {/* ── Ventes ── */}
      {tab === 'sales' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="filters-bar">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Du</label>
              <input className="form-control" type="date" value={salesFilter.start_date}
                onChange={(e) => setSalesFilter((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Au</label>
              <input className="form-control" type="date" value={salesFilter.end_date}
                onChange={(e) => setSalesFilter((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            {salesData && (
              <>
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => exportSalesCSV(salesData.by_day || [])}>
                  <Download size={14} /> CSV
                </button>
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => exportSalesPDF(salesData, salesFilter)}>
                  <Download size={14} /> PDF
                </button>
              </>
            )}
          </div>

          {salesData && (
            <>
              <div className="stats-grid">
                <StatCard icon={DollarSign} label="Chiffre d'affaires" value={fmt(salesData.summary?.revenue)}
                  sub={`${salesData.summary?.count} ventes`} colorClass="blue" />
                <StatCard icon={TrendingUp} label="Bénéfice estimé" value={fmt(salesData.summary?.profit)} colorClass="green" />
                <StatCard icon={Receipt} label="Remises accordées" value={fmt(salesData.summary?.total_discount)} colorClass="yellow" />
              </div>

              <div className="dashboard-grid">
                <div className="card">
                  <div className="card-header"><span className="card-title">Par mode de paiement</span></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Mode</th><th>Ventes</th><th>Total</th></tr></thead>
                      <tbody>
                        {salesData.by_payment?.map((row) => (
                          <tr key={row.payment_method}>
                            <td><span className="badge badge-primary">{row.payment_method}</span></td>
                            <td>{row.count}</td>
                            <td><strong>{row.revenue?.toLocaleString('fr-FR')} FCFA</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><span className="card-title">Produits les plus vendus</span></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Produit</th><th>Qté</th><th>Revenu</th></tr></thead>
                      <tbody>
                        {salesData.top_products?.slice(0, 10).map((row) => (
                          <tr key={row.product_name}>
                            <td>{row.product_name}</td>
                            <td>{row.qty_sold}</td>
                            <td>{row.revenue?.toLocaleString('fr-FR')} FCFA</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {salesData.by_day?.length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Ventes par jour</span></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Date</th><th>Ventes</th><th>Total</th></tr></thead>
                      <tbody>
                        {salesData.by_day.map((row) => (
                          <tr key={row.day}>
                            <td>{row.day}</td><td>{row.count}</td>
                            <td><strong>{row.revenue?.toLocaleString('fr-FR')} FCFA</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Stock ── */}
      {tab === 'stock' && !loading && stockData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary btn-sm"
              onClick={() => exportStockCSV(stockData.low_stock || [])}>
              <Download size={14} /> CSV
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => exportStockPDF(stockData)}>
              <Download size={14} /> PDF
            </button>
          </div>
          <div className="stats-grid">
            <StatCard icon={Package} label="Produits actifs" value={stockData.stock_value?.total_products} colorClass="blue" />
            <StatCard icon={DollarSign} label="Valeur du stock (achat)" value={fmt(stockData.stock_value?.total_value)} colorClass="green" />
            <StatCard icon={TrendingUp} label="Valeur potentielle (vente)" value={fmt(stockData.stock_value?.potential_value)} colorClass="cyan" />
          </div>

          {stockData.low_stock?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> Produits en alerte
                </span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Produit</th><th>Catégorie</th><th>Unité</th><th>Stock</th><th>Seuil</th></tr>
                  </thead>
                  <tbody>
                    {stockData.low_stock.map((p) => {
                      const isOut = p.stock_quantity <= 0;
                      const rowBg = isOut ? '#fee2e2' : '#fff7ed';
                      const borderColor = isOut ? '#ef4444' : '#f97316';
                      const textColor = isOut ? '#b91c1c' : '#c2410c';
                      const tdStyle = {
                        background: rowBg,
                        borderBottom: `1px solid ${isOut ? '#fca5a5' : '#fed7aa'}`,
                        color: textColor,
                      };
                      return (
                        <tr key={p.reference}>
                          <td style={{ ...tdStyle, borderLeft: `4px solid ${borderColor}`, fontWeight: 700 }}>
                            {p.name}
                          </td>
                          <td style={tdStyle}>{p.category_name || '—'}</td>
                          <td style={tdStyle}>{p.unit}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block',
                              background: isOut ? '#ef4444' : '#f97316',
                              color: '#fff',
                              borderRadius: 99,
                              padding: '2px 10px',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                            }}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td style={tdStyle}>{p.alert_threshold}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">Stock par catégorie</span></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Catégorie</th><th>Produits</th><th>Quantité totale</th><th>Valeur</th></tr></thead>
                <tbody>
                  {stockData.by_category?.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category || 'Sans catégorie'}</td>
                      <td>{row.product_count}</td>
                      <td>{row.total_qty}</td>
                      <td>{row.total_value?.toLocaleString('fr-FR')} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Dépenses ── */}
      {tab === 'expenses' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="filters-bar">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Du</label>
              <input className="form-control" type="date" value={expFilter.start_date}
                onChange={(e) => setExpFilter((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Au</label>
              <input className="form-control" type="date" value={expFilter.end_date}
                onChange={(e) => setExpFilter((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            {expensesData && (
              <>
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => exportExpensesCSV(expensesData.detail || [])}>
                  <Download size={14} /> CSV
                </button>
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={() => exportExpensesPDF(expensesData)}>
                  <Download size={14} /> PDF
                </button>
              </>
            )}
          </div>

          {expensesData && (
            <>
              <div className="stats-grid">
                <StatCard icon={Receipt} label="Total dépenses" value={fmt(expensesData.summary?.total)}
                  sub={`${expensesData.summary?.count} dépenses`} colorClass="red" />
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">Par catégorie</span></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Catégorie</th><th>Nombre</th><th>Total</th></tr></thead>
                    <tbody>
                      {expensesData.by_category?.map((row) => (
                        <tr key={row.category}>
                          <td><span className="badge badge-gray">{row.category || '—'}</span></td>
                          <td>{row.count}</td>
                          <td><strong>{row.total?.toLocaleString('fr-FR')} FCFA</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
