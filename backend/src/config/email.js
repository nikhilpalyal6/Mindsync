import nodemailer from 'nodemailer';
import config from './index.js';
import logger from './logger.js';

/**
 * Nodemailer configuration (Phase 1 — prepare only).
 * Email sending features will be implemented in a later phase.
 */
const createEmailTransporter = () => {
  if (!config.email.isConfigured) {
    logger.warn('Email service is not configured. Email features will be unavailable.');
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });

  logger.info('Email transporter configured successfully');
  return transporter;
};

export const emailTransporter = createEmailTransporter();

/**
 * Verify email connection (call when email features are enabled).
 */
export const verifyEmailConnection = async () => {
  if (!emailTransporter) {
    return false;
  }

  try {
    await emailTransporter.verify();
    logger.info('Email connection verified');
    return true;
  } catch (error) {
    logger.error('Email connection verification failed', { error: error.message });
    return false;
  }
};

export default emailTransporter;
