import { Router } from 'express';
import { getHealth, resetProviderHealth } from '../../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.post('/reset', resetProviderHealth);

export default router;
