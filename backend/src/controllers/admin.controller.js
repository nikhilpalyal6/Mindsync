import adminService from '../services/admin.service.js';
import { getPaginationParams } from '../utils/pagination.utils.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AdminController {
  getUsers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search, filter, sortBy, sortOrder } = req.query;

    const { users, pagination } = await adminService.getUsers({
      search,
      filter,
      sortBy,
      sortOrder,
      page,
      limit,
      skip
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({ users }, pagination, 'Users list retrieved successfully')
    );
  });

  getUserDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await adminService.getUserDetails(id);
    
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(user, 'User details retrieved successfully')
    );
  });

  updateUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'isActive parameter is required')
      );
      return;
    }

    const updatedUser = await adminService.updateUserStatus(id, isActive, req.user);
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(updatedUser, 'User status updated successfully')
    );
  });

  updateUserVerify = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isVerified } = req.body;

    if (isVerified === undefined) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'isVerified parameter is required')
      );
      return;
    }

    const updatedUser = await adminService.updateUserVerify(id, isVerified, req.user);
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(updatedUser, 'User verification status updated successfully')
    );
  });

  updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'role parameter is required')
      );
      return;
    }

    const updatedUser = await adminService.updateUserRole(id, role, req.user);
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(updatedUser, 'User role updated successfully')
    );
  });

  bulkAction = asyncHandler(async (req, res) => {
    const { userIds, action } = req.body;
    
    const result = await adminService.bulkAction(userIds, action, req.user);
    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Bulk actions processed successfully')
    );
  });
}

export default new AdminController();
