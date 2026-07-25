
import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/role.middleware.js';
import { ROLES } from '../../constants/index.js';
import dashboardController from '../../controllers/dashboard.controller.js';
import adminController from '../../controllers/admin.controller.js';
import adminAnalyticsController from '../../controllers/adminAnalytics.controller.js';
import adminReportsController from '../../controllers/adminReports.controller.js';
import adminNotificationController from '../../controllers/adminNotification.controller.js';
import adminSettingsController from '../../controllers/adminSettings.controller.js';
import adminLogsController from '../../controllers/adminLogs.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(protect, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getStats);

// Notification routes
router.get('/notifications', adminNotificationController.getNotifications);
router.get('/notifications/stats', adminNotificationController.getStats);
router.get('/notifications/:id', adminNotificationController.getNotificationById);
router.patch('/notifications/read-all', adminNotificationController.markAllAsRead);
router.patch('/notifications/read/:id', adminNotificationController.markAsRead);
router.patch('/notifications/unread/:id', adminNotificationController.markAsUnread);
router.delete('/notifications/:id', adminNotificationController.deleteNotification);
router.post('/notifications/broadcast', adminNotificationController.broadcastAnnouncement);

// Reports routes
router.get('/reports/data', adminReportsController.getReportData);

// Settings routes
router.get('/settings/config', adminSettingsController.getSettingsConfig);

// Logs / Audit routes
router.get('/logs/activity', adminLogsController.getActivityLogs);
router.get('/logs/logins', adminLogsController.getLoginLogs);
router.get('/logs/sessions', adminLogsController.getActiveSessions);
router.get('/logs/export', adminLogsController.exportAuditLogs);

// Analytics routes
router.get('/analytics/overview', adminAnalyticsController.getOverview);
router.get('/analytics/users', adminAnalyticsController.getUsers);
router.get('/analytics/logins', adminAnalyticsController.getLogins);
router.get('/analytics/providers', adminAnalyticsController.getProviders);
router.get('/analytics/devices', adminAnalyticsController.getDevices);
router.get('/analytics/browsers', adminAnalyticsController.getBrowsers);
router.get('/analytics/os', adminAnalyticsController.getOS);
router.get('/analytics/registrations', adminAnalyticsController.getRegistrations);

// User Management routes
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/verify', adminController.updateUserVerify);
router.patch('/users/:id/role', adminController.updateUserRole);
router.post('/users/bulk-action', adminController.bulkAction);

export default router;
