import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import ApiError from './ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const generateAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpire,
  });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  });

export const generateTokenPair = (payload) => ({
  accessToken: generateAccessToken(payload),
  refreshToken: generateRefreshToken(payload),
});

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token expired');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

export const decodeToken = (token) => jwt.decode(token);

export const getTokenExpiry = (token) => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
};

export const sendTokenResponse = (res, tokens, statusCode = HTTP_STATUS.OK) => {
  res.status(statusCode).json({
    success: true,
    statusCode,
    message: 'Authentication successful',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
};
