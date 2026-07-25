import User from '../models/user.model.js';
import LoginHistory from '../models/loginHistory.model.js';
import Session from '../models/session.model.js';
import Activity from '../models/activity.model.js';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { buildPaginationMeta } from '../utils/pagination.utils.js';

class AdminReportsService {
  async getReportData({ 
    type, 
    range, 
    startDate, 
    endDate, 
    role, 
    isVerified, 
    provider, 
    isActive, 
    search, 
    page, 
    limit, 
    skip, 
    sortBy, 
    sortOrder 
  }) {
    // 1. Calculate Date Filters
    let start = new Date();
    let end = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === '7days') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (range === '30days') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (range === '90days') {
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'year') {
      start = new Date(new Date().getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default: 30 days
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    let rows = [];
    let total = 0;
    let columns = [];

    // Helper search regex
    const searchRegex = search ? new RegExp(search, 'i') : null;

    // 2. Fetch specific report data
    if (['user', 'registration', 'verification', 'role'].includes(type)) {
      // User-centric queries
      const query = { isDeleted: false, createdAt: { $gte: start, $lte: end } };

      if (role && role !== 'all') query.role = role;
      if (isVerified && isVerified !== 'all') query.isVerified = isVerified === 'true';
      if (provider && provider !== 'all') query.provider = provider;
      if (isActive && isActive !== 'all') query.isActive = isActive === 'true';

      if (searchRegex) {
        query.$or = [
          { name: searchRegex },
          { username: searchRegex },
          { email: searchRegex }
        ];
      }

      const sortField = ['name', 'createdAt', 'role', 'email'].includes(sortBy) ? sortBy : 'createdAt';
      const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

      total = await User.countDocuments(query);
      const dbUsers = await User.find(query).sort(sort).skip(skip).limit(limit);

      columns = [
        { label: 'Name', key: 'name' },
        { label: 'Username', key: 'username' },
        { label: 'Email', key: 'email' },
        { label: 'Role', key: 'role' },
        { label: 'Provider', key: 'provider' },
        { label: 'Verified', key: 'isVerified' },
        { label: 'Active', key: 'isActive' },
        { label: 'Joined', key: 'createdAt' }
      ];

      rows = dbUsers.map(user => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        provider: user.provider,
        isVerified: user.isVerified ? 'Yes' : 'No',
        isActive: user.isActive ? 'Active' : 'Inactive',
        createdAt: user.createdAt.toISOString()
      }));

    } else if (type === 'login') {
      // Login history queries
      const query = { success: true, loginTime: { $gte: start, $lte: end } };

      if (provider && provider !== 'all') query.provider = provider;
      
      const sortField = ['loginTime', 'browser', 'os', 'device'].includes(sortBy) ? sortBy : 'loginTime';
      const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

      // Search filters mapping
      if (searchRegex) {
        const matchingUsers = await User.find({
          $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
          isDeleted: false
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        query.userId = { $in: userIds };
      }

      total = await LoginHistory.countDocuments(query);
      const logins = await LoginHistory.find(query)
        .populate('userId', 'name username email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      columns = [
        { label: 'User', key: 'userName' },
        { label: 'Email', key: 'userEmail' },
        { label: 'Browser', key: 'browser' },
        { label: 'OS', key: 'os' },
        { label: 'Device', key: 'device' },
        { label: 'Provider', key: 'provider' },
        { label: 'Timestamp', key: 'loginTime' }
      ];

      rows = logins.map(log => ({
        _id: log._id,
        userName: log.userId?.name || 'Deleted User',
        userEmail: log.userId?.email || 'N/A',
        browser: log.browser || 'Unknown',
        os: log.os || 'Unknown',
        device: log.device || 'Desktop',
        provider: log.provider || 'local',
        loginTime: log.loginTime.toISOString()
      }));

    } else if (type === 'session') {
      // Active sessions queries
      const query = { expiresAt: { $gt: new Date() }, createdAt: { $gte: start, $lte: end } };

      if (searchRegex) {
        const matchingUsers = await User.find({
          $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
          isDeleted: false
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        query.userId = { $in: userIds };
      }

      const sortField = ['createdAt', 'browser', 'os', 'device'].includes(sortBy) ? sortBy : 'createdAt';
      const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

      total = await Session.countDocuments(query);
      const sessions = await Session.find(query)
        .populate('userId', 'name username email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      columns = [
        { label: 'User', key: 'userName' },
        { label: 'Email', key: 'userEmail' },
        { label: 'IP Address', key: 'ipAddress' },
        { label: 'Browser', key: 'browser' },
        { label: 'OS', key: 'os' },
        { label: 'Device', key: 'device' },
        { label: 'Expires', key: 'expiresAt' }
      ];

      rows = sessions.map(sess => ({
        _id: sess._id,
        userName: sess.userId?.name || 'Deleted User',
        userEmail: sess.userId?.email || 'N/A',
        ipAddress: sess.ipAddress || 'Unknown',
        browser: sess.browser || 'Unknown',
        os: sess.os || 'Unknown',
        device: sess.device || 'Desktop',
        expiresAt: sess.expiresAt.toISOString()
      }));

    } else if (type === 'activity') {
      // Activity streams queries
      const query = { createdAt: { $gte: start, $lte: end } };

      if (searchRegex) {
        const matchingUsers = await User.find({
          $or: [{ name: searchRegex }, { username: searchRegex }, { email: searchRegex }],
          isDeleted: false
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        query.userId = { $in: userIds };
      }

      const sortField = ['createdAt', 'action'].includes(sortBy) ? sortBy : 'createdAt';
      const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

      total = await Activity.countDocuments(query);
      const activities = await Activity.find(query)
        .populate('userId', 'name username email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      columns = [
        { label: 'User', key: 'userName' },
        { label: 'Email', key: 'userEmail' },
        { label: 'Action', key: 'action' },
        { label: 'IP Address', key: 'ipAddress' },
        { label: 'OS', key: 'os' },
        { label: 'Browser', key: 'browser' },
        { label: 'Details', key: 'details' },
        { label: 'Timestamp', key: 'createdAt' }
      ];

      rows = activities.map(act => ({
        _id: act._id,
        userName: act.userId?.name || 'System / Guest',
        userEmail: act.userId?.email || 'N/A',
        action: act.action,
        ipAddress: act.ipAddress || 'Unknown',
        os: act.os || 'Unknown',
        browser: act.browser || 'Unknown',
        details: JSON.stringify(act.details || {}),
        createdAt: act.createdAt.toISOString()
      }));

    } else if (type === 'summary') {
      // Analytics summary queries
      total = 1; // single summary record
      columns = [
        { label: 'Metric', key: 'metric' },
        { label: 'Aggregate Count', key: 'count' }
      ];

      const usersCreated = await User.countDocuments({ isDeleted: false, createdAt: { $gte: start, $lte: end } });
      const activeLogins = await LoginHistory.countDocuments({ success: true, loginTime: { $gte: start, $lte: end } });
      const uniqueActiveUsers = (await LoginHistory.distinct('userId', { success: true, loginTime: { $gte: start, $lte: end } })).length;
      const totalActivities = await Activity.countDocuments({ createdAt: { $gte: start, $lte: end } });

      rows = [
        { _id: '1', metric: 'Accounts Registered inside window', count: usersCreated.toString() },
        { _id: '2', metric: 'Login Sessions recorded', count: activeLogins.toString() },
        { _id: '3', metric: 'Unique Active Accounts (DAU trend)', count: uniqueActiveUsers.toString() },
        { _id: '4', metric: 'System Activities logged', count: totalActivities.toString() }
      ];

    } else if (type === 'health') {
      // System health logs mock records
      total = 1;
      columns = [
        { label: 'Service Component', key: 'component' },
        { label: 'Operational Status', key: 'status' }
      ];

      const activeUsersCount = await User.countDocuments({ isActive: true, isDeleted: false });

      rows = [
        { _id: '1', component: 'MongoDB Cluster database', status: 'Connected / Healthy' },
        { _id: '2', component: 'Backend API service Server', status: 'Healthy / Uptime active' },
        { _id: '3', component: 'Nodemailer SMTP Transporter', status: 'Connected' },
        { _id: '4', component: 'Cloudinary storage credentials', status: 'Configured' }
      ];
    } else {
      throw ApiError.badRequest('Invalid report type selector');
    }

    const pagination = buildPaginationMeta(total, page, limit);

    return {
      rows,
      columns,
      pagination,
      summary: {
        totalRecords: total,
        dateRange: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        reportType: type,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

export default new AdminReportsService();
