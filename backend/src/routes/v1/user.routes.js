
import { Router } from 'express';
import UserController from '../../controllers/user.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/notifications/preferences', UserController.getNotificationPreferences);
router.patch('/notifications/preferences', UserController.updateNotificationPreferences);
router.get('/notification-preferences', UserController.getNotificationPreferences);
router.patch('/notification-preferences', UserController.updateNotificationPreferences);
router.get('/preferences', UserController.getUserPreferences);
router.patch('/preferences', UserController.updateUserPreferences);
router.get('/activity', UserController.getRecentActivity);
router.get('/login-history', UserController.getLoginHistory);
router.delete('/login-history', UserController.clearLoginHistory);
router.get('/sessions', UserController.getDevices);
router.get('/devices', UserController.getDevices);
router.delete('/sessions/:sessionId', UserController.logoutDevice);
router.post('/devices/:sessionId/logout', UserController.logoutDevice);
router.delete('/sessions', UserController.logoutAllDevices);
router.post('/devices/logout-all', UserController.logoutAllDevices);
router.delete('/delete-account', UserController.deleteAccount);
router.delete('/account', UserController.deleteAccount);

export default router;
