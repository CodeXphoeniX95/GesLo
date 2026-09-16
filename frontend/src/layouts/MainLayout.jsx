import { Outlet, useLocation } from 'react-router-dom';
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

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="header">
          <h2 className="header-title">{title}</h2>
        </header>
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
