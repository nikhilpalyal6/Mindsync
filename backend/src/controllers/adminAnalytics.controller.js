import adminAnalyticsService from '../services/adminAnalytics.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AdminAnalyticsController {
  getOverview = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    
    const analytics = await adminAnalyticsService.getOverviewAnalytics({
      range,
      startDate,
      endDate
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(analytics, 'Overview analytics retrieved successfully')
    );
  });

  getUsers = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ userGrowthData: analytics.userGrowthData, stats: analytics.stats }, 'User analytics retrieved successfully')
    );
  });

  getLogins = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ loginTrendData: analytics.loginTrendData, stats: analytics.stats }, 'Login analytics retrieved successfully')
    );
  });

  getProviders = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ providerData: analytics.providerData }, 'Provider analytics retrieved successfully')
    );
  });

  getDevices = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ deviceData: analytics.deviceData }, 'Device analytics retrieved successfully')
    );
  });

  getBrowsers = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ browserData: analytics.browserData }, 'Browser analytics retrieved successfully')
    );
  });

  getOS = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ osData: analytics.osData }, 'Operating system analytics retrieved successfully')
    );
  });

  getRegistrations = asyncHandler(async (req, res) => {
    const { range = '30days', startDate, endDate } = req.query;
    const analytics = await adminAnalyticsService.getOverviewAnalytics({ range, startDate, endDate });
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ recentRegistrations: analytics.recentRegistrations }, 'Recent registrations retrieved successfully')
    );
  });
}

export default new AdminAnalyticsController();
