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
      const error = new Error('Email service is not configured');
      logger.error(error.message);
      throw error;
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
      throw error;
    }
  }

  static async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${config.clientUrl}/verify-email/${verificationToken}`;
    const subject = `Verify your ${config.app.name} account`;
    const html = `
      <div style="font-family: 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, sans-serif; background:linear-gradient(135deg, #0a0f1a 0%, #07111b 100%); padding:40px 20px; color:#f5f7fa;">
        <div style="max-width:600px; margin:0 auto; background:linear-gradient(145deg, #121c28 0%, #0d1723 100%); border:1px solid rgba(255,255,255,0.1); border-radius:28px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Header with Logo -->
          <div style="background:linear-gradient(135deg, #66b8ff 0%, #48efb3 100%); padding:32px; text-align:center; position:relative;">
            <div style="font-size:32px; font-weight:900; letter-spacing:0.12em; color:#07111b; text-transform:uppercase;">MindSync</div>
            <div style="margin-top:8px; font-size:13px; font-weight:600; color:#07111b; opacity:0.8; letter-spacing:0.05em;">LEARN SMARTER • FOCUS BETTER</div>
          </div>

          <!-- Content -->
          <div style="padding:40px 32px;">
            <!-- Welcome Icon -->
            <div style="text-align:center; margin-bottom:24px;">
              <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; background:linear-gradient(135deg, rgba(102,184,255,0.2) 0%, rgba(72,239,179,0.2) 100%); border-radius:50%; border:2px solid rgba(102,184,255,0.3);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#gradient1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <defs>
                    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#66b8ff"/>
                      <stop offset="100%" style="stop-color:#48efb3"/>
                    </linearGradient>
                  </defs>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
            </div>

            <h1 style="margin:0 0 16px; font-size:26px; font-weight:700; color:#ffffff; text-align:center;">Welcome aboard, ${user.name}! 👋</h1>
            
            <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#cbd5e1; text-align:center;">
              Thanks for joining <strong style="color:#66b8ff;">MindSync</strong>. Please verify your email address to activate your account and unlock your personalized learning experience.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center; margin:32px 0;">
              <a href="${verificationUrl}" style="display:inline-block; padding:16px 40px; background:linear-gradient(135deg, #66b8ff 0%, #48efb3 100%); color:#07111b; text-decoration:none; border-radius:50px; font-weight:700; font-size:16px; box-shadow:0 8px 20px rgba(102,184,255,0.3); transition:all 0.3s ease;">
                ✓ Verify Email Address
              </a>
            </div>

            <!-- Divider -->
            <div style="height:1px; background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%); margin:24px 0;"></div>

            <!-- Fallback Link -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:20px;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#94a3b8; text-align:center;">Button not working? Copy and paste this link:</p>
              <p style="margin:0; word-break:break-all; font-size:12px; color:#66b8ff; text-align:center; font-family:monospace;">${verificationUrl}</p>
            </div>

            <!-- Info Messages -->
            <div style="display:flex; gap:16px; margin-top:24px;">
              <div style="flex:1; background:rgba(72,239,179,0.08); border:1px solid rgba(72,239,179,0.2); border-radius:10px; padding:12px; text-align:center;">
                <div style="font-size:20px; margin-bottom:4px;">⏰</div>
                <div style="font-size:12px; color:#48efb3; font-weight:600;">Expires in 24 hours</div>
              </div>
              <div style="flex:1; background:rgba(102,184,255,0.08); border:1px solid rgba(102,184,255,0.2); border-radius:10px; padding:12px; text-align:center;">
                <div style="font-size:20px; margin-bottom:4px;">🔒</div>
                <div style="font-size:12px; color:#66b8ff; font-weight:600;">Secure verification</div>
              </div>
            </div>

            <p style="margin:24px 0 0; font-size:13px; color:#64748b; text-align:center; line-height:1.6;">
              If you did not create this account, you can safely ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:rgba(0,0,0,0.2); padding:20px 32px; text-align:center; border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0 0 8px; font-size:12px; color:#94a3b8;">Need help? Contact our support team</p>
            <p style="margin:0; font-size:11px; color:#64748b;">© ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;
    const text = `Welcome to ${config.app.name}!\n\nHi ${user.name},\n\nThanks for joining MindSync! Please verify your email address by visiting the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create this account, please ignore this email.\n\nNeed help? Contact our support team.`;

    return this.sendEmail({ to: user.email, subject, html, text });
  }

  static async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.clientUrl}/reset-password/${resetToken}`;
    const subject = `Reset your ${config.app.name} password`;
    const html = `
      <div style="font-family: 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, sans-serif; background:linear-gradient(135deg, #0a0f1a 0%, #07111b 100%); padding:40px 20px; color:#f5f7fa;">
        <div style="max-width:600px; margin:0 auto; background:linear-gradient(145deg, #121c28 0%, #0d1723 100%); border:1px solid rgba(255,255,255,0.1); border-radius:28px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Header with Logo -->
          <div style="background:linear-gradient(135deg, #66b8ff 0%, #48efb3 100%); padding:32px; text-align:center; position:relative;">
            <div style="font-size:32px; font-weight:900; letter-spacing:0.12em; color:#07111b; text-transform:uppercase;">MindSync</div>
            <div style="margin-top:8px; font-size:13px; font-weight:600; color:#07111b; opacity:0.8; letter-spacing:0.05em;">LEARN SMARTER • FOCUS BETTER</div>
          </div>

          <!-- Content -->
          <div style="padding:40px 32px;">
            <!-- Security Icon -->
            <div style="text-align:center; margin-bottom:24px;">
              <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; background:linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(251,146,60,0.2) 100%); border-radius:50%; border:2px solid rgba(239,68,68,0.3);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#gradient2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <defs>
                    <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#ef4444"/>
                      <stop offset="100%" style="stop-color:#fb923c"/>
                    </linearGradient>
                  </defs>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
            </div>

            <h1 style="margin:0 0 16px; font-size:26px; font-weight:700; color:#ffffff; text-align:center;">Reset Your Password 🔐</h1>
            
            <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#cbd5e1; text-align:center;">
              We received a request to reset the password for your <strong style="color:#66b8ff;">MindSync</strong> account. Click the button below to create a new secure password.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center; margin:32px 0;">
              <a href="${resetUrl}" style="display:inline-block; padding:16px 40px; background:linear-gradient(135deg, #66b8ff 0%, #48efb3 100%); color:#07111b; text-decoration:none; border-radius:50px; font-weight:700; font-size:16px; box-shadow:0 8px 20px rgba(102,184,255,0.3); transition:all 0.3s ease;">
                🔑 Reset Password
              </a>
            </div>

            <!-- Divider -->
            <div style="height:1px; background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%); margin:24px 0;"></div>

            <!-- Fallback Link -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:20px;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#94a3b8; text-align:center;">Button not working? Copy and paste this link:</p>
              <p style="margin:0; word-break:break-all; font-size:12px; color:#66b8ff; text-align:center; font-family:monospace;">${resetUrl}</p>
            </div>

            <!-- Security Warning -->
            <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:16px; margin-bottom:20px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:24px;">⚠️</div>
                <div>
                  <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:#ef4444;">Security Notice</p>
                  <p style="margin:0; font-size:12px; color:#fca5a5; line-height:1.5;">For your security, do not share this email or link with anyone. MindSync will never ask for your password via email.</p>
                </div>
              </div>
            </div>

            <!-- Info Messages -->
            <div style="display:flex; gap:16px; margin-top:24px;">
              <div style="flex:1; background:rgba(251,146,60,0.08); border:1px solid rgba(251,146,60,0.2); border-radius:10px; padding:12px; text-align:center;">
                <div style="font-size:20px; margin-bottom:4px;">⏰</div>
                <div style="font-size:12px; color:#fb923c; font-weight:600;">Expires in 15 minutes</div>
              </div>
              <div style="flex:1; background:rgba(102,184,255,0.08); border:1px solid rgba(102,184,255,0.2); border-radius:10px; padding:12px; text-align:center;">
                <div style="font-size:20px; margin-bottom:4px;">🔒</div>
                <div style="font-size:12px; color:#66b8ff; font-weight:600;">One-time use only</div>
              </div>
            </div>

            <p style="margin:24px 0 0; font-size:13px; color:#64748b; text-align:center; line-height:1.6;">
              If you did not request this password reset, you can safely ignore this email. Your account remains secure.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:rgba(0,0,0,0.2); padding:20px 32px; text-align:center; border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0 0 8px; font-size:12px; color:#94a3b8;">Need help? Contact our support team</p>
            <p style="margin:0; font-size:11px; color:#64748b;">© ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;
    const text = `Password Reset Request\n\nHi ${user.name},\n\nWe received a request to reset your password for your MindSync account. Please visit the link below to choose a new password:\n\n${resetUrl}\n\nThis link will expire in 15 minutes and can only be used once.\n\nFor your security, do not share this email with anyone. MindSync will never ask for your password via email.\n\nIf you didn't request a password reset, please ignore this email. Your account remains secure.\n\nNeed help? Contact our support team.`;

    return this.sendEmail({ to: user.email, subject, html, text });
  }
}

export default EmailService;
