import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { buildPaginationMeta } from '../utils/pagination.utils.js';
import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';

class AdminService {
  async getUsers({ search, filter, sortBy, sortOrder, page, limit, skip }) {
    const query = { isDeleted: false };

    // Search query mapping
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { username: searchRegex },
        { email: searchRegex }
      ];
    }

    // Filtering mapping
    if (filter && filter !== 'all') {
      if (filter === 'verified') {
        query.isVerified = true;
      } else if (filter === 'unverified') {
        query.isVerified = false;
      } else if (filter === 'active') {
        query.isActive = true;
      } else if (filter === 'inactive') {
        query.isActive = false;
      } else if (filter === 'google') {
        query.provider = 'google';
      } else if (filter === 'local') {
        query.provider = 'local';
      } else if (Object.values(ROLES).includes(filter)) {
        query.role = filter;
      }
    }

    // Sort order definition
    const sort = {};
    const sortField = ['name', 'createdAt', 'lastLogin', 'role'].includes(sortBy) ? sortBy : 'createdAt';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    // DB calls
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta(total, page, limit);

    return { users, pagination };
  }

  async getUserDetails(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid User ID format');
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }

  async updateUserStatus(targetUserId, isActive, currentUser) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid User ID format');
    }

    if (currentUser._id.toString() === targetUserId) {
      throw ApiError.badRequest('You cannot activate or deactivate your own account.');
    }

    const user = await User.findOne({ _id: targetUserId, isDeleted: false });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // ADMIN cannot modify SUPER_ADMIN accounts
    if (user.role === ROLES.SUPER_ADMIN && currentUser.role === ROLES.ADMIN) {
      throw ApiError.forbidden('ADMIN role is unauthorized to modify SUPER_ADMIN accounts.');
    }

    user.isActive = isActive;
    await user.save({ validateBeforeSave: false });
    return user;
  }

  async updateUserVerify(targetUserId, isVerified, currentUser) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid User ID format');
    }

    const user = await User.findOne({ _id: targetUserId, isDeleted: false });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // ADMIN cannot modify SUPER_ADMIN accounts
    if (user.role === ROLES.SUPER_ADMIN && currentUser.role === ROLES.ADMIN) {
      throw ApiError.forbidden('ADMIN role is unauthorized to modify SUPER_ADMIN accounts.');
    }

    user.isVerified = isVerified;
    await user.save({ validateBeforeSave: false });
    return user;
  }

  async updateUserRole(targetUserId, newRole, currentUser) {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid User ID format');
    }

    if (!Object.values(ROLES).includes(newRole)) {
      throw ApiError.badRequest('Invalid role name provided.');
    }

    if (currentUser._id.toString() === targetUserId) {
      throw ApiError.badRequest('You cannot modify your own administrative role.');
    }

    const user = await User.findOne({ _id: targetUserId, isDeleted: false });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // ADMIN cannot modify SUPER_ADMIN accounts
    if (user.role === ROLES.SUPER_ADMIN && currentUser.role === ROLES.ADMIN) {
      throw ApiError.forbidden('ADMIN role is unauthorized to modify SUPER_ADMIN accounts.');
    }

    // Check if target user is the last SUPER_ADMIN
    if (user.role === ROLES.SUPER_ADMIN && newRole !== ROLES.SUPER_ADMIN) {
      const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isDeleted: false });
      if (superAdminCount <= 1) {
        throw ApiError.badRequest('Cannot demote the last SUPER_ADMIN account.');
      }
    }

    user.role = newRole;
    await user.save({ validateBeforeSave: false });
    return user;
  }

  async bulkAction(targetUserIds, action, currentUser) {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      throw ApiError.badRequest('A list of target User IDs is required.');
    }

    // Validate ObjectId format
    for (const id of targetUserIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw ApiError.badRequest(`Invalid User ID format in list: ${id}`);
      }
    }

    if (action === 'delete') {
      throw ApiError.forbidden('Bulk account deletion features are disabled by default for security.');
    }

    // Check self modification
    if (targetUserIds.includes(currentUser._id.toString())) {
      throw ApiError.badRequest('You cannot perform bulk updates that include your own account.');
    }

    // Retrieve target users
    const users = await User.find({ _id: { $in: targetUserIds }, isDeleted: false });
    if (users.length !== targetUserIds.length) {
      throw ApiError.notFound('One or more of the selected users could not be found.');
    }

    // ADMIN modifying SUPER_ADMIN validation
    if (currentUser.role === ROLES.ADMIN) {
      const containsSuperAdmin = users.some(u => u.role === ROLES.SUPER_ADMIN);
      if (containsSuperAdmin) {
        throw ApiError.forbidden('ADMIN role is unauthorized to perform bulk changes on SUPER_ADMIN accounts.');
      }
    }

    const targetObjectIds = targetUserIds.map(id => new mongoose.Types.ObjectId(id));

    let updateField = {};
    if (action === 'activate') {
      updateField = { isActive: true };
    } else if (action === 'deactivate') {
      updateField = { isActive: false };
    } else if (action === 'verify') {
      updateField = { isVerified: true };
    } else if (action === 'unverify') {
      updateField = { isVerified: false };
    } else {
      throw ApiError.badRequest('Invalid bulk action name.');
    }

    await User.updateMany(
      { _id: { $in: targetObjectIds }, isDeleted: false },
      { $set: updateField }
    );

    return { updatedCount: users.length };
  }
}

export default new AdminService();
