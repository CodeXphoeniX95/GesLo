import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Search, Factory } from 'lucide-react';
import { suppliersApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

function SupplierForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit(form); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Nom *</label>
        <input className="form-control" required value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Téléphone</label>
          <input className="form-control" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Adresse</label>
        <input className="form-control" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Note</label>
        <input className="form-control" value={form.note || ''} onChange={(e) => set('note', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    suppliersApi.getAll({ search }).then((res) => setSuppliers(res.data)).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    try { await suppliersApi.create(data); toast.success('Fournisseur créé.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleEdit = async (data) => {
    try { await suppliersApi.update(selected.id, data); toast.success('Fournisseur mis à jour.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Fournisseurs</h1>
          <p className="page-header-subtitle">{suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouveau fournisseur
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input className="form-control" placeholder="Rechercher un fournisseur…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : suppliers.length === 0 ? (
        <EmptyState icon={Factory} title="Aucun fournisseur" message="Ajoutez vos fournisseurs pour suivre vos achats." />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th>Solde dû</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.address || '—'}</td>
                    <td>
                      {s.balance_due > 0
                        ? <span className="badge badge-danger">{s.balance_due?.toLocaleString('fr-FR')} FCFA</span>
                        : <span className="badge badge-success">Soldé</span>}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Modifier"
                        onClick={() => { setSelected(s); setModal('edit'); }}>
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouveau fournisseur">
        <SupplierForm onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier le fournisseur">
        {selected && <SupplierForm initial={selected} onSubmit={handleEdit} onClose={() => setModal(null)} />}
      </Modal>
    </>
  );
}
