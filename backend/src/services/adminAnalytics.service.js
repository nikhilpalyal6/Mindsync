import User from '../models/user.model.js';
import LoginHistory from '../models/loginHistory.model.js';
import Activity from '../models/activity.model.js';

class AdminAnalyticsService {
  async getOverviewAnalytics({ range, startDate, endDate }) {
    // 1. Calculate Date Range Bounds
    let start = new Date();
    let end = new Date();
    let format = 'day';

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      format = 'hour';
    } else if (range === '7days') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (range === '30days') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (range === '90days') {
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
    } else if (range === 'year') {
      start = new Date(new Date().getFullYear(), 0, 1);
      format = 'month';
    } else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // Determine format based on day count difference
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) format = 'hour';
      else if (diffDays > 365) format = 'month';
    } else {
      // Default: 30 days
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    // 2. Query Statistics Counts (All time or current snapshot)
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const verifiedUsers = await User.countDocuments({ isVerified: true, isDeleted: false });
    const activeUsers = await User.countDocuments({ isActive: true, isDeleted: false });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfToday }, isDeleted: false });
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: startOfWeek }, isDeleted: false });
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: false });

    const googleUsers = await User.countDocuments({ provider: 'google', isDeleted: false });
    const localUsers = await User.countDocuments({ provider: 'local', isDeleted: false });
    const adminCount = await User.countDocuments({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, isDeleted: false });
    const userCount = await User.countDocuments({ role: 'USER', isDeleted: false });

    // 3. User Growth Trend Aggregation (Registrations)
    const registrationsAgg = await User.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: format === 'hour' ? "%Y-%m-%d %H:00" : (format === 'month' ? "%Y-%m" : "%Y-%m-%d"), 
              date: "$createdAt" 
            } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 4. Login Trend Aggregation
    const loginsAgg = await LoginHistory.aggregate([
      {
        $match: {
          success: true,
          loginTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: format === 'hour' ? "%Y-%m-%d %H:00" : (format === 'month' ? "%Y-%m" : "%Y-%m-%d"), 
              date: "$loginTime" 
            } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalLogins = await LoginHistory.countDocuments({ success: true, loginTime: { $gte: start, $lte: end } });

    // Fill missing date slots for smooth charts
    const userGrowthData = this.fillDates(start, end, registrationsAgg, format);
    const loginTrendData = this.fillDates(start, end, loginsAgg, format);

    // 5. Device Aggregation
    const deviceAgg = await LoginHistory.aggregate([
      { $match: { success: true, loginTime: { $gte: start, $lte: end } } },
      { $group: { _id: "$device", count: { $sum: 1 } } }
    ]);
    const deviceMap = { Desktop: 0, Mobile: 0, Tablet: 0 };
    let deviceTotal = 0;
    deviceAgg.forEach(item => {
      const type = item._id || 'Desktop';
      if (['Desktop', 'Mobile', 'Tablet'].includes(type)) {
        deviceMap[type] += item.count;
      } else {
        deviceMap.Desktop += item.count;
      }
      deviceTotal += item.count;
    });
    const deviceData = Object.keys(deviceMap).map(key => ({
      name: key,
      count: deviceMap[key],
      percentage: deviceTotal > 0 ? Math.round((deviceMap[key] / deviceTotal) * 100) : 0
    }));

    // 6. Browser Aggregation
    const browserAgg = await LoginHistory.aggregate([
      { $match: { success: true, loginTime: { $gte: start, $lte: end } } },
      { $group: { _id: "$browser", count: { $sum: 1 } } }
    ]);
    const browserMap = { Chrome: 0, Edge: 0, Firefox: 0, Safari: 0, Opera: 0, Other: 0 };
    browserAgg.forEach(item => {
      const b = item._id || 'Unknown';
      if (['Chrome', 'Edge', 'Firefox', 'Safari', 'Opera'].includes(b)) {
        browserMap[b] += item.count;
      } else {
        browserMap.Other += item.count;
      }
    });
    const browserData = Object.keys(browserMap).map(key => ({ name: key, count: browserMap[key] }));

    // 7. Operating System Aggregation
    const osAgg = await LoginHistory.aggregate([
      { $match: { success: true, loginTime: { $gte: start, $lte: end } } },
      { $group: { _id: "$os", count: { $sum: 1 } } }
    ]);
    const osMap = { Windows: 0, macOS: 0, Linux: 0, Android: 0, iOS: 0, Other: 0 };
    osAgg.forEach(item => {
      const name = item._id || 'Unknown';
      if (name.startsWith('Windows')) {
        osMap.Windows += item.count;
      } else if (name === 'macOS') {
        osMap.macOS += item.count;
      } else if (name === 'Linux') {
        osMap.Linux += item.count;
      } else if (name === 'Android') {
        osMap.Android += item.count;
      } else if (name === 'iOS') {
        osMap.iOS += item.count;
      } else {
        osMap.Other += item.count;
      }
    });
    const osData = Object.keys(osMap).map(key => ({ name: key, count: osMap[key] }));

    // 8. Provider Aggregation (Google vs Local)
    const providerData = [
      { name: 'Google Login', count: googleUsers },
      { name: 'Local Login', count: localUsers }
    ];

    // 9. Verification Aggregation
    const verificationData = [
      { name: 'Verified', count: verifiedUsers },
      { name: 'Unverified', count: totalUsers - verifiedUsers }
    ];

    // 10. DAU, WAU, MAU Activity Summary
    const dau = (await LoginHistory.distinct('userId', { success: true, loginTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })).length;
    const wau = (await LoginHistory.distinct('userId', { success: true, loginTime: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })).length;
    const mau = (await LoginHistory.distinct('userId', { success: true, loginTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })).length;

    const activeUsersTrendAgg = await LoginHistory.aggregate([
      {
        $match: {
          success: true,
          loginTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: format === 'hour' ? "%Y-%m-%d %H:00" : (format === 'month' ? "%Y-%m" : "%Y-%m-%d"), date: "$loginTime" } },
            userId: "$userId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const activeUsersTrend = this.fillDates(start, end, activeUsersTrendAgg, format);

    // 11. Recent Registrations
    const recentRegistrations = await User.find({ isDeleted: false })
      .select('name username email profileImage createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      stats: {
        totalUsers,
        verifiedUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        googleUsers,
        localUsers,
        adminCount,
        userCount,
        totalLogins,
        dau,
        wau,
        mau
      },
      userGrowthData,
      loginTrendData,
      deviceData,
      browserData,
      osData,
      providerData,
      verificationData,
      activeUsersTrend,
      recentRegistrations
    };
  }

  fillDates(start, end, data, format) {
    const result = [];
    const dataMap = new Map(data.map(item => [item._id, item.count]));
    
    let current = new Date(start);
    while (current <= end) {
      let key = '';
      if (format === 'hour') {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const hour = String(current.getHours()).padStart(2, '0');
        key = `${year}-${month}-${day} ${hour}:00`;
        current.setHours(current.getHours() + 1);
      } else if (format === 'month') {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        key = `${year}-${month}`;
        current.setMonth(current.getMonth() + 1);
      } else {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        key = `${year}-${month}-${day}`;
        current.setDate(current.getDate() + 1);
      }
      
      result.push({
        date: key,
        count: dataMap.get(key) || 0
      });
    }
    return result;
  }
}

export default new AdminAnalyticsService();
