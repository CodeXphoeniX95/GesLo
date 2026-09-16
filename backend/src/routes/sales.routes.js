import { Router } from 'express';
import { getSales, getSale, createSale, cancelSale } from '../controllers/sales.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getSales);
router.get('/:id', authenticate, getSale);
router.post('/', authenticate, createSale);
router.post('/:id/cancel', authenticate, cancelSale);

export default router;
