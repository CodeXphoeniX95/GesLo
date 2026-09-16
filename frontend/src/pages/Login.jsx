import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      error(err.response?.data?.error || 'Connexion impossible. Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <img src="/icon.ico" alt="GesLo" width="44" height="44" style={{ borderRadius: 10 }} />
          <div>
            <h1 style={styles.appName}>GesLo</h1>
            <p style={styles.appSub}>Gestion locale</p>
          </div>
        </div>

        <h2 style={styles.title}>Connexion</h2>
        <p style={styles.subtitle}>Entrez vos identifiants pour accéder à l&apos;application.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Nom d&apos;utilisateur</label>
            <input
              id="username"
              className="form-control"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="admin"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={styles.hint}>
          Compte par défaut — identifiant&nbsp;: <strong>admin</strong> &nbsp;/&nbsp; mot de passe&nbsp;: <strong>admin123</strong>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    background: '#fff', borderRadius: '16px',
    padding: '2.5rem', width: '100%', maxWidth: '420px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem',
  },
  appName: { fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', margin: 0 },
  appSub: { fontSize: '0.75rem', color: '#9ca3af', margin: 0 },  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' },
  subtitle: { fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' },
  hint: {
    marginTop: '1.5rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center',
  },
};
