import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Trash2, Eye, Truck } from 'lucide-react';
import { purchasesApi, productsApi, suppliersApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

function PurchaseForm({ products, suppliers, onSubmit, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: '', unit_price: '' }]);
  const [amountPaid, setAmountPaid] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity: '', unit_price: '' }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const setItem = (i, k, v) => setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  const total = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit({ supplier_id: supplierId || undefined, items, amount_paid: amountPaid || total, note });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Fournisseur</label>
        <select className="form-control" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">— Aucun —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--gray-700)' }}>Articles</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
            <Plus size={13} /> Ajouter
          </button>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 8, marginBottom: 8 }}>
            <select className="form-control" value={item.product_id} required
              onChange={(e) => setItem(i, 'product_id', e.target.value)}>
              <option value="">— Produit —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="form-control" type="number" min="0.01" step="any" placeholder="Qté" required
              value={item.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
            <input className="form-control" type="number" min="0" placeholder="Prix unit." required
              value={item.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
            {items.length > 1 && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm"
                style={{ color: 'var(--danger)' }} onClick={() => removeItem(i)}>
                <Minus size={13} />
              </button>
            )}
          </div>
        ))}
        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', marginTop: 8, color: 'var(--gray-700)' }}>
          Total : {total.toLocaleString('fr-FR')} FCFA
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Montant payé (FCFA)</label>
          <input className="form-control" type="number" min="0" value={amountPaid}
            placeholder={total} onChange={(e) => setAmountPaid(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer l\'achat'}
        </button>
      </div>
    </form>
  );
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    purchasesApi.getAll().then((res) => setPurchases(res.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    productsApi.getAll({ active_only: 'true' }).then((r) => setProducts(r.data));
    suppliersApi.getAll().then((r) => setSuppliers(r.data));
  }, [load]);

  const handleCreate = async (data) => {
    try {
      await purchasesApi.create(data);
      toast.success('Achat enregistré et stock mis à jour.');
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const viewDetail = async (id) => {
    const res = await purchasesApi.getOne(id);
    setSelected(res.data); setModal('detail');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Achats</h1>
          <p className="page-header-subtitle">{purchases.length} achat{purchases.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouvel achat
        </button>
      </div>

      {loading ? <Spinner /> : purchases.length === 0 ? (
        <EmptyState icon={Truck} title="Aucun achat" message="Enregistrez vos achats pour mettre à jour le stock." />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>N°</th><th>Date</th><th>Fournisseur</th><th>Total</th><th>Payé</th><th>Reste dû</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--gray-500)' }}>{p.purchase_number}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>{p.supplier_name || 'Sans fournisseur'}</td>
                    <td><strong>{p.total?.toLocaleString('fr-FR')} FCFA</strong></td>
                    <td>{p.amount_paid?.toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      {p.balance_due > 0
                        ? <span className="badge badge-danger">{p.balance_due?.toLocaleString('fr-FR')} FCFA</span>
                        : <span className="badge badge-success">Soldé</span>}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Voir le détail"
                        onClick={() => viewDetail(p.id)}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouvel achat" size="lg">
        <PurchaseForm products={products} suppliers={suppliers} onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'detail'} onClose={() => setModal(null)} title={`Achat — ${selected?.purchase_number}`} size="lg">
        {selected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><strong>Fournisseur :</strong> {selected.supplier_name || '—'}</div>
              <div><strong>Date :</strong> {new Date(selected.created_at).toLocaleDateString('fr-FR')}</div>
              <div><strong>Montant payé :</strong> {selected.amount_paid?.toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Reste dû :</strong> {selected.balance_due?.toLocaleString('fr-FR')} FCFA</div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {selected.items?.map((i) => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.quantity}</td>
                      <td>{i.unit_price?.toLocaleString('fr-FR')} FCFA</td>
                      <td><strong>{i.total?.toLocaleString('fr-FR')} FCFA</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: '1.05rem' }}>
              Total : {selected.total?.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
