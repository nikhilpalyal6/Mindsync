import { HTTP_STATUS } from '../constants/httpStatus.js';

export const requestTimeout = (timeoutMs = 15000) => {
  return (req, res, next) => {
    if (req.originalUrl && (req.originalUrl.includes('/extract') || req.originalUrl.includes('/relationships/extract'))) {
      const extractionTimeout = parseInt(process.env.AI_EXTRACTION_TIMEOUT_MS, 10) || 300000;
      try {
        res.setTimeout(extractionTimeout, () => {
          if (!res.headersSent) {
            res.status(HTTP_STATUS.SERVICE_UNAVAILABLE || 503).json({
              success: false,
              statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE || 503,
              message: 'Extraction timed out'
            });
          }
        });
      } catch (err) {
        if (err.message !== 'setTimeout should not be called') {
          throw err;
        }
      }
      return next();
    }
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.REQUEST_TIMEOUT || 408).json({
          success: false,
          statusCode: HTTP_STATUS.REQUEST_TIMEOUT || 408,
          message: 'Request timed out. Please try again.'
        });
      }
    });
    next();
  };
};
