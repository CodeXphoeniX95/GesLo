import { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, MinusCircle,
  Package, BarChart2, Clock, Calendar,
} from 'lucide-react';
import { dayApi } from '../services/api';
import Spinner from '../components/Spinner';

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

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

// Graphique barres simple en CSS/SVG
function BarChart({ data, valueKey, labelKey, color = 'var(--primary)', height = 120 }) {
  if (!data?.length) return <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Pas de données.</p>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '0 2px', overflowX: 'auto' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: '0 0 auto', minWidth: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: '100%', background: color, borderRadius: '3px 3px 0 0',
              height: `${(d[valueKey] / max) * (height - 20)}px`,
              minHeight: 3, transition: 'height 0.4s ease', opacity: 0.85,
            }}
            title={`${d[labelKey]} : ${Number(d[valueKey]).toLocaleString('fr-FR')}`}
          />
          <span style={{ fontSize: '0.6rem', color: 'var(--gray-400)', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {String(d[labelKey]).length > 6 ? String(d[labelKey]).slice(5) : d[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

// Graphique horizontal pour classement
function HorizontalBar({ label, value, max, color = 'var(--primary)', sub }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
        <span style={{ fontWeight: 500, color: 'var(--gray-700)' }}>{label}</span>
        <span style={{ color: 'var(--gray-500)' }}>{sub || Number(value).toLocaleString('fr-FR')}</span>
      </div>
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// Donut chart SVG simple
function DonutChart({ data, total }) {
  if (!data?.length || total === 0) return <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Pas de données.</p>;
  const COLORS = ['#4f46e5', '#16a34a', '#d97706', '#0891b2', '#dc2626', '#7c3aed', '#db2777'];
  let cumAngle = -90;
  const cx = 60, cy = 60, r = 45, inner = 28;

  const slices = data.map((d, i) => {
    const angle = (d.revenue / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { ...d, startAngle: start, angle, color: COLORS[i % COLORS.length] };
  });

  const polarToCartesian = (angle, radius) => ({
    x: cx + radius * Math.cos((angle * Math.PI) / 180),
    y: cy + radius * Math.sin((angle * Math.PI) / 180),
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {slices.map((s, i) => {
          if (s.angle >= 360) {
            return (
              <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />
            );
          }
          const largeArc = s.angle > 180 ? 1 : 0;
          const p1 = polarToCartesian(s.startAngle, r);
          const p2 = polarToCartesian(s.startAngle + s.angle, r);
          const p3 = polarToCartesian(s.startAngle + s.angle, inner);
          const p4 = polarToCartesian(s.startAngle, inner);
          return (
            <path key={i}
              d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${inner} ${inner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`}
              fill={s.color} opacity="0.9"
            >
              <title>{s.payment_method} : {Number(s.revenue).toLocaleString('fr-FR')} FCFA</title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r={inner - 2} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="var(--gray-500)">{data.length} modes</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="var(--gray-400)">paiement</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--gray-600)' }}>{s.payment_method}</span>
            <span style={{ color: 'var(--gray-400)', marginLeft: 'auto', paddingLeft: 8 }}>
              {total > 0 ? `${((s.revenue / total) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIODS = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '3 mois' },
  { value: '180', label: '6 mois' },
  { value: '365', label: '1 an' },
];

export default function Statistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    setLoading(true);
    dayApi.getStatistics({ period })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Statistiques</h1>
          <p className="page-header-subtitle">Analyse des performances de votre commerce</p>
        </div>
        {/* Sélecteur période */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map((p) => (
            <button key={p.value}
              className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : !data ? (
        <p style={{ color: 'var(--gray-400)' }}>Impossible de charger les statistiques.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* KPIs */}
          <div className="stats-grid">
            <StatCard icon={DollarSign} label="Chiffre d'affaires" value={fmt(data.totals.revenue)}
              sub={`${data.totals.sale_count} ventes`} colorClass="blue" />
            <StatCard icon={TrendingUp} label="Bénéfice estimé" value={fmt(data.totals.profit)} colorClass="green" />
            <StatCard icon={MinusCircle} label="Dépenses totales" value={fmt(data.totals.expenses)} colorClass="red" />
            <StatCard icon={ShoppingBag} label="Résultat net" value={fmt(data.totals.net)}
              colorClass={data.totals.net >= 0 ? 'green' : 'red'} />
            <StatCard icon={BarChart2} label="Moyenne / jour" value={fmt(data.totals.avg_per_day)} colorClass="cyan" />
            <StatCard icon={Calendar} label="Jours analysés" value={data.period}
              sub={`${data.day_closings?.length || 0} journées clôturées`} colorClass="blue" />
          </div>

          <div className="dashboard-grid">
            {/* Évolution ventes */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
                  Évolution du chiffre d&apos;affaires
                </span>
              </div>
              <BarChart
                data={data.sales_by_day}
                valueKey="revenue"
                labelKey="day"
                color="var(--primary)"
                height={140}
              />
            </div>

            {/* Répartition paiements */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={16} style={{ color: 'var(--primary)' }} />
                  Répartition des paiements
                </span>
              </div>
              <DonutChart
                data={data.by_payment}
                total={data.totals.revenue}
              />
            </div>
          </div>

          <div className="dashboard-grid">
            {/* Top produits */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={16} style={{ color: 'var(--primary)' }} />
                  Top 10 produits vendus
                </span>
              </div>
              {data.top_products?.length ? (
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const maxQty = Math.max(...data.top_products.map((p) => p.qty), 1);
                    return data.top_products.map((p) => (
                      <HorizontalBar
                        key={p.product_name}
                        label={p.product_name}
                        value={p.qty}
                        max={maxQty}
                        color="var(--primary)"
                        sub={`${p.qty} vendu${p.qty > 1 ? 's' : ''} — ${Number(p.revenue).toLocaleString('fr-FR')} FCFA`}
                      />
                    ));
                  })()}
                </div>
              ) : <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Aucune vente sur la période.</p>}
            </div>

            {/* Dépenses par catégorie */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MinusCircle size={16} style={{ color: 'var(--danger)' }} />
                  Dépenses par catégorie
                </span>
              </div>
              {data.expenses_by_category?.length ? (
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const maxExp = Math.max(...data.expenses_by_category.map((e) => e.total), 1);
                    return data.expenses_by_category.map((e) => (
                      <HorizontalBar
                        key={e.category}
                        label={e.category || 'Autres'}
                        value={e.total}
                        max={maxExp}
                        color="var(--danger)"
                        sub={`${Number(e.total).toLocaleString('fr-FR')} FCFA`}
                      />
                    ));
                  })()}
                </div>
              ) : <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Aucune dépense sur la période.</p>}
            </div>
          </div>

          {/* Ventes par heure */}
          {data.by_hour?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  Activité par heure de la journée
                </span>
              </div>
              <BarChart
                data={data.by_hour.map((h) => ({ ...h, label: `${h.hour}h` }))}
                valueKey="count"
                labelKey="label"
                color="var(--info)"
                height={100}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 8 }}>
                Nombre de ventes par heure sur la période sélectionnée.
              </p>
            </div>
          )}

          {/* Historique clôtures */}
          {data.day_closings?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} style={{ color: 'var(--primary)' }} />
                  Historique des clôtures
                </span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Ventes</th><th>CA</th><th>Bénéfice</th><th>Dépenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.day_closings.map((c) => (
                      <tr key={c.closing_date}>
                        <td style={{ fontWeight: 600 }}>
                          {new Date(c.closing_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </td>
                        <td><span className="badge badge-gray">{c.sale_count}</span></td>
                        <td><strong>{Number(c.revenue).toLocaleString('fr-FR')} FCFA</strong></td>
                        <td style={{ color: 'var(--success)' }}>{Number(c.profit).toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ color: 'var(--danger)' }}>{Number(c.expenses).toLocaleString('fr-FR')} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}
