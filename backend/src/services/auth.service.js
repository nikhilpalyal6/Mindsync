import User from '../models/user.model.js';
import TokenService from './token.service.js';
import EmailService, { generateSecureToken } from './email.service.js';
import FileService from './file.service.js';
import { validatePasswordStrength } from '../utils/password.utils.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/index.js';
import { AUTH_PROVIDERS } from '../constants/index.js';

const googleClient = config.google.isConfigured
  ? new OAuth2Client(config.google.clientId)
  : null;

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
      provider: AUTH_PROVIDERS.LOCAL,
      isVerified: false,
    });

    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashPassword(verificationToken);
    await user.setEmailVerificationToken(hashedVerificationToken);

    try {
      await EmailService.sendVerificationEmail(user, verificationToken);
    } catch (error) {
      logger.error('Email verification send failed during registration', { error: error.message });
      await user.deleteOne();
      throw ApiError.internal('Unable to send verification email. Please check SMTP credentials in .env and try again.');
    }

    const tokens = await TokenService.generateAndStoreTokens(user);

    logger.info(`User registered successfully: ${user.email}`);

    return {
      user,
      tokens,
    };
  }

  static async login(identifier, password) {
    const user = await User.findByEmailOrUsername(identifier).select('+password');

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
      logger.warn(`Failed login attempt for ${identifier}`);
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

  static async changePassword(userId, currentPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      throw ApiError.badRequest('New password and confirm password do not match');
    }

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

      try {
        await EmailService.sendPasswordResetEmail(user, resetToken);
        logger.info(`Password reset email sent to ${email}`);
      } catch (error) {
        logger.error('Password reset email failed', { error: error.message, email });
        await user.clearPasswordResetToken();
        throw ApiError.internal('Unable to send password reset email. Please check SMTP credentials in .env and try again.');
      }
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  static async resetPassword(token, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      throw ApiError.badRequest('New password and confirm password do not match');
    }

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
    await user.clearPasswordResetToken(); // Added to clear token from DB
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

    try {
      await EmailService.sendVerificationEmail(user, verificationToken);
      logger.info(`Verification email resent to ${user.email}`);
    } catch (error) {
      logger.error('Failed to resend verification email', { error: error.message, email: user.email });
      throw ApiError.internal('Unable to resend verification email. Please check SMTP credentials in .env and try again.');
    }
  }

  static async updateProfile(userId, updateData, file) {
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

    const previousProfileImage = user.profileImage;

    if (file) {
      const imageUrl = await FileService.uploadImage(file.path);
      if (imageUrl) {
        user.profileImage = imageUrl;

        const oldPublicId = FileService.extractPublicIdFromUrl(previousProfileImage);
        if (oldPublicId) {
          await FileService.deleteImage(oldPublicId);
        }
      }
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

  static async googleAuth(idToken) {
    if (!config.google.isConfigured || !googleClient) {
      throw ApiError.badRequest('Google OAuth is not configured');
    }

    if (!idToken) {
      throw ApiError.badRequest('Google ID token is required');
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.email || !payload.sub) {
        throw ApiError.badRequest('Invalid Google ID token');
      }

      const googleId = payload.sub;
      const email = payload.email.toLowerCase();
      const name = payload.name || payload.given_name || email.split('@')[0];
      const avatar = payload.picture || null;

      let user = await User.findOne({ $or: [{ googleId }, { email }] });

      if (!user) {
        let username = email.split('@')[0];
        let existingUser = await User.findByUsername(username);
        let counter = 1;
        while (existingUser) {
          username = `${email.split('@')[0]}${counter}`;
          existingUser = await User.findByUsername(username);
          counter++;
        }

        user = await User.create({
          name,
          username,
          email,
          googleId,
          provider: AUTH_PROVIDERS.GOOGLE,
          avatar,
          profileImage: avatar,
          isVerified: true,
          password: generateSecureToken(),
        });
        logger.info(`New user registered via Google: ${user.email}`);
      } else {
        const updates = {};

        if (!user.googleId) {
          updates.googleId = googleId;
        }
        if (user.provider !== AUTH_PROVIDERS.GOOGLE) {
          updates.provider = AUTH_PROVIDERS.GOOGLE;
        }
        if (!user.avatar && avatar) {
          updates.avatar = avatar;
        }
        if (!user.profileImage && avatar) {
          updates.profileImage = avatar;
        }
        if (!user.isVerified) {
          updates.isVerified = true;
        }

        if (Object.keys(updates).length > 0) {
          Object.assign(user, updates);
          await user.save({ validateBeforeSave: false });
        }

        logger.info(`Linked Google account to existing user: ${user.email}`);
      }

      await user.updateLastLogin();
      const authTokens = await TokenService.generateAndStoreTokens(user);
      return { user, tokens: authTokens };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.warn(`Google ID token verification failed: ${error.message}`);
      throw ApiError.badRequest('Invalid Google ID token');
    }
  }

}

export default AuthService;
