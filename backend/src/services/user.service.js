
import User from '../models/user.model.js';
import NotificationPreferences from '../models/notificationPreferences.model.js';
import UserPreferences from '../models/userPreferences.model.js';
import Activity from '../models/activity.model.js';
import LoginHistory from '../models/loginHistory.model.js';
import Session from '../models/session.model.js';
import ApiError from '../utils/ApiError.js';
import { parseUserAgent } from '../utils/userAgent.utils.js';
import FileService from './file.service.js';
import TokenService from './token.service.js';

class UserService {
  static async getOrCreateNotificationPreferences(userId) {
    let prefs = await NotificationPreferences.findOne({ userId });
    if (!prefs) {
      prefs = await NotificationPreferences.create({ userId });
    }
    return prefs;
  }

  static async updateNotificationPreferences(userId, updates) {
    const prefs = await NotificationPreferences.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    return prefs;
  }

  static async getOrCreateUserPreferences(userId) {
    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      prefs = await UserPreferences.create({ userId });
    }
    return prefs;
  }

  static async updateUserPreferences(userId, updates) {
    const prefs = await UserPreferences.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    return prefs;
  }

  static async logActivity(userId, action, details = {}, options = {}) {
    const { userAgent, ipAddress } = options;
    const uaInfo = parseUserAgent(userAgent);
    return await Activity.create({
      userId,
      action,
      details,
      ipAddress,
      userAgent,
      browser: uaInfo.browser,
      os: uaInfo.os,
      device: uaInfo.device,
    });
  }

  static async logLoginHistory(userId, success, options = {}) {
    const { userAgent, ipAddress, provider = 'local', failureReason = null } = options;
    const uaInfo = parseUserAgent(userAgent);
    return await LoginHistory.create({
      userId,
      userAgent,
      ipAddress,
      browser: uaInfo.browser,
      os: uaInfo.os,
      device: uaInfo.device,
      provider,
      success,
      failureReason,
    });
  }

  static async getActivities(userId, limit = 20, offset = 0) {
    return await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
  }

  static async getLoginHistory(userId, limit = 20, offset = 0) {
    return await LoginHistory.find({ userId })
      .sort({ loginTime: -1 })
      .skip(offset)
      .limit(limit);
  }

  static async clearLoginHistory(userId) {
    return await LoginHistory.deleteMany({ userId });
  }

  static async deleteAccount(userId, confirmation, password = null) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Check confirmation
    if (user.provider === 'google') {
      if (confirmation !== 'DELETE') {
        throw ApiError.badRequest('Please type DELETE to confirm');
      }
    } else {
      // Local user - check password
      if (!password) {
        throw ApiError.badRequest('Password is required');
      }
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw ApiError.badRequest('Invalid password');
      }
    }

    // Delete Cloudinary profile image
    if (user.profileImage) {
      const publicId = FileService.extractPublicIdFromUrl(user.profileImage);
      if (publicId) {
        try {
          await FileService.deleteImage(publicId);
        } catch (error) {
          // Ignore error if deletion fails
        }
      }
    }

    // Delete all sessions
    await Session.deleteMany({ userId });

    // Soft delete user
    await user.softDelete(userId);

    // Log activity
    await this.logActivity(userId, 'account_deletion');

    return true;
  }
}

export default UserService;
