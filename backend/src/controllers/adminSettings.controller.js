import adminSettingsService from '../services/adminSettings.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AdminSettingsController {
  getSettingsConfig = asyncHandler(async (req, res) => {
    const configData = await adminSettingsService.getSettingsConfig();

    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, configData, 'Admin settings configuration retrieved successfully')
    );
  });
}

export default new AdminSettingsController();
