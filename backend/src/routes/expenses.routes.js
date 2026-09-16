import { Router } from 'express';
import { getExpenseCategories, getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenses.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/categories', authenticate, getExpenseCategories);
router.get('/', authenticate, getExpenses);
router.post('/', authenticate, createExpense);
router.put('/:id', authenticate, updateExpense);
router.delete('/:id', authenticate, deleteExpense);

export default router;
