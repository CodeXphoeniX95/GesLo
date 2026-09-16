import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, DollarSign, AlertTriangle, ShoppingBag,
  MinusCircle, BarChart2, Lock, CheckCircle, Clock,
} from 'lucide-react';
import { reportsApi, dayApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';

function fmt(n) {
  return `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
}

function StatCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon stat-icon-${colorClass}`} aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function MiniChart({ data }) {
  if (!data?.length) return (
    <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '1rem 0' }}>
      Pas encore de données.
    </p>
  );

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const hasAnyData = data.some((d) => d.revenue > 0);

  const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
        {data.map((d) => {
          const date = new Date(d.day + 'T12:00:00');
          const dayName = DAY_LABELS[date.getDay()];
          const barHeight = hasAnyData ? Math.max((d.revenue / max) * 80, d.revenue > 0 ? 4 : 2) : 2;

          return (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              {/* Montant au-dessus si > 0 */}
              {d.revenue > 0 && (
                <span style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {d.revenue >= 1000
                    ? `${(d.revenue / 1000).toFixed(1)}k`
                    : d.revenue}
                </span>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div
                  style={{
                    width: '100%',
                    background: d.revenue > 0 ? 'var(--primary)' : 'var(--gray-200)',
                    borderRadius: '4px 4px 0 0',
                    height: `${barHeight}px`,
                    transition: 'height 0.4s ease',
                    cursor: d.revenue > 0 ? 'default' : 'default',
                  }}
                  title={`${d.day} : ${Number(d.revenue).toLocaleString('fr-FR')} FCFA (${d.count} vente${d.count !== 1 ? 's' : ''})`}
                />
              </div>
              <span style={{ fontSize: '0.62rem', color: 'var(--gray-500)', textAlign: 'center', fontWeight: d.revenue > 0 ? 600 : 400 }}>
                {dayName}
              </span>
            </div>
          );
        })}
      </div>
      {!hasAnyData && (
        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 8 }}>
          Aucune vente sur les 7 derniers jours.
        </p>
      )}
    </div>
  );
}

const PAYMENT_LABELS = {
  cash: 'Espèces', tmoney: 'TMoney', flooz: 'Flooz',
  card: 'Carte', credit: 'Crédit', mixed: 'Mixte',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayStatus, setDayStatus] = useState(null);
  const [closeDialog, setCloseDialog] = useState(false);
  const [closing, setClosing] = useState(false);
  const toast = useToast();
  const { isManager } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      reportsApi.getDashboard(),
      dayApi.getStatus(),
    ]).then(([dashRes, statusRes]) => {
      setData(dashRes.data);
      setDayStatus(statusRes.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCloseDay = async () => {
    setClosing(true);
    try {
      const res = await dayApi.close({});
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la clôture.');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <Spinner />;

  const today = data?.today || {};
  const stock = data?.stock || {};
  const isClosed = dayStatus?.is_closed;
  const todayDate = dayStatus?.date || new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Bandeau clôture */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: isClosed ? 'var(--success-bg)' : '#fff',
        border: `1px solid ${isClosed ? '#86efac' : 'var(--gray-200)'}`,
        borderRadius: 'var(--border-radius-lg)', padding: '0.75rem 1.25rem',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isClosed
            ? <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
            : <Clock size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              {isClosed ? 'Journée clôturée' : 'Journée en cours'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
              {new Date(todayDate).toLocaleDateString('fr-FR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
              {isClosed && dayStatus?.closed_by_name && (
                <span style={{ marginLeft: 8, color: 'var(--success)' }}>
                  — Clôturée par <strong>{dayStatus.closed_by_name}</strong>
                  {dayStatus.closed_at && (
                    <> à {new Date(dayStatus.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
        {isManager && !isClosed && (
          <button className="btn btn-warning" onClick={() => setCloseDialog(true)} disabled={closing}>
            <Lock size={15} />
            {closing ? 'Clôture en cours…' : 'Clôturer la journée'}
          </button>
        )}
        {isClosed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {dayStatus?.revenue > 0 && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--success)', fontWeight: 600 }}>
                {Number(dayStatus.revenue).toLocaleString('fr-FR')} FCFA — {dayStatus.sale_count} vente{dayStatus.sale_count !== 1 ? 's' : ''}
              </span>
            )}
            <span className="badge badge-success" style={{ padding: '0.35rem 0.75rem' }}>
              <CheckCircle size={12} style={{ marginRight: 4 }} /> Clôturée
            </span>
          </div>
        )}
      </div>

      {/* Alerte stock */}
      {stock.low_stock_count > 0 && (
        <div className="alert alert-warning" style={{ margin: 0 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>{stock.low_stock_count} produit{stock.low_stock_count > 1 ? 's' : ''}</strong> en alerte de stock
            {stock.out_of_stock_count > 0 && ` dont ${stock.out_of_stock_count} en rupture`}.
          </span>
        </div>
      )}

      {/* Stats du jour */}
      <section>
        <h2 style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem',
        }}>
          Aujourd&apos;hui
        </h2>
        <div className="stats-grid">
          <StatCard icon={DollarSign} label="Chiffre d'affaires" value={fmt(today.revenue)}
            sub={`${today.sale_count || 0} vente${today.sale_count !== 1 ? 's' : ''}`} colorClass="blue" />
          <StatCard icon={TrendingUp} label="Bénéfice estimé" value={fmt(today.profit)} colorClass="green" />
          <StatCard icon={MinusCircle} label="Dépenses" value={fmt(today.expenses)} colorClass="red" />
          <StatCard icon={AlertTriangle} label="Alertes stock" value={stock.low_stock_count || 0}
            sub={`${stock.out_of_stock_count || 0} rupture${stock.out_of_stock_count !== 1 ? 's' : ''}`} colorClass="yellow" />
        </div>
      </section>

      <div className="dashboard-grid">
        {/* Graphique 7 jours */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
              Ventes — 7 derniers jours
            </span>
          </div>
          <MiniChart data={data?.chart_data} />
        </div>

        {/* 5 dernières ventes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
              5 dernières ventes
            </span>
          </div>
          {data?.recent_sales?.length ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>N°</th><th>Total</th><th>Paiement</th><th>Caissier</th></tr>
                </thead>
                <tbody>
                  {data.recent_sales.slice(0, 5).map((s) => (
                    <tr key={s.sale_number}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          {s.sale_number}
                        </span>
                      </td>
                      <td><strong>{Number(s.total).toLocaleString('fr-FR')} FCFA</strong></td>
                      <td>
                        <span className="badge badge-primary">
                          {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                        </span>
                      </td>
                      <td>{s.cashier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
              Aucune vente aujourd&apos;hui.
            </p>
          )}
        </div>
      </div>

      {/* Confirmation clôture */}
      <ConfirmDialog
        isOpen={closeDialog}
        onClose={() => setCloseDialog(false)}
        onConfirm={handleCloseDay}
        title="Clôturer la journée"
        message={`Confirmer la clôture de la journée du ${new Date(todayDate).toLocaleDateString('fr-FR')} ?\n\nUne fois clôturée, vous ne pourrez plus revenir en arrière.`}
        confirmLabel="Clôturer"
        variant="warning"
      />
    </div>
  );
}
