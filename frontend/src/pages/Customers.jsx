import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Eye, Banknote, Users, Search } from 'lucide-react';
import { customersApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

function CustomerForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', ...initial });
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
      <div className="form-group">
        <label className="form-label">Téléphone</label>
        <input className="form-control" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Adresse</label>
        <input className="form-control" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
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

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    customersApi.getAll({ search }).then((res) => setCustomers(res.data)).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    try { await customersApi.create(data); toast.success('Client créé.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handleEdit = async (data) => {
    try { await customersApi.update(selected.id, data); toast.success('Client mis à jour.'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };
  const handlePayment = async () => {
    try {
      await customersApi.recordPayment(paymentModal.id, { amount: Number(paymentAmount) });
      toast.success('Paiement enregistré.');
      setPaymentModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const viewDetail = async (id) => {
    const res = await customersApi.getOne(id);
    setDetail(res.data); setModal('detail');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Clients</h1>
          <p className="page-header-subtitle">{customers.length} client{customers.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input className="form-control" placeholder="Rechercher par nom ou téléphone…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <Spinner /> : customers.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" message="Ajoutez vos premiers clients." />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Nom</th><th>Téléphone</th><th>Total achats</th><th>Solde dû</th><th>Dernière visite</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.total_purchases?.toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      {c.balance_due > 0
                        ? <span className="badge badge-danger">{c.balance_due.toLocaleString('fr-FR')} FCFA</span>
                        : <span className="badge badge-success">Soldé</span>}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {c.last_transaction_at ? new Date(c.last_transaction_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Voir le détail"
                          onClick={() => viewDetail(c.id)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Modifier"
                          onClick={() => { setSelected(c); setModal('edit'); }}>
                          <Pencil size={14} />
                        </button>
                        {c.balance_due > 0 && (
                          <button className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: 'var(--success)' }} title="Enregistrer un paiement"
                            onClick={() => { setPaymentModal(c); setPaymentAmount(''); }}>
                            <Banknote size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouveau client">
        <CustomerForm onSubmit={handleCreate} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier le client">
        {selected && <CustomerForm initial={selected} onSubmit={handleEdit} onClose={() => setModal(null)} />}
      </Modal>

      <Modal isOpen={modal === 'detail'} onClose={() => setModal(null)} title={detail?.name} size="lg">
        {detail && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><strong>Téléphone :</strong> {detail.phone || '—'}</div>
              <div><strong>Adresse :</strong> {detail.address || '—'}</div>
              <div><strong>Total achats :</strong> {detail.total_purchases?.toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Solde dû :</strong> {detail.balance_due?.toLocaleString('fr-FR')} FCFA</div>
            </div>
            <h4 style={{ marginBottom: 8, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Dernières ventes</h4>
            {detail.recent_sales?.length ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>N°</th><th>Total</th><th>Paiement</th><th>Date</th></tr></thead>
                  <tbody>
                    {detail.recent_sales.map((s) => (
                      <tr key={s.sale_number}>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{s.sale_number}</span></td>
                        <td>{s.total?.toLocaleString('fr-FR')} FCFA</td>
                        <td>{s.payment_method}</td>
                        <td style={{ fontSize: '0.78rem' }}>{new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Aucune vente enregistrée.</p>}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)} title="Enregistrer un paiement" size="sm">
        <p style={{ marginBottom: 12, color: 'var(--gray-600)', fontSize: '0.875rem' }}>
          Solde de <strong>{paymentModal?.name}</strong> :{' '}
          <strong>{paymentModal?.balance_due?.toLocaleString('fr-FR')} FCFA</strong>
        </p>
        <div className="form-group">
          <label className="form-label">Montant reçu (FCFA)</label>
          <input className="form-control" type="number" min="1" value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Annuler</button>
          <button className="btn btn-success" onClick={handlePayment} disabled={!paymentAmount}>
            <Banknote size={15} /> Enregistrer
          </button>
        </div>
      </Modal>
    </>
  );
}
