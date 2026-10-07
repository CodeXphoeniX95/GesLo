import { Router } from 'express';
import { getDashboard, getSalesReport, getStockReport, getExpensesReport, getSettings, updateSettings, getCommissionsReport, recordPeriodCommissionsAsExpenses } from '../controllers/reports.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/dashboard', authenticate, getDashboard);
router.get('/sales', authenticate, getSalesReport);
router.get('/stock', authenticate, getStockReport);
router.get('/expenses', authenticate, getExpensesReport);
router.get('/commissions', authenticate, getCommissionsReport);
router.post('/commissions/record-expenses', authenticate, requireAdmin, recordPeriodCommissionsAsExpenses);
router.get('/settings', authenticate, getSettings);
router.put('/settings', authenticate, requireAdmin, updateSettings);

export default router;
