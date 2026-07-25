import { logEvent } from '../utils/auditLogger.js';

export const auditLogMiddleware = (req, res, next) => {
  res.on('finish', () => {
    // Only log successful operations in this middleware (failures are caught in error middleware)
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    const { method, originalUrl } = req;
    const url = originalUrl.split('?')[0]; // Strip query parameters

    let category = null;
    let action = null;
    let description = null;

    // 1. Authentication routes
    if (url.startsWith('/api/v1/auth')) {
      category = 'authentication';
      if (url.includes('/login') && method === 'POST') {
        action = 'Login';
        description = 'User logged in successfully.';
      } else if (url.includes('/google') && method === 'POST') {
        action = 'Google Login';
        description = 'User logged in using Google OAuth.';
      } else if (url.includes('/logout') && method === 'POST') {
        action = 'Logout';
        description = 'User logged out and session revoked.';
      } else if (url.includes('/forgot-password') && method === 'POST') {
        action = 'Password Reset Requested';
        description = 'User requested password reset link.';
      } else if (url.includes('/reset-password') && method === 'POST') {
        action = 'Password Reset Completed';
        description = 'User reset their password successfully.';
      } else if (url.includes('/verify-email') && method === 'POST') {
        action = 'Email Verification';
        description = 'User verified their email address.';
      } else if (url.includes('/resend-verification') && method === 'POST') {
        action = 'Email Verification Resend';
        description = 'User requested verification email resend.';
      } else if (url.includes('/change-password') && method === 'POST') {
        action = 'Password Changed';
        description = 'User changed password successfully.';
      }
    }

    // 2. User Action routes
    else if (url.startsWith('/api/v1/users') || url.startsWith('/api/v1/profile')) {
      category = 'user_action';
      if (url.endsWith('/profile') && method === 'PUT') {
        action = 'Profile Updated';
        description = 'User updated profile information.';
      } else if (url.includes('/profile/image') && (method === 'POST' || method === 'PUT')) {
        action = 'Profile Image Updated';
        description = 'User updated profile picture.';
      } else if (url.includes('/username') && method === 'PUT') {
        action = 'Username Changed';
        description = 'User changed username.';
      } else if (url.includes('/preferences') && method === 'PUT') {
        action = 'Preferences Updated';
        description = 'User updated app preferences.';
      } else if (url.includes('/notifications') && method === 'PUT') {
        action = 'Notification Preferences Updated';
        description = 'User updated notification preferences.';
      } else if ((url.endsWith('/users') || url.endsWith('/account')) && method === 'DELETE') {
        action = 'Delete Account';
        description = 'User deleted account.';
      } else if (url.includes('/devices') && url.includes('/logout') && method === 'POST') {
        action = 'Session Revoked';
        description = 'User revoked active device session.';
      }
    }

    // 3. Admin Action routes
    else if (url.startsWith('/api/v1/admin')) {
      category = 'admin_action';
      if (url.includes('/dashboard/stats') && method === 'GET') {
        action = 'Dashboard Access';
        description = 'Administrator accessed the dashboard stats.';
      } else if (url.includes('/settings/config') && method === 'GET') {
        action = 'Settings Viewed';
        description = 'Administrator accessed settings console config.';
      } else if (url.includes('/analytics/') && method === 'GET') {
        action = 'Analytics Viewed';
        description = `Administrator viewed analytics endpoint: ${url.replace('/api/v1/admin/analytics/', '')}`;
      } else if (url.includes('/reports/data') && method === 'GET') {
        action = 'Report Generated';
        description = 'Administrator generated system report.';
      } else if (url.endsWith('/users') && method === 'GET') {
        action = 'User Directory Viewed';
        description = 'Administrator viewed the active user list.';
      } else if (url.includes('/users/') && method === 'PUT') {
        action = 'User Updated';
        description = 'Administrator updated user details.';
      } else if (url.includes('/users/') && method === 'DELETE') {
        action = 'User Deleted';
        description = 'Administrator deleted user account.';
      } else if (url.includes('/users/') && url.includes('/status') && method === 'PATCH') {
        action = 'User Updated';
        description = 'Administrator toggled user active status.';
      } else if (url.includes('/users/') && url.includes('/role') && method === 'PATCH') {
        action = 'User Role Changed';
        description = 'Administrator changed user authorization role.';
      }
    }

    // Write log if matched
    if (category && action) {
      logEvent({
        category,
        action,
        description,
        req,
        status: 'success'
      });
    }
  });

  next();
};

export default auditLogMiddleware;
