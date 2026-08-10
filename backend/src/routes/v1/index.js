import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import studyRoutes from './study.routes.js';
import aiRoutes from './ai.routes.js';
import pdfRoutes from './pdf.routes.js';
import highlightsRoutes from './highlights.routes.js';
import studyPlanRoutes from './studyPlan.routes.js';
import studyTaskRoutes from './studyTask.routes.js';
import mindMapRoutes from './mindMap.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/study', studyRoutes);
router.use('/ai', aiRoutes);
router.use('/pdf', pdfRoutes);
router.use('/highlights', highlightsRoutes);
router.use('/study-plans', studyPlanRoutes);
router.use('/study-tasks', studyTaskRoutes);
router.use('/mind-maps', mindMapRoutes);

export default router;
