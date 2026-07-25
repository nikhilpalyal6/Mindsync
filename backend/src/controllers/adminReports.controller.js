import adminReportsService from '../services/adminReports.service.js';
import { getPaginationParams } from '../utils/pagination.utils.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AdminReportsController {
  getReportData = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { 
      type = 'user', 
      range = '30days', 
      startDate, 
      endDate, 
      role, 
      isVerified, 
      provider, 
      isActive, 
      search, 
      sortBy, 
      sortOrder 
    } = req.query;

    const report = await adminReportsService.getReportData({
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
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({
        rows: report.rows,
        columns: report.columns,
        summary: {
          ...report.summary,
          generatedBy: req.user.name
        }
      }, report.pagination, 'Report generated successfully')
    );
  });
}

export default new AdminReportsController();
