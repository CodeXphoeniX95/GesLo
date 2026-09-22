import { Router } from 'express';
import { login, getMe, changePassword, getUsers, createUser, updateUserStatus, updateUserCommission, getRoles } from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

// Gestion utilisateurs (admin seulement)
router.get('/users', authenticate, requireAdmin, getUsers);
router.post('/users', authenticate, requireAdmin, createUser);
router.patch('/users/:id/status', authenticate, requireAdmin, updateUserStatus);
router.patch('/users/:id/commission', authenticate, requireAdmin, updateUserCommission);
router.get('/roles', authenticate, getRoles);

export default router;
