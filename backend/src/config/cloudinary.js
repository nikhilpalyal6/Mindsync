import { v2 as cloudinary } from 'cloudinary';
import config from './index.js';
import logger from './logger.js';

/**
 * Cloudinary configuration (Phase 1 — prepare only).
 * Upload APIs will be implemented in a later phase.
 */
const configureCloudinary = () => {
  if (!config.cloudinary.isConfigured) {
    logger.warn('Cloudinary is not configured. File upload features will be unavailable.');
    return null;
  }

  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });

  logger.info('Cloudinary configured successfully');
  return cloudinary;
};

export const cloudinaryClient = configureCloudinary();
export default cloudinaryClient;
