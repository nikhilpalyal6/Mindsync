import config from '../config/index.js';
import { getDBStatus } from '../database/connection.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import providerHealthService from '../services/ai/health/providerHealth.service.js';

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

/**
 * @route   POST /api/v1/health/reset
 * @desc    Reset AI provider health states (dev only)
 * @access  Public/Dev
 */
export const resetProviderHealth = asyncHandler(async (_req, res) => {
  if (process.env.NODE_ENV === 'development' || config.env === 'development') {
    providerHealthService.resetHealth();
    return res.status(200).json(ApiResponse.success(null, 'Provider health states and metrics reset successfully.'));
  }
  return res.status(403).json(ApiResponse.error('Reset is only available in development mode.'));
});

export default { getHealth, resetProviderHealth };
