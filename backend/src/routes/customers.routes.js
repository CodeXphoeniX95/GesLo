import { Router } from 'express';
import { getCustomers, getCustomer, createCustomer, updateCustomer, recordDebtPayment } from '../controllers/customers.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getCustomers);
router.get('/:id', authenticate, getCustomer);
router.post('/', authenticate, createCustomer);
router.put('/:id', authenticate, updateCustomer);
router.post('/:id/payment', authenticate, recordDebtPayment);

export default router;
