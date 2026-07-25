import adminLogsService from '../services/adminLogs.service.js';
import { getPaginationParams } from '../utils/pagination.utils.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class AdminLogsController {
  // Keeps same name to avoid breaking route binds
  getActivityLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search, category, dateRange, startDate, endDate } = req.query;

    const { logs, pagination } = await adminLogsService.getAuditLogs({
      page,
      limit,
      skip,
      search,
      category,
      dateRange,
      startDate,
      endDate
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({ logs }, pagination, 'Activity audit logs retrieved successfully')
    );
  });

  getLoginLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search, status } = req.query;

    const { logs, pagination } = await adminLogsService.getLoginLogs({
      page,
      limit,
      skip,
      search,
      status
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({ logs }, pagination, 'Login logs retrieved successfully')
    );
  });

  getActiveSessions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search } = req.query;

    const { sessions, pagination } = await adminLogsService.getActiveSessions({
      page,
      limit,
      skip,
      search
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.paginated({ sessions }, pagination, 'Active sessions retrieved successfully')
    );
  });

  // Export audit logs in CSV or JSON
  exportAuditLogs = asyncHandler(async (req, res) => {
    const { search, category, dateRange, startDate, endDate, format = 'csv' } = req.query;

    const logs = await adminLogsService.getExportLogs({
      search,
      category,
      dateRange,
      startDate,
      endDate
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
      return res.status(HTTP_STATUS.OK).send(JSON.stringify(logs, null, 2));
    }

    // Default to CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');

    // Create CSV headers
    const csvHeaders = [
      'Timestamp',
      'Category',
      'Action',
      'Description',
      'User Name',
      'Email',
      'Role',
      'IP Address',
      'Browser',
      'OS',
      'Device',
      'Status'
    ].join(',');

    const csvRows = logs.map(log => {
      const user = log.userId?.name || log.userName || 'System / Guest';
      const email = log.userId?.email || log.email || 'N/A';
      const role = log.userId?.role || log.role || 'GUEST';

      return [
        `"${new Date(log.createdAt).toISOString()}"`,
        `"${log.category || ''}"`,
        `"${log.action || ''}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`,
        `"${user.replace(/"/g, '""')}"`,
        `"${email.replace(/"/g, '""')}"`,
        `"${role}"`,
        `"${log.ipAddress || ''}"`,
        `"${(log.browser || '').replace(/"/g, '""')}"`,
        `"${(log.os || '').replace(/"/g, '""')}"`,
        `"${log.device || ''}"`,
        `"${log.status || ''}"`
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    res.status(HTTP_STATUS.OK).send(csvContent);
  });
}

export default new AdminLogsController();
