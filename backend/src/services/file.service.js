import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cloudinaryClient } from '../config/cloudinary.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FileService {
  static async uploadImage(filePath, folder = 'mindsync/profiles') {
    if (!cloudinaryClient) {
      logger.warn('Cloudinary not configured; skipping image upload');
      return null;
    }

    try {
      const result = await cloudinaryClient.uploader.upload(filePath, {
        folder,
        use_filename: true,
        unique_filename: true,
      });

      // Clean up the local file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
      return result.secure_url;
    } catch (error) {
      logger.error('Cloudinary upload failed', { error: error.message });
      
      // Clean up the local file even if upload fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw error;
    }
  }

  static extractPublicIdFromUrl(imageUrl) {
    if (!imageUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(imageUrl);
      const pathSegments = parsedUrl.pathname.split('/');
      const uploadIndex = pathSegments.findIndex((segment) => segment === 'upload');

      if (uploadIndex === -1 || uploadIndex === pathSegments.length - 1) {
        return null;
      }

      const publicIdSegments = pathSegments.slice(uploadIndex + 1);

      if (publicIdSegments[0] && /^v\d+$/.test(publicIdSegments[0])) {
        publicIdSegments.shift();
      }

      const publicIdWithExtension = publicIdSegments.join('/');
      const extensionIndex = publicIdWithExtension.lastIndexOf('.');
      return extensionIndex === -1
        ? publicIdWithExtension
        : publicIdWithExtension.substring(0, extensionIndex);
    } catch (error) {
      logger.warn('Unable to extract Cloudinary public ID from URL', { imageUrl, error: error.message });
      return null;
    }
  }

  static async deleteImage(publicId) {
    if (!cloudinaryClient) {
      logger.warn('Cloudinary is not configured; skipping image deletion');
      return;
    }

    if (!publicId) {
      return;
    }

    try {
      await cloudinaryClient.uploader.destroy(publicId);
      logger.info(`Image deleted from Cloudinary: ${publicId}`);
    } catch (error) {
      logger.error('Cloudinary delete failed', { error: error.message });
    }
  }
}

export default FileService;
