import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const rateLimitHandler = (_req, _res, next) => {
  next(ApiError.tooManyRequests('Too many requests, please try again later'));
};

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: 'Too many requests, please try again later',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: 'Too many authentication attempts, please try again later',
  },
});

export default globalRateLimiter;
