import { useEffect, useState } from 'react';
import { Save, Plus, Lock, UserCheck, UserX, FileText } from 'lucide-react';
import { reportsApi, authApi, auditApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

// ─── Panneau réseau LAN ──────────────────────────────────────────
function LANPanel() {
  const [health, setHealth] = useState(null);
  const [clients, setClients] = useState([]);
  const [lanInfo, setLanInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const toast = useToast();

  const load = () => {
    fetch('http://127.0.0.1:3001/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});

    if (window.electronAPI?.lan) {
      window.electronAPI.lan.getInfo().then(setLanInfo);
      window.electronAPI.lan.getClients().then(setClients);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = async () => {
    if (!window.electronAPI?.lan) return;
    setResetting(true);
    await window.electronAPI.lan.reset();
    toast.success('Configuration LAN réinitialisée. Redémarrez l\'application.');
    setResetting(false);
  };

  const serverUrl = health ? `http://${health.local_ip}:${health.port}` : null;
  const isServer = !lanInfo || lanInfo.mode === 'server';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      {/* Statut mode */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Mode de fonctionnement</span>
          <span className={`badge badge-${isServer ? 'primary' : 'info'}`}>
            {isServer ? 'Serveur' : 'Client'}
          </span>
        </div>
        {isServer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)', lineHeight: 1.6 }}>
              Ce poste héberge la base de données. Les autres postes du réseau peuvent se connecter en utilisant l&apos;adresse ci-dessous.
            </p>
            {serverUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, background: 'var(--primary-bg)', borderRadius: 8,
                  padding: '10px 14px', fontFamily: 'monospace', fontSize: '1rem',
                  fontWeight: 700, color: 'var(--primary)', userSelect: 'all',
                }}>
                  {serverUrl}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(serverUrl)}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            )}

            {/* QR Code texte */}
            {serverUrl && (
              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', lineHeight: 1.6 }}>
                <strong>Sur les autres postes :</strong> ouvrir un navigateur et saisir <code style={{ background: 'var(--gray-200)', padding: '1px 5px', borderRadius: 4 }}>{serverUrl}</code>
                <br />Ou utiliser l&apos;application GesLo — elle se connectera automatiquement.
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)' }}>
              Ce poste est connecté au serveur :{' '}
              <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                {lanInfo?.server?.ip}:{lanInfo?.server?.port}
              </strong>
            </p>
          </div>
        )}
      </div>

      {/* Postes connectés (mode serveur uniquement) */}
      {isServer && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Postes connectés</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-success">{clients.length} en ligne</span>
              <button className="btn btn-secondary btn-sm" onClick={load}>Actualiser</button>
            </div>
          </div>
          {clients.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)', padding: '0.5rem 0' }}>
              Aucun autre poste connecté pour le moment.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {clients.map((c) => (
                <div key={c.ip} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', background: 'var(--success-bg)',
                  borderRadius: 8, border: '1px solid #86efac',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--success)', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{c.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>{c.ip}</div>
                  </div>
                  <span className="badge badge-success">En ligne</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions firewall */}
      <div className="card">
        <div className="card-header"><span className="card-title">Configuration requise</span></div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            Pour que les autres postes puissent se connecter, autorisez les ports dans le pare-feu Windows (à exécuter une seule fois en tant qu&apos;administrateur) :
          </p>
          <code style={{
            display: 'block', background: '#1e1e2e', color: '#cdd6f4',
            borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem',
            lineHeight: 1.8, userSelect: 'all',
          }}>
            netsh advfirewall firewall add rule name=&quot;GesLo Backend&quot; dir=in action=allow protocol=TCP localport=3001
            <br />
            netsh advfirewall firewall add rule name=&quot;GesLo Frontend&quot; dir=in action=allow protocol=TCP localport=5173
            <br />
            netsh advfirewall firewall add rule name=&quot;GesLo Discovery&quot; dir=in action=allow protocol=UDP localport=47777
          </code>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}
            onClick={() => handleCopy(`netsh advfirewall firewall add rule name="GesLo Backend" dir=in action=allow protocol=TCP localport=3001\nnetsh advfirewall firewall add rule name="GesLo Frontend" dir=in action=allow protocol=TCP localport=5173\nnetsh advfirewall firewall add rule name="GesLo Discovery" dir=in action=allow protocol=UDP localport=47777`)}>
            Copier les commandes
          </button>
        </div>
      </div>

      {/* Réinitialiser */}
      {window.electronAPI?.lan && (
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={resetting}>
            {resetting ? 'Réinitialisation…' : 'Réinitialiser la configuration LAN'}
          </button>
        </div>
      )}
    </div>
  );
}

const BUSINESS_TYPES = [
  { value: 'shop', label: 'Boutique / Magasin' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar / Café' },
  { value: 'pharmacy', label: 'Pharmacie' },
  { value: 'bakery', label: 'Boulangerie' },
  { value: 'other', label: 'Autre commerce' },
];

const CURRENCIES = ['FCFA', 'EUR', 'USD', 'XOF'];

const ROLE_LABELS = {
  admin: 'Administrateur', manager: 'Gérant',
  cashier: 'Caissier', waiter: 'Serveur',
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('business');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'cashier' });
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const toast = useToast();
  const { isAdmin } = useAuth();

  useEffect(() => {
    reportsApi.getSettings().then((r) => setSettings(r.data)).finally(() => setLoading(false));
    if (isAdmin) {
      authApi.getUsers().then((r) => setUsers(r.data));
      authApi.getRoles().then((r) => setRoles(r.data));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'audit' && isAdmin && auditLogs.length === 0) {
      setLoadingAudit(true);
      auditApi.getAll({ limit: 200 })
        .then((r) => setAuditLogs(r.data))
        .catch(() => {})
        .finally(() => setLoadingAudit(false));
    }
  }, [tab, isAdmin, auditLogs.length]);

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await reportsApi.updateSettings(settings); toast.success('Paramètres sauvegardés.'); }
    catch { toast.error('Erreur lors de la sauvegarde.'); }
    setSaving(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await authApi.createUser(newUser);
      toast.success('Utilisateur créé.');
      setUserModal(false);
      authApi.getUsers().then((r) => setUsers(r.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const handleToggleUser = async (user) => {
    try {
      await authApi.updateUserStatus(user.id, { is_active: user.is_active ? 0 : 1 });
      toast.success(user.is_active ? 'Utilisateur désactivé.' : 'Utilisateur activé.');
      authApi.getUsers().then((r) => setUsers(r.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const handleChangePwd = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('Les mots de passe ne correspondent pas.'); return;
    }
    try {
      await authApi.changePassword({ current_password: pwdForm.current_password, new_password: pwdForm.new_password });
      toast.success('Mot de passe modifié.');
      setPwdModal(false);
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur.'); }
  };

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const tabStyle = (t) => ({
    padding: '0.5rem 1rem', border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'none', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--primary)' : 'var(--gray-500)',
    cursor: 'pointer', fontSize: 'var(--font-size-sm)',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-header">
        <h1 className="page-header-title">Paramètres</h1>
      </div>

      {/* Onglets */}
      <div style={{ borderBottom: '1px solid var(--gray-200)', display: 'flex', marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={tabStyle('business')} onClick={() => setTab('business')}>Établissement</button>
        {isAdmin && (
          <button style={tabStyle('users')} onClick={() => setTab('users')}>Utilisateurs</button>
        )}
        {isAdmin && (
          <button style={tabStyle('audit')} onClick={() => setTab('audit')}>
            <FileText size={13} /> Journal d&apos;audit
          </button>
        )}
        <button style={tabStyle('security')} onClick={() => setTab('security')}>Sécurité</button>
        <button style={tabStyle('lan')} onClick={() => setTab('lan')}>Réseau LAN</button>
      </div>

      {/* ── Établissement ── */}
      {tab === 'business' && settings && (
        <form onSubmit={handleSaveSettings}>
          <div className="card">
            <div className="card-header"><span className="card-title">Informations de l&apos;établissement</span></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-control" required value={settings.name || ''} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-control" value={settings.business_type || 'shop'} onChange={(e) => set('business_type', e.target.value)}>
                  {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-control" value={settings.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={settings.email || ''} onChange={(e) => set('email', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input className="form-control" value={settings.address || ''} onChange={(e) => set('address', e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header"><span className="card-title">Localisation & Finance</span></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Devise</label>
                <select className="form-control" value={settings.currency || 'FCFA'} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Symbole</label>
                <input className="form-control" value={settings.currency_symbol || ''} onChange={(e) => set('currency_symbol', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Taxe (%)</label>
                <input className="form-control" type="number" min="0" max="100" value={settings.tax_rate || 0} onChange={(e) => set('tax_rate', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                <input type="checkbox" checked={!!settings.allow_negative_stock} onChange={(e) => set('allow_negative_stock', e.target.checked)} />
                Autoriser les ventes à découvert (stock négatif)
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Message pied de reçu</label>
              <input className="form-control" value={settings.receipt_footer || ''} onChange={(e) => set('receipt_footer', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              <Save size={16} /> {saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      )}

      {/* ── Utilisateurs ── */}
      {tab === 'users' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setUserModal(true)}>
              <Plus size={15} /> Nouvel utilisateur
            </button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Nom complet</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name}</strong></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.username}</td>
                      <td><span className="badge badge-primary">{ROLE_LABELS[u.role] || u.role}</span></td>
                      <td><span className={`badge badge-${u.is_active ? 'success' : 'gray'}`}>{u.is_active ? 'Actif' : 'Inactif'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: u.is_active ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleToggleUser(u)}>
                          {u.is_active ? <><UserX size={14} /> Désactiver</> : <><UserCheck size={14} /> Activer</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Journal d'audit ── */}
      {tab === 'audit' && isAdmin && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Journal d&apos;audit</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setAuditLogs([])}>Actualiser</button>
          </div>
          {loadingAudit ? (
            <Spinner />
          ) : auditLogs.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)', padding: '1rem 0' }}>
              Aucune entrée dans le journal.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td>{log.user_name || '—'}</td>
                      <td>
                        {(() => {
                          const ACTION_LABELS = {
                            LOGIN: 'Connexion',
                            LOGOUT: 'Déconnexion',
                            CHANGE_PASSWORD: 'Changement mot de passe',
                            CREATE_USER: 'Création utilisateur',
                            ACTIVATE_USER: 'Activation utilisateur',
                            DEACTIVATE_USER: 'Désactivation utilisateur',
                            CANCEL_SALE: 'Annulation vente',
                            DELETE_EXPENSE: 'Suppression dépense',
                            CLOSE_DAY: 'Clôture journée',
                          };
                          const label = ACTION_LABELS[log.action] || log.action;
                          const variant =
                            log.action.includes('DELETE') || log.action.includes('CANCEL') || log.action.includes('DEACTIVATE') ? 'danger' :
                            log.action.includes('CREATE') || log.action.includes('ACTIVATE') ? 'success' :
                            log.action === 'LOGIN' ? 'primary' :
                            log.action === 'CLOSE_DAY' ? 'warning' : 'gray';
                          return <span className={`badge badge-${variant}`}>{label}</span>;
                        })()}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{log.entity || '—'}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--gray-500)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          if (!log.details) return '—';
                          try {
                            const d = JSON.parse(log.details);
                            // Afficher les valeurs clé→valeur en français lisible
                            return Object.entries(d).map(([k, v]) => {
                              const labels = {
                                username: 'Utilisateur', date: 'Date',
                                reason: 'Motif', name: 'Nom',
                              };
                              return `${labels[k] || k} : ${v}`;
                            }).join(' | ');
                          } catch {
                            return log.details;
                          }
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sécurité ── */}
      {tab === 'security' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Sécurité du compte</span></div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: 16 }}>
            Utilisez un mot de passe d&apos;au moins 6 caractères pour sécuriser votre accès.
          </p>
          <button className="btn btn-primary" onClick={() => setPwdModal(true)}>
            <Lock size={15} /> Changer mon mot de passe
          </button>
        </div>
      )}

      {/* ── Réseau LAN ── */}
      {tab === 'lan' && <LANPanel />}

      {/* Modal créer utilisateur */}
      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title="Nouvel utilisateur">
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label className="form-label">Nom complet *</label>
            <input className="form-control" required value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Identifiant *</label>
            <input className="form-control" required value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe *</label>
            <input className="form-control" type="password" required minLength={6} value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Rôle</label>
            <select className="form-control" value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.name}>{ROLE_LABELS[r.name] || r.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setUserModal(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Créer</button>
          </div>
        </form>
      </Modal>

      {/* Modal changer mot de passe */}
      <Modal isOpen={pwdModal} onClose={() => setPwdModal(false)} title="Changer mon mot de passe" size="sm">
        <form onSubmit={handleChangePwd}>
          <div className="form-group">
            <label className="form-label">Mot de passe actuel</label>
            <input className="form-control" type="password" required value={pwdForm.current_password}
              onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <input className="form-control" type="password" required minLength={6} value={pwdForm.new_password}
              onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmer</label>
            <input className="form-control" type="password" required value={pwdForm.confirm_password}
              onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPwdModal(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary"><Lock size={14} /> Modifier</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
