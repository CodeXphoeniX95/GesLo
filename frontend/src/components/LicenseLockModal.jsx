import { useState } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Lock, Copy, Check } from 'lucide-react';
import { licenseApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function LicenseLockModal({ licenseState, onActivated }) {
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setActivating(true);
    try {
      const res = await licenseApi.activate({ key: keyInput.trim() });
      toast.success(res.data.message || 'Licence 1 An activée avec succès !');
      setKeyInput('');
      onActivated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'activation.');
    } finally {
      setActivating(false);
    }
  };

  const handleCopyMachineId = () => {
    if (licenseState?.machine_id) {
      navigator.clipboard.writeText(licenseState.machine_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExpired = licenseState?.status === 'expired';
  const isClockTampered = licenseState?.status === 'clock_tampered';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 16,
        maxWidth: 480,
        width: '100%',
        padding: '32px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: isClockTampered ? '#fee2e2' : isExpired ? '#fef3c7' : '#e0e7ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          {isClockTampered ? (
            <ShieldAlert size={32} style={{ color: '#dc2626' }} />
          ) : isExpired ? (
            <Lock size={32} style={{ color: '#d97706' }} />
          ) : (
            <KeyRound size={32} style={{ color: '#4f46e5' }} />
          )}
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
          {isClockTampered ? 'Sécurité Horloge Système' : isExpired ? 'Licence 1 An Expirée' : 'Activation de Licence GesLo'}
        </h2>

        <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: 16 }}>
          {licenseState?.message || 'Veuillez saisir votre clé de réactivation autorisée pour continuer à utiliser GesLo.'}
        </p>

        {/* Code Machine unique pour cet ordinateur */}
        {licenseState?.machine_id && (
          <div style={{
            background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
                Code Machine (Cet Ordinateur)
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                {licenseState.machine_id}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyMachineId}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
            >
              {copied ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        )}

        <form onSubmit={handleActivate} style={{ textAlign: 'left' }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>
              Clé de licence 1 An
            </label>
            <input
              className="form-control"
              style={{
                fontSize: '0.95rem',
                letterSpacing: '1px',
                textAlign: 'center',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                padding: '12px',
                borderRadius: 8,
              }}
              value={keyInput}
              required
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="ex: GESLO-1YR-A8F391B4-XXXX"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={activating || !keyInput.trim()}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 8,
            }}
          >
            {activating ? (
              'Vérification et Activation…'
            ) : (
              <>
                <CheckCircle2 size={18} /> Activer GesLo pour 1 An
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
          Communiquez le <strong>Code Machine</strong> ci-dessus à l&apos;éditeur pour obtenir votre clé de licence unique.
        </div>
      </div>
    </div>
  );
}
