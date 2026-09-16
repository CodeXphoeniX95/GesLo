import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import { expensesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

function ExpenseForm({ initial, categories, onSubmit, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ label: '', category_id: '', amount: '', expense_date: today, note: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    await onSubmit(form); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Libellé *</label>
        <input className="form-control" required value={form.label}
          onChange={(e) => set('label', e.target.value)} placeholder="Ex : Facture électricité" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Catégorie *</label>
          <select className="form-control" required value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— Sélectionner —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Montant (FCFA) *</label>
          <input className="form-control" type="number" min="1" required value={form.amount}
            onChange={(e) => set('amount', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Date</label>
        <input className="form-control" type="date" value={form.expense_date}
          onChange={(e) => set('expense_date', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Commentaire</label>
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

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [filters, setFilters] = useState({ start_date: '', end_date: '' });
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    expensesApi.getAll(filters).then((res) => setExpenses(res.data)).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { expensesApi.getCategories().then((r) => setCategories(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    try { await expensesApi.create(data); toast.success('Dépense enregistrée.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleEdit = async (data) => {
    try { await expensesApi.update(selected.id, data); toast.success('Dépense mise à jour.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleDelete = async () => {
    try { await expensesApi.delete(deleteDialog.id); toast.success('Dépense supprimée.'); load(); }
    catch { toast.error('Erreur.'); }
  };

  const total = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Dépenses</h1>
          <p className="page-header-subtitle">
            Total : <strong>{total.toLocaleString('fr-FR')} FCFA</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouvelle dépense
        </button>
      </div>

      <div className="filters-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Du</label>
          <input className="form-control" type="date" value={filters.start_date}
            onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Au</label>
          <input className="form-control" type="date" value={filters.end_date}
            onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))} />
        </div>
        <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}
          onClick={() => setFilters({ start_date: '', end_date: '' })}>
          Réinitialiser
        </button>
      </div>

      {loading ? <Spinner /> : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune dépense" message="Enregistrez les dépenses de votre établissement." />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Saisi par</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{exp.expense_date}</td>
                    <td>
                      <strong>{exp.label}</strong>
                      {exp.note && <><br /><span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{exp.note}</span></>}
                    </td>
                    <td><span className="badge badge-gray">{exp.category_name}</span></td>
                    <td><strong>{exp.amount.toLocaleString('fr-FR')} FCFA</strong></td>
                    <td>{exp.user_name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Modifier"
                          onClick={() => { setSelected(exp); setModal('edit'); }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }}
                          title="Supprimer" onClick={() => setDeleteDialog(exp)}>
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

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouvelle dépense">
        <ExpenseForm categories={categories} onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier la dépense">
        {selected && <ExpenseForm initial={selected} categories={categories} onSubmit={handleEdit} onClose={() => setModal(null)} />}
      </Modal>
      <ConfirmDialog isOpen={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        title="Supprimer la dépense"
        message={`Supprimer "${deleteDialog?.label}" — ${deleteDialog?.amount?.toLocaleString('fr-FR')} FCFA ?`}
        confirmLabel="Supprimer" />
    </>
  );
}
