import adminNotificationService from '../services/adminNotification.service.js';
import { getPaginationParams } from '../utils/pagination.utils.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import ApiError from '../utils/ApiError.js';

class AdminNotificationController {
  getNotifications = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search, filter, sortBy, sortOrder } = req.query;

    const { notifications, pagination } = await adminNotificationService.getNotifications({
      page,
      limit,
      skip,
      search,
      filter,
      sortBy,
      sortOrder
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({ notifications }, pagination, 'Notifications retrieved successfully')
    );
  });

  getStats = asyncHandler(async (req, res) => {
    const stats = await adminNotificationService.getStats();

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, stats, 'Notification statistics retrieved successfully')
    );
  });

  getNotificationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await adminNotificationService.getNotificationById(id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, notification, 'Notification details retrieved successfully')
    );
  });

  markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await adminNotificationService.markAsRead(id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, notification, 'Notification marked as read')
    );
  });

  markAsUnread = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await adminNotificationService.markAsUnread(id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, notification, 'Notification marked as unread')
    );
  });

  markAllAsRead = asyncHandler(async (req, res) => {
    await adminNotificationService.markAllAsRead();

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'All notifications marked as read')
    );
  });

  deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await adminNotificationService.deleteNotification(id);

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Notification deleted successfully')
    );
  });

  broadcastAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, type, priority, target } = req.body;

    if (!title || !message) {
      throw ApiError.badRequest('Title and message are required for broadcast');
    }

    const result = await adminNotificationService.broadcastAnnouncement({
      title,
      message,
      type,
      priority,
      target,
      senderId: req.user._id
    });

    res.status(HTTP_STATUS.CREATED).json(
      new ApiResponse(HTTP_STATUS.CREATED, result, `Broadcast announcement successfully sent to ${result.sentCount} users`)
    );
  });
}

export default new AdminNotificationController();
