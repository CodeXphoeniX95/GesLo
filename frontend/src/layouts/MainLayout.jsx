import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import Sidebar from './Sidebar';
import LicenseLockModal from '../components/LicenseLockModal';
import { licenseApi } from '../services/api';

const TITLES = {
  '/': 'Tableau de bord',
  '/products': 'Produits',
  '/categories': 'Catégories',
  '/stock': 'Stock',
  '/inventory': 'Inventaire physique',
  '/sales': 'Ventes & Caisse',
  '/purchases': 'Achats',
  '/expenses': 'Dépenses',
  '/customers': 'Clients',
  '/suppliers': 'Fournisseurs',
  '/reports': 'Rapports',
  '/statistics': 'Statistiques',
  '/settings': 'Paramètres',
  '/backup': 'Sauvegarde',
};

export default function MainLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'GesLo';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [licenseState, setLicenseState] = useState(null);

  const checkLicense = useCallback(() => {
    licenseApi.getStatus()
      .then((res) => setLicenseState(res.data))
      .catch(() => setLicenseState({ is_valid: false, status: 'unlicensed', message: 'Erreur lors du contrôle de licence.' }));
  }, []);

  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 60000); // Contrôle toutes les minutes
    return () => clearInterval(interval);
  }, [checkLicense]);

  const toggleMobile = () => setMobileOpen(!mobileOpen);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`app-layout ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      {/* Backdrop sombre pour mobile */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={closeMobile} aria-hidden="true" />
      )}

      <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobile} />

      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-ghost btn-icon mobile-toggle-btn"
              onClick={toggleMobile}
              aria-label="Menu principal"
              title="Menu principal"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="header-title">{title}</h2>
          </div>

          {/* Badge statut licence dans le header */}
          {licenseState && licenseState.is_valid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: licenseState.days_left <= 30 ? 'var(--warning-700)' : 'var(--success-700)', background: licenseState.days_left <= 30 ? 'var(--warning-50)' : 'var(--success-50)', padding: '4px 10px', borderRadius: 20, border: `1px solid ${licenseState.days_left <= 30 ? '#fde68a' : '#bbf7d0'}` }}>
              {licenseState.days_left <= 30 ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
              <span>Licence 1 An : <strong>{licenseState.days_left} jour{licenseState.days_left > 1 ? 's' : ''} restant{licenseState.days_left > 1 ? 's' : ''}</strong></span>
            </div>
          )}
        </header>

        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Modal de verrouillage si la licence est invalide ou expirée */}
      {licenseState && !licenseState.is_valid && (
        <LicenseLockModal licenseState={licenseState} onActivated={checkLicense} />
      )}
    </div>
  );
}
