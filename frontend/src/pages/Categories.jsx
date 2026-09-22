import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { categoriesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

const COLORS = ['#4f46e5','#16a34a','#dc2626','#d97706','#0891b2','#7c3aed','#db2777','#059669'];

function CategoryForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#4f46e5', ...initial });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="cat-name">Nom *</label>
        <input id="cat-name" className="form-control" value={form.name} required
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="cat-desc">Description</label>
        <input id="cat-desc" className="form-control" value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Couleur</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                outline: form.color === c ? `3px solid ${c}` : '3px solid transparent',
                outlineOffset: 2, cursor: 'pointer',
              }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    categoriesApi.getAll().then((res) => {
      setCategories(res.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [search, categories]);

  const handleCreate = async (data) => {
    try { await categoriesApi.create(data); toast.success('Catégorie créée.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleEdit = async (data) => {
    try { await categoriesApi.update(selected.id, data); toast.success('Catégorie mise à jour.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleDelete = async () => {
    try { await categoriesApi.delete(deleteDialog.id); toast.success('Catégorie supprimée.'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Catégories</h1>
          <p className="page-header-subtitle">{filtered.length} catégorie{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input className="form-control" placeholder="Rechercher une catégorie…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={Tag} title={search ? 'Aucun résultat' : 'Aucune catégorie'}
          message={search ? `Aucune catégorie ne correspond à "${search}".` : 'Créez votre première catégorie.'} />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Couleur</th><th>Nom</th><th>Description</th><th>Produits</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: cat.color, display: 'inline-block', verticalAlign: 'middle' }} />
                    </td>
                    <td><strong>{cat.name}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{cat.description || '—'}</td>
                    <td><span className="badge badge-primary">{cat.product_count}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          title="Modifier" onClick={() => { setSelected(cat); setModal('edit'); }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--danger)' }} title="Supprimer"
                          onClick={() => setDeleteDialog(cat)}>
                          <Trash2 size={14} />
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

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouvelle catégorie">
        <CategoryForm onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier la catégorie">
        {selected && <CategoryForm initial={selected} onSubmit={handleEdit} onClose={() => setModal(null)} />}
      </Modal>
      <ConfirmDialog isOpen={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Supprimer la catégorie"
        message={`Supprimer "${deleteDialog?.name}" ? Cette action est irréversible si la catégorie est vide.`}
        confirmLabel="Supprimer" />
    </>
  );
}
