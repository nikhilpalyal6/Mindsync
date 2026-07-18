import config from '../config/index.js';
import { getDBStatus } from '../database/connection.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @route   GET /api/v1/health
 * @desc    Health check endpoint
 * @access  Public
 */
export const getHealth = asyncHandler(async (_req, res) => {
  const dbStatus = getDBStatus();

  const healthData = {
    server: 'running',
    database: dbStatus,
    environment: config.env,
    timestamp: new Date().toISOString(),
    version: config.app.version,
    app: config.app.name,
  };

  res.status(200).json(ApiResponse.success(healthData, 'MindSync API is healthy'));
});

export default { getHealth };
