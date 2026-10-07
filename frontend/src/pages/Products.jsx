import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Search, Package,
} from 'lucide-react';
import { productsApi, categoriesApi, suppliersApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

const UNITS = ['pièce', 'kg', 'litre', 'g', 'ml', 'carton', 'casier', 'bouteille', 'sachet', 'boîte', 'palette'];
const CONTAINER_UNITS = ['carton', 'casier', 'palette', 'boîte', 'sachet'];

function ProductForm({ initial, categories = [], suppliers = [], onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: '', barcode: '', category_id: '', unit: 'pièce',
    unit_quantity: '', purchase_price: '', sale_price: '',
    stock_quantity: '', alert_threshold: 5, supplier_id: '', ...initial,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isContainer = CONTAINER_UNITS.includes(form.unit);
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit(form); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Nom *</label>
          <input className="form-control" value={form.name} required onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Catégorie</label>
          <select className="form-control" value={form.category_id || ''} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— Aucune —</option>
            {safeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Prix d&apos;achat (FCFA)</label>
          <input className="form-control" type="number" min="0" value={form.purchase_price || ''} onChange={(e) => set('purchase_price', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Prix de vente (FCFA) *</label>
          <input className="form-control" type="number" min="0" required value={form.sale_price || ''} onChange={(e) => set('sale_price', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Unité de vente *</label>
          <select className="form-control" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {isContainer && (
          <div className="form-group">
            <label className="form-label">Contenance (nb de pièces par {form.unit}) *</label>
            <input className="form-control" type="number" min="2" required placeholder="ex: 40 pour 1 carton de 40"
              value={form.unit_quantity || ''} onChange={(e) => set('unit_quantity', e.target.value)} />
          </div>
        )}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Stock initial ({form.unit}s)</label>
          <input className="form-control" type="number" min="0" value={form.stock_quantity || ''}
            onChange={(e) => set('stock_quantity', e.target.value)} disabled={!!initial?.id} />
        </div>
        <div className="form-group">
          <label className="form-label">Seuil d&apos;alerte ({form.unit}s)</label>
          <input className="form-control" type="number" min="0" value={form.alert_threshold}
            onChange={(e) => set('alert_threshold', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Fournisseur</label>
        <select className="form-control" value={form.supplier_id || ''} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">— Aucun —</option>
          {safeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {isContainer && form.unit_quantity > 1 && (
        <div style={{ padding: '0.625rem 0.875rem', background: 'var(--primary-50)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--primary-700)', marginBottom: 12 }}>
          <strong>Contenance activée :</strong> 1 {form.unit} = {form.unit_quantity} pièce{form.unit_quantity > 1 ? 's' : ''}.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function StockDisplay({ product }) {
  const { stock_quantity, unit_quantity, unit, alert_threshold } = product;
  const isAlert = stock_quantity <= alert_threshold;
  const isEmpty = stock_quantity <= 0;

  let label = `${stock_quantity} ${unit}`;
  let sub = null;

  if (unit_quantity && unit_quantity > 1 && stock_quantity > 0) {
    const containers = Math.floor(stock_quantity / unit_quantity);
    const remainder = stock_quantity % unit_quantity;
    if (containers > 0 && remainder > 0) {
      sub = `${containers} ${unit}${containers > 1 ? 's' : ''} + ${remainder} pièce${remainder > 1 ? 's' : ''}`;
    } else if (containers > 0) {
      sub = `${containers} ${unit}${containers > 1 ? 's' : ''} complet${containers > 1 ? 's' : ''}`;
    } else {
      sub = `${remainder} pièce${remainder > 1 ? 's' : ''} (${unit} incomplet)`;
    }
  }

  const badgeClass = isEmpty ? 'badge-danger' : isAlert ? 'badge-warning' : 'badge-success';

  return (
    <div>
      <span className={`badge ${badgeClass}`}>{label}</span>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    productsApi.getAll({ search, category_id: filterCat, active_only: 'false' })
      .then((res) => setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, filterCat]);

  useEffect(() => {
    categoriesApi.getAll().then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => setCategories([]));
    suppliersApi.getAll().then((r) => setSuppliers(Array.isArray(r.data) ? r.data : [])).catch(() => setSuppliers([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    try { await productsApi.create(data); toast.success('Produit créé.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleEdit = async (data) => {
    try { await productsApi.update(selected.id, data); toast.success('Produit mis à jour.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleToggleStatus = async (product) => {
    try {
      await productsApi.updateStatus(product.id, { is_active: product.is_active ? 0 : 1 });
      toast.success(product.is_active ? 'Produit désactivé.' : 'Produit activé.');
      load();
    } catch { toast.error('Erreur.'); }
  };
  const handleDelete = async () => {
    try {
      const res = await productsApi.delete(deleteDialog.id);
      toast.success(res.data?.message || 'Produit supprimé.');
      setDeleteDialog(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression.');
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Produits</h1>
          <p className="page-header-subtitle">{safeProducts.length} produit{safeProducts.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouveau produit
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input className="form-control" placeholder="Rechercher un produit…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ maxWidth: 200 }} value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {safeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : safeProducts.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit trouvé"
          description="Créez votre premier produit pour commencer."
          action={<button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Créer un produit</button>} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Fournisseur</th>
                  <th>P. Achat</th>
                  <th>P. Vente</th>
                  <th>Stock</th>
                  <th>Statut</th>
                  <th style={{ width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {safeProducts.map((p) => (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                    <td><span className="code-badge">{p.reference}</span></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category_name || '—'}</td>
                    <td>{p.supplier_name || '—'}</td>
                    <td>{p.purchase_price ? `${p.purchase_price.toLocaleString('fr-FR')} FCFA` : '—'}</td>
                    <td><strong>{p.sale_price.toLocaleString('fr-FR')} FCFA</strong></td>
                    <td><StockDisplay product={p} /></td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary" title="Modifier"
                          onClick={() => { setSelected(p); setModal('edit'); }}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-sm btn-secondary"
                          title={p.is_active ? 'Désactiver' : 'Activer'}
                          onClick={() => handleToggleStatus(p)}>
                          {p.is_active ? <ToggleRight size={13} style={{ color: 'var(--success-600)' }} />
                                      : <ToggleLeft size={13} style={{ color: 'var(--gray-400)' }} />}
                        </button>
                        <button className="btn btn-sm btn-danger" title="Supprimer le produit"
                          onClick={() => setDeleteDialog(p)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal === 'create'} title="Nouveau produit" onClose={() => setModal(null)}>
        <ProductForm categories={categories} suppliers={suppliers} onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'edit' && !!selected} title="Modifier le produit" onClose={() => { setModal(null); setSelected(null); }}>
        <ProductForm initial={selected} categories={categories} suppliers={suppliers} onSubmit={handleEdit} onClose={() => { setModal(null); setSelected(null); }} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteDialog}
        title="Supprimer le produit"
        message={`Voulez-vous vraiment supprimer "${deleteDialog?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteDialog(null)}
      />
    </>
  );
}
