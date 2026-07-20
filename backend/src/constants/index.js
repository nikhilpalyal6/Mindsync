export { ROLES, ROLE_HIERARCHY, DEFAULT_ROLE, ALL_ROLES } from './roles.js';
export { HTTP_STATUS } from './httpStatus.js';

export const AUTH_PROVIDERS = Object.freeze({
  LOCAL: 'local',
  GOOGLE: 'google',
  APPLE: 'apple',
  GITHUB: 'github',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

export const API_VERSION = 'v1';

export const COOKIE_NAMES = Object.freeze({
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
});
