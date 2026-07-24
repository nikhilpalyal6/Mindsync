import User from '../models/user.model.js';
import Session from '../models/session.model.js';
import ApiError from '../utils/ApiError.js';
import {
  generateTokenPair,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
} from '../utils/token.utils.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';
import { parseUserAgent } from '../utils/userAgent.utils.js';
import config from '../config/index.js';

class TokenService {
  static buildTokenPayload(user) {
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };
  }

  static async generateAndStoreTokens(user, options = {}) {
    const { rememberMe = false, userAgent, ipAddress, currentRefreshToken } = options;
    const payload = this.buildTokenPayload(user);
    const tokens = generateTokenPair(payload);

    // Delete old session if currentRefreshToken is provided
    if (currentRefreshToken) {
      const hashedCurrentToken = await hashPassword(currentRefreshToken);
      await Session.findOneAndDelete({ userId: user._id, refreshToken: hashedCurrentToken });
    }

    const hashedRefreshToken = await hashPassword(tokens.refreshToken);
    const tokenExpiry = getTokenExpiry(tokens.refreshToken);
    const uaInfo = parseUserAgent(userAgent);

    await Session.create({
      userId: user._id,
      refreshToken: hashedRefreshToken,
      userAgent,
      ipAddress,
      browser: uaInfo.browser,
      os: uaInfo.os,
      device: uaInfo.device,
      isCurrent: true,
      expiresAt: tokenExpiry,
    });

    // Set isCurrent to false for other sessions of the same user
    await Session.updateMany(
      { userId: user._id, refreshToken: { $ne: hashedRefreshToken } },
      { isCurrent: false }
    );

    // Also keep the old behavior for backward compatibility
    await user.storeRefreshToken(hashedRefreshToken);

    return tokens;
  }

  static async refreshAccessToken(refreshToken, options = {}) {
    const { userAgent, ipAddress } = options;
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive || user.isDeleted) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Find the session with the refresh token
    const sessions = await Session.find({ userId: user._id });
    let validSession = null;

    for (const session of sessions) {
      const isValid = await comparePassword(refreshToken, session.refreshToken);
      if (isValid) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      // Fall back to old behavior for backward compatibility
      const userWithToken = await User.findById(decoded.id).select('+refreshToken');
      if (userWithToken && userWithToken.refreshToken) {
        const isValidOld = await comparePassword(refreshToken, userWithToken.refreshToken);
        if (isValidOld) {
          return this.generateAndStoreTokens(user, { userAgent, ipAddress });
        }
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Generate new tokens
    return this.generateAndStoreTokens(user, {
      userAgent,
      ipAddress,
      currentRefreshToken: refreshToken,
    });
  }

  static async logout(userId, refreshToken) {
    if (refreshToken) {
      const sessions = await Session.find({ userId });
      for (const session of sessions) {
        const isValid = await comparePassword(refreshToken, session.refreshToken);
        if (isValid) {
          await Session.findByIdAndDelete(session._id);
          break;
        }
      }
    } else {
      // Logout all sessions if no refresh token provided
      await Session.deleteMany({ userId });
    }

    const user = await User.findById(userId);
    if (user) {
      await user.clearRefreshToken();
    }
  }

  static async logoutAllSessions(userId, excludeCurrentToken = null) {
    if (excludeCurrentToken) {
      const sessions = await Session.find({ userId });
      for (const session of sessions) {
        const isValid = await comparePassword(excludeCurrentToken, session.refreshToken);
        if (!isValid) {
          await Session.findByIdAndDelete(session._id);
        }
      }
    } else {
      await Session.deleteMany({ userId });
    }

    const user = await User.findById(userId);
    if (user) {
      await user.clearRefreshToken();
    }
  }

  static async getSessions(userId) {
    return await Session.find({ userId }).sort({ createdAt: -1 });
  }

  static async logoutSession(userId, sessionId) {
    const session = await Session.findOne({ _id: sessionId, userId });
    if (session) {
      await Session.findByIdAndDelete(sessionId);
    }
  }
}

export default TokenService;
