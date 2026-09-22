import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

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
        </header>

        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
