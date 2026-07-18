import User from '../models/user.model.js';
import TokenService from './token.service.js';
import EmailService, { generateSecureToken } from './email.service.js';
import { validatePasswordStrength } from '../utils/password.utils.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';

class AuthService {
  static async register(userData) {
    const { name, username, email, password } = userData;

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      throw ApiError.badRequest('Password does not meet strength requirements', {
        errors: passwordCheck.errors,
      });
    }

    const existingUserEmail = await User.findByEmail(email);
    if (existingUserEmail) {
      throw ApiError.badRequest('Email already in use');
    }

    const existingUserUsername = await User.findByUsername(username);
    if (existingUserUsername) {
      throw ApiError.badRequest('Username already in use');
    }

    const user = await User.create({
      name,
      username,
      email,
      password,
    });

    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashPassword(verificationToken);
    await user.setEmailVerificationToken(hashedVerificationToken);

    await EmailService.sendVerificationEmail(user, verificationToken);

    logger.info(`User registered successfully: ${user.email}`);

    return {
      user,
    };
  }

  static async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    if (user.isAccountLocked()) {
      throw ApiError.forbidden('Account locked due to too many failed login attempts. Please try again later.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementFailedLoginAttempts();
      logger.warn(`Failed login attempt for ${email}`);
      throw ApiError.unauthorized('Invalid credentials');
    }

    await user.resetFailedLoginAttempts();
    await user.updateLastLogin();

    const tokens = await TokenService.generateAndStoreTokens(user);

    logger.info(`User logged in successfully: ${user.email}`);

    return {
      user,
      tokens,
    };
  }

  static async logout(userId) {
    await TokenService.logout(userId);
    logger.info(`User logged out: ${userId}`);
  }

  static async refreshAccessToken(refreshToken) {
    const tokens = await TokenService.refreshAccessToken(refreshToken);
    logger.info(`Access token refreshed`);
    return tokens;
  }

  static async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      throw ApiError.badRequest('New password does not meet strength requirements', {
        errors: passwordCheck.errors,
      });
    }

    await user.setPassword(newPassword);
    await user.clearRefreshToken();

    logger.info(`Password changed successfully for user: ${user.email}`);
  }

  static async forgotPassword(email) {
    const user = await User.findByEmail(email);

    if (user && user.isActive) {
      const resetToken = generateSecureToken();
      const hashedResetToken = await hashPassword(resetToken);
      await user.setPasswordResetToken(hashedResetToken);
      await EmailService.sendPasswordResetEmail(user, resetToken);
      logger.info(`Password reset email sent to ${email}`);
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  static async resetPassword(token, newPassword) {
    const users = await User.find().select('+passwordResetToken +passwordResetExpires');
    let user = null;
    for (const u of users) {
      if (!u.passwordResetToken || !u.passwordResetExpires) continue;
      const isTokenValid = await comparePassword(token, u.passwordResetToken);
      if (isTokenValid && u.passwordResetExpires > Date.now()) {
        user = u;
        break;
      }
    }

    if (!user) {
      throw ApiError.badRequest('Invalid or expired password reset token');
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      throw ApiError.badRequest('New password does not meet strength requirements', {
        errors: passwordCheck.errors,
      });
    }

    await user.setPassword(newPassword);
    await user.clearRefreshToken();
    logger.info(`Password reset successfully for user: ${user.email}`);
  }

  static async verifyEmail(token) {
    const users = await User.find().select('+emailVerificationToken +emailVerificationExpires');
    let user = null;
    for (const u of users) {
      if (!u.emailVerificationToken || !u.emailVerificationExpires) continue;
      const isTokenValid = await comparePassword(token, u.emailVerificationToken);
      if (isTokenValid && u.emailVerificationExpires > Date.now()) {
        user = u;
        break;
      }
    }

    if (!user) {
      throw ApiError.badRequest('Invalid or expired email verification token');
    }

    await user.markEmailVerified();
    logger.info(`Email verified successfully for user: ${user.email}`);
  }

  static async resendVerificationEmail(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.isVerified) {
      throw ApiError.badRequest('Email already verified');
    }

    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashPassword(verificationToken);
    await user.setEmailVerificationToken(hashedVerificationToken);

    await EmailService.sendVerificationEmail(user, verificationToken);

    logger.info(`Verification email resent to ${user.email}`);
  }

  static async updateProfile(userId, updateData) {
    const { name, username, bio } = updateData;
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (username && username !== user.username) {
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        throw ApiError.badRequest('Username already in use');
      }
      user.username = username;
    }

    await user.save();
    logger.info(`Profile updated successfully for user: ${user.email}`);

    return user;
  }

  static async softDeleteAccount(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    await user.softDelete();
    await user.clearRefreshToken();

    logger.info(`Account soft deleted: ${userId}`);
  }
}

export default AuthService;
