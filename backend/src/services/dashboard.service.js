
import User from '../models/user.model.js';
import Activity from '../models/activity.model.js';
import { getDBStatus } from '../database/connection.js';
import { emailTransporter } from '../config/email.js';
import { cloudinaryClient } from '../config/cloudinary.js';
import config from '../config/index.js';
import process from 'process';

class DashboardService {
  async getDashboardStats() {
    // Get total users
    const totalUsers = await User.countDocuments({ isDeleted: false });

    // Get active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({
      isDeleted: false,
      lastLogin: { $gte: sevenDaysAgo },
    });

    // Get verified users
    const verifiedUsers = await User.countDocuments({
      isDeleted: false,
      isVerified: true,
    });

    // Get new users this week
    const newUsersThisWeek = await User.countDocuments({
      isDeleted: false,
      createdAt: { $gte: sevenDaysAgo },
    });

    // Get user growth data for charts (last 7 days)
    const userGrowthData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const count = await User.countDocuments({
        isDeleted: false,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      userGrowthData.push({
        date: startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: count,
      });
    }

    // Get recent activity (last 10 activities)
    const recentActivities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email username');

    // Live Health Checks
    let emailStatus = 'Status unavailable';
    if (config.email.isConfigured) {
      try {
        if (emailTransporter) {
          await emailTransporter.verify();
          emailStatus = 'connected';
        }
      } catch (err) {
        emailStatus = 'error';
      }
    } else {
      emailStatus = 'unconfigured';
    }

    let cloudinaryStatus = 'Status unavailable';
    if (config.cloudinary.isConfigured) {
      if (cloudinaryClient) {
        cloudinaryStatus = 'connected';
      }
    } else {
      cloudinaryStatus = 'unconfigured';
    }

    const health = {
      database: getDBStatus().status || 'disconnected',
      api: 'connected',
      email: emailStatus,
      cloudinary: cloudinaryStatus,
    };

    // Server Info
    const serverInfo = {
      environment: config.env || 'production',
      version: config.app.version || '1.0.0',
      uptime: process.uptime(),
      currentTime: new Date().toISOString(),
    };

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsersThisWeek,
      userGrowthData,
      recentActivities,
      health,
      serverInfo,
    };
  }
}

export default new DashboardService();
