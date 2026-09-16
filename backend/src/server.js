import express from 'express';
import cors from 'cors';
import { PORT, getLocalIP } from './config/config.js';
import { runMigrations } from './database/migrate.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { startDiscoveryServer, getConnectedClients } from './discovery.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import productsRoutes from './routes/products.routes.js';
import stockRoutes from './routes/stock.routes.js';
import salesRoutes from './routes/sales.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import customersRoutes from './routes/customers.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import backupRoutes from './routes/backup.routes.js';
import daycloseRoutes from './routes/dayclose.routes.js';
import auditRoutes from './routes/audit.routes.js';

const app = express();

// CORS élargi pour LAN
app.use(cors({
  origin: (origin, cb) => cb(null, true), // accepter toutes les origines sur LAN
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/day', daycloseRoutes);
app.use('/api/audit', auditRoutes);

// Health check + infos LAN
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  local_ip: getLocalIP(),
  port: PORT,
}));

// Postes connectés sur le LAN
app.get('/api/lan/clients', (req, res) => {
  res.json(getConnectedClients());
});

// Gestion des erreurs
app.use(notFound);
app.use(errorHandler);

// Démarrage
runMigrations();

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`GesLo backend démarré`);
  console.log(`  Local   : http://127.0.0.1:${PORT}`);
  console.log(`  Réseau  : http://${ip}:${PORT}  (autres postes du réseau)`);
  // Démarrer le service de découverte UDP
  startDiscoveryServer();
});

export default app;
