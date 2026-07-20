import crypto from 'crypto';
import logger from '../config/logger.js';
import config from '../config/index.js';
import { emailTransporter } from '../config/email.js';

export const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

class EmailService {
  static async sendEmail({ to, subject, html, text }) {
    if (!emailTransporter) {
      logger.warn('Email not sent: Email service not configured');
      return false;
    }

    try {
      await emailTransporter.sendMail({
        from: `"${config.app.name}" <${config.email.user}>`,
        to,
        subject,
        text,
        html,
      });

      logger.info(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${to}`, { error: error.message });
      return false;
    }
  }

  static async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${config.clientUrl}/verify-email/${verificationToken}`;
    const subject = `Verify your ${config.app.name} account`;
    const html = `
      <h1>Welcome to ${config.app.name}!</h1>
      <p>Hi ${user.name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create this account, please ignore this email.</p>
    `;
    const text = `Welcome to ${config.app.name}!\n\nHi ${user.name},\n\nPlease verify your email address by visiting the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create this account, please ignore this email.`;

    return this.sendEmail({ to: user.email, subject, html, text });
  }

  static async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.clientUrl}/reset-password/${resetToken}`;
    const subject = `Reset your ${config.app.name} password`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. Click the link below to choose a new password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
    `;
    const text = `Password Reset Request\n\nHi ${user.name},\n\nWe received a request to reset your password. Please visit the link below to choose a new password:\n${resetUrl}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request a password reset, please ignore this email or contact support if you have concerns.`;

    return this.sendEmail({ to: user.email, subject, html, text });
  }
}

export default EmailService;
