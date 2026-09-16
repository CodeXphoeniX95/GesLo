import { Router } from 'express';
import { getPurchases, getPurchase, createPurchase } from '../controllers/purchases.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getPurchases);
router.get('/:id', authenticate, getPurchase);
router.post('/', authenticate, createPurchase);

export default router;
