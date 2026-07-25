import config from '../config/index.js';
import mongoose from 'mongoose';

class AdminSettingsService {
  async getSettingsConfig() {
    // Collect server states dynamically
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const uptime = process.uptime();
    const serverTime = new Date().toISOString();

    return {
      general: {
        appName: config.app.name || 'MindSync',
        version: config.app.version || '1.0.0',
        environment: config.env || 'development',
        apiVersion: 'v1',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        defaultLanguage: 'en'
      },
      authentication: {
        jwtStatus: 'Enabled',
        googleLoginStatus: config.google.isConfigured ? 'Enabled' : 'Disabled',
        emailVerificationStatus: config.email.isConfigured ? 'Enabled' : 'Disabled',
        passwordResetStatus: 'Enabled',
        rememberMeStatus: 'Enabled'
      },
      registration: {
        registrationEnabled: 'Enabled',
        emailVerificationRequired: 'Enabled',
        defaultUserRole: 'USER'
      },
      emailService: {
        provider: config.email.host || 'Not Configured',
        smtpStatus: config.email.isConfigured ? 'Active' : 'Inactive',
        lastConnectionCheck: serverTime
      },
      cloudinary: {
        configurationStatus: config.cloudinary.isConfigured ? 'Configured' : 'Not Configured',
        uploadServiceStatus: config.cloudinary.isConfigured ? 'Active' : 'Inactive'
      },
      security: {
        helmetEnabled: 'Enabled',
        rateLimiterEnabled: 'Enabled',
        secureCookies: config.cookie.secure ? 'Enabled' : 'Disabled',
        jwtEnabled: 'Enabled',
        mongoProtection: 'Enabled'
      },
      system: {
        serverVersion: config.app.version || '1.0.0',
        nodeEnvironment: config.env || 'development',
        currentServerTime: serverTime,
        serverUptime: uptime,
        apiVersion: 'v1'
      },
      integrations: {
        googleOAuth: config.google.isConfigured ? 'Connected' : 'Disconnected',
        cloudinary: config.cloudinary.isConfigured ? 'Connected' : 'Disconnected',
        nodemailer: config.email.isConfigured ? 'Connected' : 'Disconnected',
        mongodbAtlas: dbStatus
      }
    };
  }
}

export default new AdminSettingsService();
