import AuditLog from '../models/auditLog.model.js';
import LoginHistory from '../models/loginHistory.model.js';
import Session from '../models/session.model.js';
import User from '../models/user.model.js';
import { buildPaginationMeta } from '../utils/pagination.utils.js';

class AdminLogsService {
  async getAuditLogs({ page, limit, skip, search, category, dateRange, startDate, endDate }) {
    const query = {};

    // 1. Category Filter
    if (category && category !== 'all') {
      // Map frontend category filter to schema category values
      const categoryMap = {
        'Authentication': 'authentication',
        'User': 'user_action',
        'Admin': 'admin_action',
        'Security': 'security_event',
        'System': 'system_event'
      };
      const mappedCategory = categoryMap[category] || category;
      query.category = mappedCategory;
    }

    // 2. Date Range Filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let start = new Date();

      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === '7days') {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === '30days') {
        start.setDate(now.getDate() - 30);
      } else if (dateRange === 'custom' && startDate) {
        start = new Date(startDate);
      }

      const end = (dateRange === 'custom' && endDate) ? new Date(endDate) : now;
      query.createdAt = { $gte: start, $lte: end };
    }

    // 3. Search Filter (by User, Email, Action, IP, Browser, Device)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Look up matching users first
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
        isDeleted: false
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { userName: searchRegex },
        { email: searchRegex },
        { action: searchRegex },
        { description: searchRegex },
        { ipAddress: searchRegex },
        { browser: searchRegex },
        { device: searchRegex },
        { userId: { $in: userIds } }
      ];
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('userId', 'name username email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta(total, page, limit);
    return { logs, pagination };
  }

  async getLoginLogs({ page, limit, skip, search, status }) {
    const query = {};

    if (status === 'success') {
      query.success = true;
    } else if (status === 'failed') {
      query.success = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
        isDeleted: false
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { browser: searchRegex },
        { os: searchRegex },
        { ipAddress: searchRegex },
        { userId: { $in: userIds } }
      ];
    }

    const total = await LoginHistory.countDocuments(query);
    const logs = await LoginHistory.find(query)
      .populate('userId', 'name username email')
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta(total, page, limit);
    return { logs, pagination };
  }

  async getActiveSessions({ page, limit, skip, search }) {
    const query = { expiresAt: { $gt: new Date() } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
        isDeleted: false
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { browser: searchRegex },
        { os: searchRegex },
        { ipAddress: searchRegex },
        { userId: { $in: userIds } }
      ];
    }

    const total = await Session.countDocuments(query);
    const sessions = await Session.find(query)
      .populate('userId', 'name username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta(total, page, limit);
    return { sessions, pagination };
  }

  async getExportLogs({ search, category, dateRange, startDate, endDate }) {
    const query = {};

    if (category && category !== 'all') {
      const categoryMap = {
        'Authentication': 'authentication',
        'User': 'user_action',
        'Admin': 'admin_action',
        'Security': 'security_event',
        'System': 'system_event'
      };
      const mappedCategory = categoryMap[category] || category;
      query.category = mappedCategory;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let start = new Date();

      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === '7days') {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === '30days') {
        start.setDate(now.getDate() - 30);
      } else if (dateRange === 'custom' && startDate) {
        start = new Date(startDate);
      }

      const end = (dateRange === 'custom' && endDate) ? new Date(endDate) : now;
      query.createdAt = { $gte: start, $lte: end };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
        isDeleted: false
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { userName: searchRegex },
        { email: searchRegex },
        { action: searchRegex },
        { description: searchRegex },
        { ipAddress: searchRegex },
        { browser: searchRegex },
        { device: searchRegex },
        { userId: { $in: userIds } }
      ];
    }

    return await AuditLog.find(query)
      .populate('userId', 'name username email role')
      .sort({ createdAt: -1 })
      .limit(1000); // Cap exports at 1000 items for memory safety
  }
}

export default new AdminLogsService();
