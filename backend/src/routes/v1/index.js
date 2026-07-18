import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Future route modules will be mounted here:
// router.use('/users', userRoutes);
// router.use('/admin', adminRoutes);

export default router;
