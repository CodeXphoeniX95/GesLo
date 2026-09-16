import { Router } from 'express';
import { getStock, addStockEntry, addStockExit, getStockMovements, manualCorrection } from '../controllers/stock.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getStock);
router.get('/movements', authenticate, getStockMovements);
router.post('/entries', authenticate, addStockEntry);
router.post('/exits', authenticate, addStockExit);
router.post('/correction', authenticate, manualCorrection);

export default router;
