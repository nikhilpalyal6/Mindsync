
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import dashboardService from '../services/dashboard.service.js';

class DashboardController {
  getStats = asyncHandler(async (_req, res) => {
    const stats = await dashboardService.getDashboardStats();
    return res.status(200).json(new ApiResponse(200, stats, 'Dashboard stats retrieved successfully'));
  });
}

export default new DashboardController();
