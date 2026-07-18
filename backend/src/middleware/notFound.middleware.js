import ApiError from '../utils/ApiError.js';

/**
 * Handles requests to undefined routes.
 */
export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export default notFoundHandler;
