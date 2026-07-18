import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/token.utils.js';
import { getAccessTokenFromRequest } from '../utils/cookie.utils.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Protects routes by verifying JWT access token.
 * Attaches authenticated user to req.user.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = getAccessTokenFromRequest(req);

  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const decoded = verifyAccessToken(token);

  const user = await User.findById(decoded.id).select('-password -refreshToken');

  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated');
  }

  req.user = user;
  next();
});

/**
 * Optional authentication — attaches user if token is valid, continues otherwise.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = getAccessTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (user?.isActive) {
      req.user = user;
    }
  } catch {
    // Invalid token — continue as unauthenticated
  }

  next();
});

export default protect;
