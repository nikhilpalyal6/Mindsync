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

  static async deleteImage(publicId) {
    if (!cloudinaryClient) {
      logger.warn('Cloudinary not configured; skipping image deletion');
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
