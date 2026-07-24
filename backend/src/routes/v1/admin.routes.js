
import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/role.middleware.js';
import { ROLES } from '../../constants/index.js';
import dashboardController from '../../controllers/dashboard.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(protect, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getStats);

export default router;
