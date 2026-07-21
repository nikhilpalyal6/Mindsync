import config from '../config/index.js';
import { COOKIE_NAMES } from '../constants/index.js';

export const setAuthCookies = (res, tokens) => {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAge.access,
  });

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAge.refresh,
    path: '/api/v1/auth/refresh-token',
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  });

  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/api/v1/auth/refresh-token',
  });
};

export const getAccessTokenFromRequest = (req) =>
  req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ||
  req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
  null;

export const getRefreshTokenFromRequest = (req) =>
  req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ||
  req.body?.refreshToken ||
  null;
