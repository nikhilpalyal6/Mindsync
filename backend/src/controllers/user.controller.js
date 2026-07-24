
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import UserService from '../services/user.service.js';
import TokenService from '../services/token.service.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class UserController {
  static getNotificationPreferences = asyncHandler(async (req, res) => {
    const prefs = await UserService.getOrCreateNotificationPreferences(req.user._id);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, prefs, 'Notification preferences retrieved successfully'));
  });

  static updateNotificationPreferences = asyncHandler(async (req, res) => {
    const prefs = await UserService.updateNotificationPreferences(req.user._id, req.body);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, prefs, 'Notification preferences updated successfully'));
  });

  static getUserPreferences = asyncHandler(async (req, res) => {
    const prefs = await UserService.getOrCreateUserPreferences(req.user._id);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, prefs, 'User preferences retrieved successfully'));
  });

  static updateUserPreferences = asyncHandler(async (req, res) => {
    const prefs = await UserService.updateUserPreferences(req.user._id, req.body);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, prefs, 'User preferences updated successfully'));
  });

  static getRecentActivity = asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const activities = await UserService.getActivities(req.user._id, Number(limit), Number(offset));
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, activities, 'Recent activity retrieved successfully'));
  });

  static getLoginHistory = asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const history = await UserService.getLoginHistory(req.user._id, Number(limit), Number(offset));
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, history, 'Login history retrieved successfully'));
  });

  static clearLoginHistory = asyncHandler(async (req, res) => {
    await UserService.clearLoginHistory(req.user._id);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Login history cleared successfully'));
  });

  static getDevices = asyncHandler(async (req, res) => {
    const sessions = await TokenService.getSessions(req.user._id);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, sessions, 'Devices retrieved successfully'));
  });

  static logoutDevice = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    await TokenService.logoutSession(req.user._id, sessionId);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Device logged out successfully'));
  });

  static logoutAllDevices = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    await TokenService.logoutAllSessions(req.user._id, refreshToken);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'All other devices logged out successfully'));
  });

  static deleteAccount = asyncHandler(async (req, res) => {
    const { confirmation, password } = req.body;
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip || req.connection.remoteAddress;
    await UserService.deleteAccount(req.user._id, confirmation, password);
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Account deleted successfully'));
  });
}

export default UserController;
