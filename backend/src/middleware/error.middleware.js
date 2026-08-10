import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { logEvent } from '../utils/auditLogger.js';

const sanitizeErrorMessage = (message) => {
  if (config.isProduction) {
    return 'An unexpected error occurred';
  }
  return message;
};

const handleMongooseValidationError = (error) => {
  const errors = Object.values(error.errors).map((err) => ({
    field: err.path,
    message: err.message,
  }));

  return ApiError.badRequest('Validation failed', errors);
};

const handleMongooseDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];

  return ApiError.conflict(`${field.charAt(0).toUpperCase() + field.slice(1)} "${value}" already exists`);
};

const handleMongooseCastError = (error) =>
  ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);

const handleJWTError = () => ApiError.unauthorized('Invalid token');

const handleJWTExpiredError = () => ApiError.unauthorized('Token expired');

/**
 * Global error handler — returns consistent JSON error responses.
 * Never exposes stack traces in production.
 */
export const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.name === 'ValidationError') {
      error = handleMongooseValidationError(error);
    } else if (error.code === 11000) {
      error = handleMongooseDuplicateKeyError(error);
    } else if (error.name === 'CastError') {
      error = handleMongooseCastError(error);
    } else if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    } else if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    } else {
      logger.error('Unhandled error', {
        message: error.message,
        stack: error.stack,
        path: req.originalUrl,
        method: req.method,
      });
      error = ApiError.internal(sanitizeErrorMessage(error.message));
    }
  }

  if (error.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error('Server error', {
      message: error.message,
      stack: config.isDevelopment ? error.stack : undefined,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Log Security Events to AuditLog
  try {
    let securityAction = null;
    let securityDesc = null;

    if (err.name === 'JsonWebTokenError') {
      securityAction = 'Invalid JWT';
      securityDesc = `Client transmitted an invalid token signature on path ${req.originalUrl}`;
    } else if (err.name === 'TokenExpiredError') {
      securityAction = 'Expired JWT';
      securityDesc = `Client transmitted an expired session token on path ${req.originalUrl}`;
    } else if (error.statusCode === 401) {
      securityAction = 'Unauthorized Access';
      securityDesc = `Blocked unauthorized access attempt on path ${req.originalUrl} (${error.message})`;
    } else if (error.statusCode === 403) {
      securityAction = 'Forbidden Access';
      securityDesc = `Blocked forbidden access attempt on path ${req.originalUrl} (${error.message})`;
    } else if (error.statusCode === 429) {
      securityAction = 'Rate Limit Trigger';
      securityDesc = `Rate limiting threshold exceeded on path ${req.originalUrl}`;
    }

    if (securityAction) {
      logEvent({
        category: 'security_event',
        action: securityAction,
        description: securityDesc,
        status: 'failure',
        req,
        metadata: { path: req.originalUrl, method: req.method, errorMessage: error.message }
      });
    }
  } catch (logErr) {
    // Prevent failure in audit logger from crashing server response
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
  };

  if (error.code) {
    response.code = error.code;
  }

  if (error.errors?.length > 0) {
    response.errors = error.errors;
  }

  if (config.isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

export default errorHandler;
