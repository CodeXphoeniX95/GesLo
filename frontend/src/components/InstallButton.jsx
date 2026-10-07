import { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import Modal from './Modal';

export default function InstallButton({
  variant = 'primary',
  size = 'md',
  className = '',
  style = {},
  showIfInstalled = false,
  label = 'Installer l\'application',
}) {
  const { deferredPrompt, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled && !showIfInstalled) {
    return null;
  }

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (deferredPrompt) {
      const handled = await promptInstall();
      if (!handled) {
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <>
      <button
        type="button"
        className={`btn btn-${variant} ${sizeClass} ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', ...style }}
        onClick={handleClick}
        title="Installer l'application sur votre appareil"
      >
        <Download size={size === 'sm' ? 14 : 16} />
        <span>{label}</span>
      </button>

      <Modal
        isOpen={showInstructions}
        title="Installer GesLo sur votre appareil"
        onClose={() => setShowInstructions(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isInstalled ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 8 }} />
              <h3>GesLo est déjà installé !</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginTop: 4 }}>
                L&apos;application est disponible sur votre écran d&apos;accueil ou dans votre menu d&apos;applications.
              </p>
            </div>
          ) : isIOS ? (
            <div>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray-700)', marginBottom: 12 }}>
                Pour installer GesLo sur votre iPhone / iPad (Safari) :
              </p>
              <ol style={{ paddingLeft: 20, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Share size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Appuyez sur le bouton <strong>Partager</strong> en bas de l&apos;écran Safari.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PlusSquare size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Faites défiler vers le bas et appuyez sur <strong>Sur l&apos;écran d&apos;accueil</strong>.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span>Appuyez sur <strong>Ajouter</strong> en haut à droite.</span>
                </li>
              </ol>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray-700)', marginBottom: 12 }}>
                Pour installer GesLo sur votre ordinateur ou smartphone Android :
              </p>
              <ol style={{ paddingLeft: 20, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Download size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Dans Chrome / Edge, cliquez sur l&apos;icône <strong>Installer (↓)</strong> située dans la barre d&apos;adresse.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Smartphone size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Sur Android, ouvrez le menu (⋮) puis appuyez sur <strong>Installer l&apos;application</strong> ou <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.</span>
                </li>
              </ol>
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowInstructions(false)}>
              J&apos;ai compris
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
