import { Router } from 'express';
import { closeDay, getDayClosings, getTodayStatus, getStatistics } from '../controllers/dayclose.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/status', authenticate, getTodayStatus);
router.get('/history', authenticate, getDayClosings);
router.post('/close', authenticate, requireRole('admin', 'manager'), closeDay);
router.get('/statistics', authenticate, getStatistics);

export default router;
