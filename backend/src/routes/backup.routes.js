import { Router } from 'express';
import { createBackup, listBackups } from '../controllers/backup.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, listBackups);
router.post('/', authenticate, requireAdmin, createBackup);

export default router;
