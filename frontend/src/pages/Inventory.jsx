import { useEffect, useState, useRef } from 'react';
import { CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Save, RotateCcw } from 'lucide-react';
import { productsApi, stockApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { exportStockCSV } from '../utils/export';
import Spinner from '../components/Spinner';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({}); // { productId: newQty }
  const [notes, setNotes] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState({});
  const [mode, setMode] = useState('guided'); // 'guided' | 'table'
  const inputRef = useRef();
  const toast = useToast();

  useEffect(() => {
    productsApi.getAll({ active_only: 'true' })
      .then((res) => setProducts(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (mode === 'guided' && inputRef.current) inputRef.current.focus();
  }, [currentIdx, mode]);

  const current = products[currentIdx];
  const totalProducts = products.length;
  const countsDone = Object.keys(counts).length;

  const setCount = (id, val) => setCounts((prev) => ({ ...prev, [id]: val }));
  const setNote = (id, val) => setNotes((prev) => ({ ...prev, [id]: val }));

  const saveOne = async (product) => {
    const newQty = counts[product.id];
    if (newQty === undefined || newQty === '') return;
    if (Number(newQty) === product.stock_quantity) {
      setSaved((prev) => ({ ...prev, [product.id]: 'ok' }));
      return;
    }
    setSaving(true);
    try {
      await stockApi.correction({
        product_id: product.id,
        new_quantity: Number(newQty),
        note: notes[product.id] || `Inventaire physique du ${new Date().toLocaleDateString('fr-FR')}`,
      });
      setSaved((prev) => ({ ...prev, [product.id]: 'saved' }));
      toast.success(`${product.name} corrigé : ${product.stock_quantity} → ${newQty}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur.');
    } finally { setSaving(false); }
  };

  const saveAll = async () => {
    const toSave = products.filter((p) =>
      counts[p.id] !== undefined &&
      counts[p.id] !== '' &&
      Number(counts[p.id]) !== p.stock_quantity
    );
    if (toSave.length === 0) { toast.info('Aucune correction à enregistrer.'); return; }
    setSaving(true);
    let ok = 0;
    for (const p of toSave) {
      try {
        await stockApi.correction({
          product_id: p.id,
          new_quantity: Number(counts[p.id]),
          note: notes[p.id] || `Inventaire physique du ${new Date().toLocaleDateString('fr-FR')}`,
        });
        setSaved((prev) => ({ ...prev, [p.id]: 'saved' }));
        ok++;
      } catch { /* continuer */ }
    }
    setSaving(false);
    toast.success(`${ok} correction${ok > 1 ? 's' : ''} enregistrée${ok > 1 ? 's' : ''}.`);
    // Recharger les produits
    productsApi.getAll({ active_only: 'true' }).then((r) => setProducts(r.data));
  };

  const handleKeyDown = (e, product) => {
    if (e.key === 'Enter') {
      saveOne(product);
      if (currentIdx < totalProducts - 1) setCurrentIdx((i) => i + 1);
    }
    if (e.key === 'ArrowRight' && currentIdx < totalProducts - 1) setCurrentIdx((i) => i + 1);
    if (e.key === 'ArrowLeft' && currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const diff = (product) => {
    const v = counts[product.id];
    if (v === undefined || v === '') return null;
    return Number(v) - product.stock_quantity;
  };

  const exportCSV = () => exportStockCSV(products);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Inventaire physique</h1>
          <p className="page-header-subtitle">
            {countsDone}/{totalProducts} produits comptés
            {countsDone > 0 && ` — ${Object.values(counts).filter((v, i) => {
              const p = products[i]; return p && Number(v) !== p.stock_quantity;
            }).length} corrections`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setMode(mode === 'guided' ? 'table' : 'guided')}>
            {mode === 'guided' ? 'Vue tableau' : 'Vue guidée'}
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-success" onClick={saveAll} disabled={saving}>
            <Save size={15} /> {saving ? 'Enregistrement…' : 'Tout enregistrer'}
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ background: 'var(--gray-100)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--primary)',
          width: `${totalProducts > 0 ? (countsDone / totalProducts) * 100 : 0}%`,
          transition: 'width 0.3s ease', borderRadius: 99,
        }} />
      </div>

      {mode === 'guided' ? (
        /* ── Mode guidé ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Produit courant */}
          <div className="card">
            {current && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', fontWeight: 600 }}>
                    {currentIdx + 1} / {totalProducts}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)' }}>
                    {current.category_name || 'Sans catégorie'}
                  </span>
                </div>

                <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 4 }}>
                  {current.name}
                </h2>
                <p style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
                  {current.reference} — {current.unit}
                  {current.unit_quantity > 1 && ` (1 ${current.unit} = ${current.unit_quantity} pièces)`}
                </p>

                <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginBottom: 4 }}>Stock système</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-700)' }}>
                      {current.stock_quantity} <span style={{ fontSize: '0.9rem' }}>{current.unit}</span>
                    </div>
                  </div>
                  {counts[current.id] !== undefined && counts[current.id] !== '' && (
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginBottom: 4 }}>Écart</div>
                      <div style={{
                        fontSize: '1.5rem', fontWeight: 700,
                        color: diff(current) === 0 ? 'var(--success)' : diff(current) > 0 ? 'var(--info)' : 'var(--danger)',
                      }}>
                        {diff(current) > 0 ? '+' : ''}{diff(current)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Quantité comptée *</label>
                  <input
                    ref={inputRef}
                    className="form-control"
                    type="number" min="0" step="any"
                    placeholder={`Stock actuel : ${current.stock_quantity}`}
                    value={counts[current.id] ?? ''}
                    onChange={(e) => setCount(current.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, current)}
                    style={{ fontSize: '1.2rem', fontWeight: 600 }}
                  />
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginTop: 4 }}>
                    Entrée = enregistrer et suivant · → suivant · ← précédent
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Justification (optionnel)</label>
                  <input className="form-control" placeholder="Ex : casse, vol…"
                    value={notes[current.id] || ''}
                    onChange={(e) => setNote(current.id, e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
                  <button className="btn btn-secondary" disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((i) => i - 1)}>
                    <ChevronLeft size={16} /> Précédent
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => {
                      setCount(current.id, current.stock_quantity);
                      setSaved((p) => ({ ...p, [current.id]: 'ok' }));
                      if (currentIdx < totalProducts - 1) setCurrentIdx((i) => i + 1);
                    }}>
                      <RotateCcw size={14} /> Inchangé
                    </button>
                    <button className="btn btn-primary"
                      disabled={counts[current.id] === undefined || counts[current.id] === ''}
                      onClick={() => { saveOne(current); if (currentIdx < totalProducts - 1) setCurrentIdx((i) => i + 1); }}>
                      <Save size={14} /> Enregistrer
                      {currentIdx < totalProducts - 1 && <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {saved[current.id] && (
                  <div className={`alert alert-${saved[current.id] === 'saved' ? 'success' : 'success'}`} style={{ marginTop: 12 }}>
                    <CheckCircle size={14} />
                    {saved[current.id] === 'saved' ? 'Correction enregistrée.' : 'Stock identique, aucune correction.'}
                  </div>
                )}
              </>
            )}
            {!current && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
                <h3>Inventaire terminé !</h3>
                <p style={{ color: 'var(--gray-500)' }}>Tous les produits ont été parcourus.</p>
                <button className="btn btn-success" style={{ marginTop: 16 }} onClick={saveAll}>
                  <Save size={15} /> Enregistrer les corrections restantes
                </button>
              </div>
            )}
          </div>

          {/* Liste de navigation */}
          <div className="card" style={{ maxHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><span className="card-title">Produits</span></div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {products.map((p, i) => {
                const isCurrent = i === currentIdx;
                const isDone = saved[p.id];
                const hasCount = counts[p.id] !== undefined && counts[p.id] !== '';
                const d = hasCount ? Number(counts[p.id]) - p.stock_quantity : null;
                return (
                  <div key={p.id}
                    onClick={() => setCurrentIdx(i)}
                    style={{
                      padding: '0.5rem 1rem', cursor: 'pointer',
                      background: isCurrent ? 'var(--primary-bg)' : 'transparent',
                      borderLeft: isCurrent ? '3px solid var(--primary)' : '3px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid var(--gray-100)',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isCurrent ? 700 : 400, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                        Système : {p.stock_quantity} {p.unit}
                      </div>
                    </div>
                    {isDone && <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                    {!isDone && hasCount && d !== 0 && (
                      <AlertTriangle size={14} style={{ color: d > 0 ? 'var(--info)' : 'var(--danger)', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── Mode tableau ── */
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Produit</th><th>Catégorie</th><th>Unité</th><th>Stock système</th><th>Quantité comptée</th><th>Écart</th><th>Note</th><th></th></tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const d = diff(p);
                  const isChanged = d !== null && d !== 0;
                  const tdStyle = isChanged
                    ? { background: d > 0 ? '#eff6ff' : '#fee2e2' }
                    : {};
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}><strong>{p.name}</strong></td>
                      <td style={tdStyle}>{p.category_name || '—'}</td>
                      <td style={tdStyle}>{p.unit}</td>
                      <td style={tdStyle}>{p.stock_quantity}</td>
                      <td style={tdStyle}>
                        <input className="form-control" type="number" min="0" step="any"
                          style={{ width: 90 }}
                          value={counts[p.id] ?? ''}
                          onChange={(e) => setCount(p.id, e.target.value)}
                          placeholder={p.stock_quantity} />
                      </td>
                      <td style={tdStyle}>
                        {d !== null && (
                          <span style={{ fontWeight: 700, color: d === 0 ? 'var(--success)' : d > 0 ? 'var(--info)' : 'var(--danger)' }}>
                            {d > 0 ? '+' : ''}{d}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <input className="form-control" style={{ width: 140 }}
                          placeholder="Justification…"
                          value={notes[p.id] || ''}
                          onChange={(e) => setNote(p.id, e.target.value)} />
                      </td>
                      <td style={tdStyle}>
                        {saved[p.id]
                          ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                          : <button className="btn btn-ghost btn-sm" onClick={() => saveOne(p)}
                              disabled={!counts[p.id] && counts[p.id] !== 0}>
                              <Save size={13} />
                            </button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
