import { Router } from 'express';
import { getLicenseStatus, activateLicense, generateKeyEndpoint } from '../controllers/license.controller.js';

const router = Router();

router.get('/status', getLicenseStatus);
router.post('/activate', activateLicense);
router.post('/generate', generateKeyEndpoint);

export default router;
