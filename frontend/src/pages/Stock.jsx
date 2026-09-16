import { useEffect, useState, useCallback } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, SlidersHorizontal,
  Search, Warehouse, ClipboardList,
} from 'lucide-react';
import { stockApi, productsApi } from '../services/api';
import { exportStockCSV, exportMovementsCSV } from '../utils/export';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

const MOV_TYPES = {
  initial: 'Stock initial', purchase: 'Achat', sale: 'Vente',
  return_customer: 'Retour client', return_supplier: 'Retour fournisseur',
  loss: 'Perte', damaged: 'Endommagé', manual_correction: 'Correction',
  kitchen_consumption: 'Cuisine',
};

function StockMovementModal({ products, type, onSubmit, onClose }) {
  const [form, setForm] = useState({
    product_id: '', quantity: '', note: '',
    type: type === 'entry' ? 'purchase' : 'loss',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const entryTypes = ['purchase', 'return_customer', 'initial'];
  const exitTypes = ['loss', 'damaged', 'return_supplier', 'kitchen_consumption'];

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit(form); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Produit *</label>
        <select className="form-control" value={form.product_id} required onChange={(e) => set('product_id', e.target.value)}>
          <option value="">— Sélectionner —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity} {p.unit})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Type de mouvement</label>
        <select className="form-control" value={form.type} onChange={(e) => set('type', e.target.value)}>
          {(type === 'entry' ? entryTypes : exitTypes).map((t) => (
            <option key={t} value={t}>{MOV_TYPES[t]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Quantité *</label>
        <input className="form-control" type="number" min="0.01" step="any" required
          value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Note</label>
        <input className="form-control" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Facultatif" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className={`btn btn-${type === 'entry' ? 'success' : 'warning'}`} disabled={saving}>
          {saving ? 'Enregistrement…' : type === 'entry' ? 'Enregistrer l\'entrée' : 'Enregistrer la sortie'}
        </button>
      </div>
    </form>
  );
}

function CorrectionModal({ products, onSubmit, onClose }) {
  const [form, setForm] = useState({ product_id: '', new_quantity: '', note: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit(form); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Produit *</label>
        <select className="form-control" value={form.product_id} required
          onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
          <option value="">— Sélectionner —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} (actuel : {p.stock_quantity})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Nouvelle quantité *</label>
        <input className="form-control" type="number" min="0" step="any" required
          value={form.new_quantity} onChange={(e) => setForm({ ...form, new_quantity: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Justification *</label>
        <input className="form-control" required value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Ex : Inventaire physique du 01/09/2026" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Correction…' : 'Corriger le stock'}
        </button>
      </div>
    </form>
  );
}

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stock');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  // Filtres historique
  const [movStart, setMovStart] = useState('');
  const [movEnd, setMovEnd] = useState('');
  const [movType, setMovType] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      stockApi.getAll({ search, low_only: lowOnly ? 'true' : 'false' }),
      stockApi.getMovements({ limit: 200, start_date: movStart, end_date: movEnd, type: movType }),
      productsApi.getAll({ active_only: 'true' }),
    ]).then(([s, m, p]) => {
      setStock(s.data); setMovements(m.data); setProducts(p.data);
    }).finally(() => setLoading(false));
  }, [search, lowOnly, movStart, movEnd, movType]);

  useEffect(() => { load(); }, [load]);

  const handleEntry = async (data) => {
    try { await stockApi.addEntry({ ...data, quantity: Number(data.quantity) }); toast.success('Entrée enregistrée.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleExit = async (data) => {
    try { await stockApi.addExit({ ...data, quantity: Number(data.quantity) }); toast.success('Sortie enregistrée.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleCorrection = async (data) => {
    try { await stockApi.correction({ ...data, new_quantity: Number(data.new_quantity) }); toast.success('Stock corrigé.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const tabStyle = (t) => ({
    padding: '0.5rem 1.1rem', border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'none', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--primary)' : 'var(--gray-500)',
    cursor: 'pointer', fontSize: 'var(--font-size-sm)',
    display: 'flex', alignItems: 'center', gap: 6,
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Stock</h1>
          <p className="page-header-subtitle">Gestion des entrées et sorties</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-success" onClick={() => setModal('entry')}>
            <ArrowDownCircle size={15} /> Entrée
          </button>
          <button className="btn btn-warning" onClick={() => setModal('exit')}>
            <ArrowUpCircle size={15} /> Sortie
          </button>
          <button className="btn btn-secondary" onClick={() => setModal('correction')}>
            <SlidersHorizontal size={15} /> Correction
          </button>
          <button className="btn btn-secondary" onClick={() => exportStockCSV(stock)} title="Exporter stock CSV">
            CSV
          </button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--gray-200)', display: 'flex' }}>
        <button style={tabStyle('stock')} onClick={() => setTab('stock')}>
          <Warehouse size={15} /> État du stock
        </button>
        <button style={tabStyle('movements')} onClick={() => setTab('movements')}>
          <ClipboardList size={15} /> Historique
        </button>
      </div>

      {tab === 'stock' && (
        <>
          <div className="filters-bar">
            <div className="search-input-wrapper">
              <Search size={15} className="search-icon" />
              <input className="form-control" placeholder="Rechercher un produit…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Alertes seulement
            </label>
          </div>
          {loading ? <Spinner /> : stock.length === 0 ? (
            <EmptyState icon={Warehouse} title="Aucun produit en stock" />
          ) : (
            <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Produit</th><th>Catégorie</th><th>Unité</th>
                      <th>Stock actuel</th><th>Seuil</th><th>Valeur</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((p) => {
                      const isOut = p.stock_quantity <= 0;
                      const isAlert = p.stock_quantity <= p.alert_threshold;
                      const rowBg = isOut ? '#fee2e2' : isAlert ? '#fff7ed' : 'transparent';
                      const borderColor = isOut ? '#ef4444' : isAlert ? '#f97316' : 'transparent';
                      const tdStyle = isOut || isAlert ? {
                        background: rowBg,
                        borderBottom: `1px solid ${isOut ? '#fca5a5' : '#fed7aa'}`,
                      } : {};
                      return (
                        <tr key={p.id}>
                          <td style={{ ...tdStyle, ...(isAlert ? { borderLeft: `4px solid ${borderColor}` } : {}) }}>
                            <strong style={{ color: isOut ? '#b91c1c' : isAlert ? '#c2410c' : 'inherit' }}>
                              {p.name}
                            </strong>
                            <br />
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{p.reference}</span>
                          </td>
                          <td style={tdStyle}>{p.category_name || '—'}</td>
                          <td style={tdStyle}>{p.unit}</td>
                          <td style={tdStyle}><strong>{p.stock_quantity}</strong></td>
                          <td style={tdStyle}>{p.alert_threshold}</td>
                          <td style={tdStyle}>{(p.stock_quantity * p.purchase_price).toLocaleString('fr-FR')} FCFA</td>
                          <td style={tdStyle}>
                            {isOut
                              ? <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>Rupture</span>
                              : isAlert
                                ? <span style={{ background: '#f97316', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>Alerte</span>
                                : <span className="badge badge-success">OK</span>}
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
      )}

      {tab === 'movements' && (
        <>
          <div className="filters-bar">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Du</label>
              <input className="form-control" type="date" value={movStart}
                onChange={(e) => setMovStart(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Au</label>
              <input className="form-control" type="date" value={movEnd}
                onChange={(e) => setMovEnd(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Type</label>
              <select className="form-control" value={movType} onChange={(e) => setMovType(e.target.value)}>
                <option value="">Tous</option>
                {Object.entries(MOV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}
              onClick={() => { setMovStart(''); setMovEnd(''); setMovType(''); }}>
              Réinitialiser
            </button>
          </div>
          {loading ? <Spinner /> : movements.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Aucun mouvement" message="Aucun résultat pour ces filtres." />
          ) : (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Produit</th><th>Type</th><th>Qté</th>
                    <th>Avant</th><th>Après</th><th>Note</th><th>Utilisateur</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td>{m.product_name}</td>
                      <td>
                        <span className={`badge badge-${m.quantity > 0 ? 'success' : 'danger'}`}>
                          {MOV_TYPES[m.type] || m.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: m.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} {m.unit}
                      </td>
                      <td>{m.quantity_before}</td>
                      <td>{m.quantity_after}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.78rem' }}>{m.note || '—'}</td>
                      <td>{m.user_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}

      <Modal isOpen={modal === 'entry'} onClose={() => setModal(null)} title="Entrée de stock">
        <StockMovementModal products={products} type="entry" onSubmit={handleEntry} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'exit'} onClose={() => setModal(null)} title="Sortie de stock">
        <StockMovementModal products={products} type="exit" onSubmit={handleExit} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'correction'} onClose={() => setModal(null)} title="Correction manuelle de stock">
        <CorrectionModal products={products} onSubmit={handleCorrection} onClose={() => setModal(null)} />
      </Modal>
    </>
  );
}
