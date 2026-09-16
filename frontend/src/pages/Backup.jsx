import { useEffect, useState, useCallback } from 'react';
import { HardDrive, FolderOpen, Info, RefreshCw, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { backupApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Chemin fixe du dossier de sauvegardes
const BACKUP_FOLDER_HINT = 'data\\backups\\';

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);
  const [selectedForRestore, setSelectedForRestore] = useState(null);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const toast = useToast();

  const loadBackups = useCallback(() => {
    setLoading(true);
    backupApi.list()
      .then((res) => setBackups(res.data))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  // Ouvrir le dossier backups dans l'explorateur Windows (Electron)
  const openBackupFolder = () => {
    if (window.electronAPI?.openFolder) {
      // Utiliser le path du dernier fichier créé, ou construire le chemin du dossier
      const folderPath = lastCreated?.path
        ? lastCreated.path.replace(/[^/\\]+$/, '')
        : backups[0]?.path
          ? backups[0].path.replace(/[^/\\]+$/, '')
          : null;
      if (folderPath) {
        window.electronAPI.openFolder(folderPath);
      } else {
        toast.info('Le dossier sera visible après la première sauvegarde.');
      }
    } else {
      toast.info(`Dossier : ${BACKUP_FOLDER_HINT} (dans le répertoire d'installation de GesLo)`);
    }
  };

  const handleBackup = async () => {
    setCreating(true);
    try {
      const res = await backupApi.create();
      setLastCreated(res.data);
      toast.success(res.data.message);
      loadBackups();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de la sauvegarde.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreConfirm = () => {
    if (window.electronAPI?.restore) {
      window.electronAPI.restore().then((result) => {
        if (result.success) {
          toast.success('Données restaurées. L\'application va redémarrer.');
        } else if (!result.cancelled) {
          toast.error('Échec de la restauration.');
        }
      });
    } else {
      toast.info('Restauration disponible dans l\'application desktop. Copiez manuellement le fichier .db dans data/ et renommez-le geslopro.db.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Sauvegarde & Restauration</h1>
          <p className="page-header-subtitle">Protégez vos données en effectuant des sauvegardes régulières.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Bouton toujours visible */}
          <button className="btn btn-secondary" onClick={openBackupFolder}>
            <FolderOpen size={15} /> Ouvrir le dossier
          </button>
          <button className="btn btn-secondary" onClick={loadBackups} disabled={loading}>
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {/* Confirmation dernière sauvegarde */}
      {lastCreated && (
        <div className="alert alert-success">
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>{lastCreated.filename}</strong> — {formatSize(lastCreated.size)}
            <div style={{ fontSize: '0.78rem', opacity: 0.75, marginTop: 2 }}>
              Enregistré dans : {lastCreated.path || BACKUP_FOLDER_HINT}
            </div>
          </div>
        </div>
      )}

      {/* Actions principales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Sauvegarde */}
        <div className="card">
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <HardDrive size={26} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 6 }}>Sauvegarder</h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 20, lineHeight: 1.6 }}>
              Crée une copie complète de la base de données.
              Copiez ce fichier sur une clé USB pour le sécuriser.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleBackup} disabled={creating}>
              <HardDrive size={16} />
              {creating ? 'Sauvegarde en cours…' : 'Créer une sauvegarde'}
            </button>
          </div>
        </div>

        {/* Restauration */}
        <div className="card">
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--warning-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <RotateCcw size={26} style={{ color: 'var(--warning)' }} />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 6 }}>Restaurer</h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)', marginBottom: 20, lineHeight: 1.6 }}>
              Remplace les données actuelles par une sauvegarde.{' '}
              <strong style={{ color: 'var(--danger)' }}>Irréversible sans sauvegarde préalable.</strong>
            </p>
            <button className="btn btn-warning btn-lg"
              onClick={() => { setSelectedForRestore(null); setRestoreDialog(true); }}
              disabled={backups.length === 0}>
              <RotateCcw size={16} /> Restaurer une sauvegarde
            </button>
          </div>
        </div>
      </div>

      {/* Liste des sauvegardes */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={16} style={{ color: 'var(--primary)' }} />
            Sauvegardes disponibles
          </span>
          <span className="badge badge-gray">{backups.length}</span>
        </div>

        {loading ? <Spinner /> : backups.length === 0 ? (
          <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--gray-400)' }}>
            <HardDrive size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ fontSize: 'var(--font-size-sm)' }}>
              Aucune sauvegarde. Cliquez sur <strong>Créer une sauvegarde</strong> pour commencer.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Taille</th>
                  <th>Date de création</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename}
                    style={{ background: selectedForRestore?.filename === b.filename ? 'var(--primary-bg)' : 'transparent' }}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--gray-700)' }}>
                        {b.filename}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{formatSize(b.size)}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                      {new Date(b.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td>
                      <button
                        className="btn btn-warning btn-sm"
                        title="Restaurer cette sauvegarde"
                        onClick={() => { setSelectedForRestore(b); setRestoreDialog(true); }}
                      >
                        <RotateCcw size={13} /> Restaurer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Informations */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} style={{ color: 'var(--info)' }} /> Informations
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)', lineHeight: 1.7 }}>
          <p>
            Emplacement des sauvegardes :{' '}
            <code style={{ background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>
              data\backups\
            </code>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={openBackupFolder}>
              <FolderOpen size={13} /> Ouvrir
            </button>
          </p>
          <p>Format : <code style={{ background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>geslo-YYYY-MM-DD_HH-MM-SS.db</code></p>
          <p>
            <AlertTriangle size={13} style={{ color: 'var(--warning)', marginRight: 4, verticalAlign: 'middle' }} />
            Effectuez une sauvegarde chaque jour en fin de journée et copiez-la sur une clé USB ou un disque externe.
          </p>
        </div>
      </div>

      {/* Confirmation restauration */}
      <ConfirmDialog
        isOpen={restoreDialog}
        onClose={() => setRestoreDialog(false)}
        onConfirm={handleRestoreConfirm}
        title="Confirmer la restauration"
        message={
          selectedForRestore
            ? `Restaurer "${selectedForRestore.filename}" ?\n\nToutes les données actuelles seront remplacées. Cette opération est irréversible.`
            : "Choisir et restaurer une sauvegarde ?\n\nToutes les données actuelles seront remplacées."
        }
        confirmLabel="Restaurer"
        variant="warning"
      />
    </>
  );
}
