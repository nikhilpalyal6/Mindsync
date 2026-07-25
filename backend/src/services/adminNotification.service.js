import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { buildPaginationMeta } from '../utils/pagination.utils.js';

class AdminNotificationService {
  async getNotifications({ 
    page, 
    limit, 
    skip, 
    search, 
    filter, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  }) {
    const query = {};

    // Apply Filter
    if (filter) {
      if (filter === 'unread') {
        query.isRead = false;
      } else if (filter === 'read') {
        query.isRead = true;
      } else if (['system', 'security', 'user', 'broadcast', 'ai', 'maintenance'].includes(filter)) {
        query.type = filter;
      }
    }

    // Apply Search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Look up matching users to search by recipient/sender
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
        isDeleted: false
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { title: searchRegex },
        { message: searchRegex },
        { recipient: { $in: userIds } },
        { sender: { $in: userIds } }
      ];
    }

    // Apply Sorting
    const sortMap = {};
    if (sortBy === 'priority') {
      // Map priority low/medium/high
      sortMap.priority = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'isRead') {
      sortMap.isRead = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortMap.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .populate('recipient', 'name username email avatar')
      .populate('sender', 'name username email role')
      .sort(sortMap)
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta(total, page, limit);

    return {
      notifications,
      pagination
    };
  }

  async getNotificationById(id) {
    const notification = await Notification.findById(id)
      .populate('recipient', 'name username email role')
      .populate('sender', 'name username email role');

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    return notification;
  }

  async markAsRead(id) {
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    return notification;
  }

  async markAsUnread(id) {
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: false, readAt: null },
      { new: true }
    );

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    return notification;
  }

  async markAllAsRead() {
    await Notification.updateMany({ isRead: false }, { isRead: true, readAt: new Date() });
    return true;
  }

  async deleteNotification(id) {
    const result = await Notification.findByIdAndDelete(id);
    if (!result) {
      throw ApiError.notFound('Notification not found');
    }
    return true;
  }

  async broadcastAnnouncement({ title, message, type = 'broadcast', priority = 'medium', target = 'all', senderId }) {
    const userQuery = { isDeleted: false };

    // Apply target scope
    if (target === 'verified') {
      userQuery.isVerified = true;
    } else if (target === 'admins') {
      userQuery.role = { $in: ['ADMIN', 'SUPER_ADMIN'] };
    } else if (['USER', 'ADMIN', 'SUPER_ADMIN'].includes(target)) {
      userQuery.role = target;
    }

    const users = await User.find(userQuery).select('_id');
    if (!users || users.length === 0) {
      throw ApiError.badRequest('No matching recipients found for the selected broadcast scope');
    }

    // Build notifications batch
    const notificationsBatch = users.map(user => ({
      recipient: user._id,
      title,
      message,
      type,
      priority,
      sender: senderId,
      isRead: false
    }));

    const result = await Notification.insertMany(notificationsBatch);
    return {
      sentCount: result.length,
      targetScope: target
    };
  }

  async getStats() {
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ isRead: false });
    const broadcastMessages = await Notification.countDocuments({ type: 'broadcast' });
    const systemAlerts = await Notification.countDocuments({ type: 'system' });

    return {
      totalNotifications,
      unreadNotifications,
      broadcastMessages,
      systemAlerts
    };
  }
}

export default new AdminNotificationService();
