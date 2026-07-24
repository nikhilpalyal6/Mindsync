
import User from '../models/user.model.js';
import Activity from '../models/activity.model.js';

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

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsersThisWeek,
      userGrowthData,
      recentActivities,
    };
  }
}

export default new DashboardService();
