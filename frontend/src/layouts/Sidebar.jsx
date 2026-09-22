import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Warehouse, ShoppingCart,
  Truck, Receipt, Users, Factory, BarChart2, TrendingUp,
  Settings, HardDrive, LogOut, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { productsApi } from '../services/api';

const ROLE_LABELS = {
  admin: 'Administrateur', manager: 'Gérant',
  cashier: 'Caissier', waiter: 'Serveur',
};

export default function Sidebar({ onCloseMobile }) {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const isWaiter = user?.role === 'waiter';

  // Charger le nombre de produits en alerte
  useEffect(() => {
    productsApi.getLowStock()
      .then((res) => setAlertCount(res.data.length))
      .catch(() => {});
    // Rafraîchir toutes les 2 minutes
    const interval = setInterval(() => {
      productsApi.getLowStock()
        .then((res) => setAlertCount(res.data.length))
        .catch(() => {});
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      section: 'Principal',
      links: [
        { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
      ],
    },
    {
      section: 'Gestion',
      links: [
        { to: '/products', icon: Package, label: 'Produits' },
        { to: '/categories', icon: Tag, label: 'Catégories' },
        { to: '/stock', icon: Warehouse, label: 'Stock', badge: alertCount > 0 ? alertCount : null },
        { to: '/inventory', icon: ClipboardList, label: 'Inventaire' },
      ],
    },
    {
      section: 'Commerce',
      links: [
        { to: '/sales', icon: ShoppingCart, label: 'Ventes / Caisse' },
        { to: '/purchases', icon: Truck, label: 'Achats' },
        { to: '/expenses', icon: Receipt, label: 'Dépenses' },
      ],
    },
    {
      section: 'Personnes',
      links: [
        { to: '/customers', icon: Users, label: 'Clients' },
        { to: '/suppliers', icon: Factory, label: 'Fournisseurs' },
      ],
    },
    {
      section: 'Analyse',
      links: [
        { to: '/reports', icon: BarChart2, label: 'Rapports', badge: alertCount > 0 ? alertCount : null },
        { to: '/statistics', icon: TrendingUp, label: 'Statistiques' },
      ],
    },
    // Paramètres et Sauvegarde masqués pour les serveurs
    ...(!isWaiter ? [{
      section: 'Système',
      links: [
        { to: '/settings', icon: Settings, label: 'Paramètres' },
        { to: '/backup', icon: HardDrive, label: 'Sauvegarde' },
      ],
    }] : []),
  ];

  return (
    <aside className="sidebar" aria-label="Navigation principale">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" aria-hidden="true">
          <img src="/icon.png" alt="" width="28" height="28" style={{ display: 'block', borderRadius: 4 }} />
        </div>
        <div className="sidebar-logo-text">
          <h1>GesLo</h1>
          <span>Gestion locale</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section} className="sidebar-section">
            <div className="sidebar-section-label">{section.section}</div>
            {section.links.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={onCloseMobile}
              >
                <Icon size={16} className="sidebar-link-icon" aria-hidden="true" />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && (
                  <span style={{
                    background: 'var(--danger)', color: '#fff',
                    borderRadius: '99px', fontSize: '0.6rem', fontWeight: 700,
                    padding: '1px 6px', minWidth: 18, textAlign: 'center',
                    lineHeight: '16px',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={logout}
            title="Déconnexion"
            aria-label="Déconnexion"
            style={{ color: 'var(--gray-400)', marginLeft: 'auto' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
