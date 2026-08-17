import { HTTP_STATUS } from '../constants/httpStatus.js';

export const requestTimeout = (timeoutMs = 15000) => {
  return (req, res, next) => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.SERVICE_UNAVAILABLE || 503).json({
          success: false,
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE || 503,
          message: 'Database temporarily unavailable'
        });
      }
    });
    next();
  };
};
