import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { Plus, Pencil, Trash2, Receipt, ChevronDown, ChevronRight, Users } from 'lucide-react';
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
            {(Array.isArray(categories) ? categories : []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const today = getTodayStr();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [filters, setFilters] = useState({ start_date: today, end_date: today, category_id: '' });
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    expensesApi.getAll(filters)
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    expensesApi.getCategories()
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, []);

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

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const processedExpenses = useMemo(() => {
    const safe = Array.isArray(expenses) ? expenses : [];
    const grouped = [];
    const remGroups = {};

    safe.forEach((exp) => {
      const isRemuneration =
        exp.category_name === 'Commissions / Rémunérations' ||
        (exp.label && (exp.label.toLowerCase().includes('rémunération') || exp.label.toLowerCase().includes('commission')));

      if (isRemuneration) {
        const key = `rem_${exp.expense_date}`;
        if (!remGroups[key]) {
          remGroups[key] = {
            isGroup: true,
            id: key,
            expense_date: exp.expense_date,
            category_name: exp.category_name || 'Commissions / Rémunérations',
            items: [],
          };
        }
        remGroups[key].items.push(exp);
      } else {
        grouped.push({ isGroup: false, data: exp });
      }
    });

    Object.values(remGroups).forEach((g) => {
      if (g.items.length === 1) {
        grouped.push({ isGroup: false, data: g.items[0] });
      } else if (g.items.length > 1) {
        g.totalAmount = g.items.reduce((acc, item) => acc + (item.amount || 0), 0);
        grouped.push(g);
      }
    });

    return grouped.sort((a, b) => {
      const dateA = a.isGroup ? a.expense_date : a.data.expense_date;
      const dateB = b.isGroup ? b.expense_date : b.data.expense_date;
      return new Date(dateB) - new Date(dateA);
    });
  }, [expenses]);

  const total = (Array.isArray(expenses) ? expenses : []).reduce((acc, e) => acc + (e.amount || 0), 0);
  const isTodayView = filters.start_date === today && filters.end_date === today;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Dépenses</h1>
          <p className="page-header-subtitle">
            Total : <strong>{total.toLocaleString('fr-FR')} FCFA</strong>
            {isTodayView && <span className="badge badge-success" style={{ marginLeft: 8 }}>Aujourd&apos;hui</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouvelle dépense
        </button>
      </div>

      <div className="filters-bar" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
          <button
            type="button"
            className={`btn btn-sm ${isTodayView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilters((f) => ({ ...f, start_date: today, end_date: today }))}
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            className={`btn btn-sm ${!filters.start_date && !filters.end_date ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilters((f) => ({ ...f, start_date: '', end_date: '' }))}
          >
            Tout l&apos;historique
          </button>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Catégorie</label>
          <select className="form-control" style={{ minWidth: 150 }} value={filters.category_id}
            onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))}>
            <option value="">Toutes les catégories</option>
            {(Array.isArray(categories) ? categories : []).map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
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
        {(filters.start_date !== today || filters.end_date !== today || filters.category_id) && (
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}
            onClick={() => setFilters({ start_date: today, end_date: today, category_id: '' })}>
            Réinitialiser
          </button>
        )}
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
                {processedExpenses.map((item) => {
                  if (item.isGroup) {
                    const isExpanded = !!expandedGroups[item.id];
                    return (
                      <Fragment key={item.id}>
                        <tr
                          style={{ background: 'var(--primary-50)', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => toggleGroup(item.id)}
                        >
                          <td style={{ whiteSpace: 'nowrap' }}>{item.expense_date}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <Users size={16} style={{ color: 'var(--primary)' }} />
                              <strong>Rémunérations de la période ({item.items.length} membres)</strong>
                            </div>
                          </td>
                          <td><span className="badge badge-primary">{item.category_name}</span></td>
                          <td><strong style={{ color: 'var(--primary)' }}>{item.totalAmount.toLocaleString('fr-FR')} FCFA</strong></td>
                          <td><span className="badge badge-gray">{item.items.length} employés</span></td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.75rem', fontWeight: 600 }}
                              onClick={(e) => { e.stopPropagation(); toggleGroup(item.id); }}
                            >
                              {isExpanded ? 'Réduire' : 'Développer'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && item.items.map((subExp) => (
                          <tr key={subExp.id} style={{ background: 'var(--gray-50)', fontSize: '0.85rem' }}>
                            <td style={{ whiteSpace: 'nowrap', paddingLeft: 24, color: 'var(--gray-400)' }}>↳ {subExp.expense_date}</td>
                            <td style={{ paddingLeft: 28 }}>
                              <strong>{subExp.label}</strong>
                              {subExp.note && <><br /><span style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{subExp.note}</span></>}
                            </td>
                            <td><span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{subExp.category_name}</span></td>
                            <td><strong>{subExp.amount.toLocaleString('fr-FR')} FCFA</strong></td>
                            <td>{subExp.user_name}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-icon btn-sm" title="Modifier"
                                  onClick={() => { setSelected(subExp); setModal('edit'); }}>
                                  <Pencil size={14} />
                                </button>
                                <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }}
                                  title="Supprimer" onClick={() => setDeleteDialog(subExp)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  } else {
                    const exp = item.data;
                    return (
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
                    );
                  }
                })}
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
