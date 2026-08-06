import studyService from '../services/study.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class StudyController {
  getSessions = asyncHandler(async (req, res) => {
    console.log('[DEBUG CONTROLLER] Entering getSessions. User ID:', req.user._id);
    const { search } = req.query;
    const userId = req.user._id;

    console.log('[DEBUG CONTROLLER] Calling studyService.getSessions...');
    const sessions = await studyService.getSessions(userId, { search });
    console.log('[DEBUG CONTROLLER] studyService.getSessions returned. Count:', sessions?.length);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(sessions, 'Study sessions retrieved successfully')
    );
  });

  getSessionById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('[DEBUG CONTROLLER] Entering getSessionById. User ID:', userId, 'Session ID:', id);
    const session = await studyService.getSessionById(userId, id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Study session retrieved successfully')
    );
  });

  createSession = asyncHandler(async (req, res) => {
    const { title, description, metadata } = req.body;
    const userId = req.user._id;

    const session = await studyService.createSession(userId, {
      title,
      description,
      metadata
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success(session, 'Study session created successfully')
    );
  });

  updateSession = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await studyService.updateSession(userId, id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Study session updated successfully')
    );
  });

  deleteSession = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    await studyService.deleteSession(userId, id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Study session deleted successfully')
    );
  });

  getActivities = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const activities = await studyService.getActivities(userId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(activities, 'Study activities retrieved successfully')
    );
  });
}

export default new StudyController();
