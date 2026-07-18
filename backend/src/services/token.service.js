import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import {
  generateTokenPair,
  verifyRefreshToken,
} from '../utils/token.utils.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';

/**
 * Token service — handles JWT lifecycle and refresh token storage.
 * Auth routes will use these methods in a later phase.
 */
class TokenService {
  static buildTokenPayload(user) {
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };
  }

  static async generateAndStoreTokens(user) {
    const payload = this.buildTokenPayload(user);
    const tokens = generateTokenPair(payload);

    const hashedRefreshToken = await hashPassword(tokens.refreshToken);
    await user.storeRefreshToken(hashedRefreshToken);

    return tokens;
  }

  static async refreshAccessToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const isValid = await comparePassword(refreshToken, user.refreshToken);

    if (!isValid) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    return this.generateAndStoreTokens(user);
  }

  static async logout(userId) {
    const user = await User.findById(userId);

    if (user) {
      await user.clearRefreshToken();
    }
  }

  static async logoutAllSessions(userId) {
    await this.logout(userId);
  }
}

export default TokenService;
