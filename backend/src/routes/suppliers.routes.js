import { Router } from 'express';
import { getSuppliers, getSupplier, createSupplier, updateSupplier } from '../controllers/suppliers.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getSuppliers);
router.get('/:id', authenticate, getSupplier);
router.post('/', authenticate, createSupplier);
router.put('/:id', authenticate, updateSupplier);

export default router;
