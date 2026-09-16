import axios from 'axios';

// Détection automatique de l'URL du backend
// - En dev Vite (localhost) → 127.0.0.1:3001
// - Sur un autre poste du réseau (IP locale) → même hostname, port 3001
// - Dans Electron (file://) → 127.0.0.1:3001
function getBaseURL() {
  const hostname = window.location.hostname;
  // Electron ou localhost
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3001/api';
  }
  // Autre poste sur le LAN → même IP, port 3001
  return `http://${hostname}:3001/api`;
}

const BASE_URL = getBaseURL();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer les erreurs globalement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  updateUserStatus: (id, data) => api.patch(`/auth/users/${id}/status`, data),
  getRoles: () => api.get('/auth/roles'),
};

// ─── Catégories ─────────────────────────────────────────
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// ─── Produits ───────────────────────────────────────────
export const productsApi = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  updateStatus: (id, data) => api.patch(`/products/${id}/status`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getLowStock: () => api.get('/products/low-stock'),
};

// ─── Stock ──────────────────────────────────────────────
export const stockApi = {
  getAll: (params) => api.get('/stock', { params }),
  getMovements: (params) => api.get('/stock/movements', { params }),
  addEntry: (data) => api.post('/stock/entries', data),
  addExit: (data) => api.post('/stock/exits', data),
  correction: (data) => api.post('/stock/correction', data),
};

// ─── Ventes ─────────────────────────────────────────────
export const salesApi = {
  getAll: (params) => api.get('/sales', { params }),
  getOne: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  cancel: (id, data) => api.post(`/sales/${id}/cancel`, data),
};

// ─── Achats ─────────────────────────────────────────────
export const purchasesApi = {
  getAll: (params) => api.get('/purchases', { params }),
  getOne: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
};

// ─── Dépenses ───────────────────────────────────────────
export const expensesApi = {
  getAll: (params) => api.get('/expenses', { params }),
  getCategories: () => api.get('/expenses/categories'),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};

// ─── Clients ────────────────────────────────────────────
export const customersApi = {
  getAll: (params) => api.get('/customers', { params }),
  getOne: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  recordPayment: (id, data) => api.post(`/customers/${id}/payment`, data),
};

// ─── Fournisseurs ───────────────────────────────────────
export const suppliersApi = {
  getAll: (params) => api.get('/suppliers', { params }),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
};

// ─── Rapports ───────────────────────────────────────────
export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getSales: (params) => api.get('/reports/sales', { params }),
  getStock: () => api.get('/reports/stock'),
  getExpenses: (params) => api.get('/reports/expenses', { params }),
  getSettings: () => api.get('/reports/settings'),
  updateSettings: (data) => api.put('/reports/settings', data),
};

// ─── Clôture journée & Statistiques ────────────────────
export const dayApi = {
  getStatus: () => api.get('/day/status'),
  close: (data) => api.post('/day/close', data),
  getHistory: () => api.get('/day/history'),
  getStatistics: (params) => api.get('/day/statistics', { params }),
};

// ─── Journal d'audit ────────────────────────────────────────────
export const auditApi = {
  getAll: (params) => api.get('/audit', { params }),
};

// ─── Infos serveur LAN ──────────────────────────────────────────
export const serverApi = {
  health: () => api.get('/health'),
};

// ─── Sauvegarde ─────────────────────────────────────────
export const backupApi = {
  list: () => api.get('/backup'),
  create: () => api.post('/backup'),
};

export default api;
