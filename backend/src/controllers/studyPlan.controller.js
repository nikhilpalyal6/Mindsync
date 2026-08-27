import StudyPlan from '../models/studyPlan.model.js';
import StudyTask from '../models/studyTask.model.js';
import StudySession from '../models/studySession.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import smartStudyPlannerService from '../services/smartStudyPlanner.service.js';
import adaptiveStudyPlannerService from '../services/adaptiveStudyPlanner.service.js';

function formatUtcDateString(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseUtcDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

class StudyPlanController {
  // Helpers to verify resource ownership
  async _verifyResourceOwnership(userId, resourceIds) {
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) return;
    for (const resId of resourceIds) {
      const session = await StudySession.findOne({
        user: userId,
        $or: [
          { 'resources._id': resId },
          { 'resources.url': resId }
        ]
      });
      if (!session) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, `You do not own or have access to resource: ${resId}`);
      }
    }
  }

  // --- STUDY PLAN CRUD ---

  createPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {
      title,
      description,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      status,
      priority,
      resourceIds
    } = req.body;

    // Verify ownership of all associated resources
    await this._verifyResourceOwnership(userId, resourceIds);

    const plan = await StudyPlan.create({
      user: userId,
      title,
      description: description || '',
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays: preferredStudyDays || [],
      status: status || 'DRAFT',
      priority: priority || 'MEDIUM',
      resourceIds: resourceIds || []
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success({ plan }, 'Study plan created successfully.')
    );
  });

  getPlans = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status, priority, subject } = req.query;

    const filter = { user: userId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (subject) filter.subject = new RegExp(subject, 'i');

    const plans = await StudyPlan.find(filter).sort({ createdAt: -1 });

    if (plans.length === 0) {
      return res.status(HTTP_STATUS.OK).json(
        ApiResponse.success({ plans: [] }, 'Study plans retrieved successfully.')
      );
    }

    const planIds = plans.map(p => p._id);
    
    // Single aggregation query to fetch task completion statistics for all plans in bulk
    const taskStats = await StudyTask.aggregate([
      { $match: { studyPlanId: { $in: planIds } } },
      {
        $group: {
          _id: '$studyPlanId',
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      }
    ]);

    const statsMap = {};
    taskStats.forEach(stat => {
      statsMap[stat._id.toString()] = {
        totalTasks: stat.totalTasks,
        completedTasks: stat.completedTasks,
        progress: stat.totalTasks > 0 ? Math.round((stat.completedTasks / stat.totalTasks) * 100) : 0
      };
    });

    const plansWithProgress = plans.map(plan => {
      const stats = statsMap[plan._id.toString()] || { totalTasks: 0, completedTasks: 0, progress: 0 };
      return {
        ...plan.toObject(),
        ...stats
      };
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ plans: plansWithProgress }, 'Study plans retrieved successfully.')
    );
  });

  getPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    const plan = await StudyPlan.findOne({ _id: id, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    // Parallelized query execution
    const [totalTasks, completedTasks] = await Promise.all([
      StudyTask.countDocuments({ studyPlanId: plan._id }),
      StudyTask.countDocuments({ studyPlanId: plan._id, status: 'COMPLETED' })
    ]);
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(
        {
          plan,
          progressInfo: {
            totalTasks,
            completedTasks,
            progress
          }
        },
        'Study plan details retrieved successfully.'
      )
    );
  });

  updatePlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    const plan = await StudyPlan.findOne({ _id: id, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    const {
      title,
      description,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      status,
      priority,
      resourceIds
    } = req.body;

    if (resourceIds) {
      await this._verifyResourceOwnership(userId, resourceIds);
      plan.resourceIds = resourceIds;
    }

    if (title !== undefined) plan.title = title;
    if (description !== undefined) plan.description = description;
    if (subject !== undefined) plan.subject = subject;
    if (startDate !== undefined) plan.startDate = startDate;
    if (endDate !== undefined) plan.endDate = endDate;
    if (dailyStudyMinutes !== undefined) plan.dailyStudyMinutes = dailyStudyMinutes;
    if (preferredStudyDays !== undefined) plan.preferredStudyDays = preferredStudyDays;
    if (status !== undefined) plan.status = status;
    if (priority !== undefined) plan.priority = priority;

    await plan.save();

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ plan }, 'Study plan updated successfully.')
    );
  });

  deletePlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    const plan = await StudyPlan.findOneAndDelete({ _id: id, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    // Cascade delete tasks associated with this plan
    await StudyTask.deleteMany({ studyPlanId: id });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Study plan and its tasks deleted successfully.')
    );
  });

  // --- STUDY TASK CRUD ---

  createTask = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { planId } = req.params;
    const {
      title,
      description,
      taskType,
      scheduledDate,
      estimatedMinutes,
      priority,
      resourceId
    } = req.body;

    // Verify study plan ownership
    const plan = await StudyPlan.findOne({ _id: planId, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    // Verify resource ownership if attached
    if (resourceId) {
      await this._verifyResourceOwnership(userId, [resourceId]);
    }

    const task = await StudyTask.create({
      user: userId,
      studyPlanId: planId,
      title,
      description: description || '',
      taskType,
      scheduledDate,
      estimatedMinutes,
      priority: priority || 'MEDIUM',
      resourceId: resourceId || null,
      status: 'PENDING'
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success({ task }, 'Study task created successfully.')
    );
  });

  getPlanTasks = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { planId } = req.params;

    const plan = await StudyPlan.findOne({ _id: planId, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    const tasks = await StudyTask.find({ studyPlanId: planId, user: userId })
      .sort({ scheduledDate: 1, order: 1 });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ tasks }, 'Study tasks retrieved successfully.')
    );
  });

  updateTask = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { taskId } = req.params;

    const task = await StudyTask.findOne({ _id: taskId, user: userId });
    if (!task) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study task not found.');
    }

    const {
      title,
      description,
      taskType,
      scheduledDate,
      estimatedMinutes,
      status,
      priority,
      resourceId,
      order
    } = req.body;

    if (resourceId) {
      await this._verifyResourceOwnership(userId, [resourceId]);
      task.resourceId = resourceId;
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (taskType !== undefined) task.taskType = taskType;
    if (scheduledDate !== undefined) task.scheduledDate = scheduledDate;
    if (estimatedMinutes !== undefined) task.estimatedMinutes = estimatedMinutes;
    if (priority !== undefined) task.priority = priority;
    if (order !== undefined) task.order = order;

    if (status !== undefined) {
      task.status = status;
      if (status === 'COMPLETED') {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }
    }

    await task.save();

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ task }, 'Study task updated successfully.')
    );
  });

  deleteTask = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { taskId } = req.params;

    const task = await StudyTask.findOneAndDelete({ _id: taskId, user: userId });
    if (!task) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study task not found.');
    }

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Study task deleted successfully.')
    );
  });

  completeTask = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { taskId } = req.params;

    const task = await StudyTask.findOne({ _id: taskId, user: userId });
    if (!task) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study task not found.');
    }

    task.status = 'COMPLETED';
    task.completedAt = new Date();
    await task.save();

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ task }, 'Study task marked as completed.')
    );
  });

  getTodayTasks = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Timezone safe server-side current day boundary detection
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const tasks = await StudyTask.find({
      user: userId,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ order: 1, createdAt: 1 });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ tasks }, 'Today\'s study tasks retrieved successfully.')
    );
  });

  getUpcomingTasks = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const today = new Date();
    const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const tasks = await StudyTask.find({
      user: userId,
      scheduledDate: { $gt: endOfToday },
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    }).sort({ scheduledDate: 1, order: 1 });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ tasks }, 'Upcoming study tasks retrieved successfully.')
    );
  });

  generateAIPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {
      title,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      priority,
      resourceIds
    } = req.body;

    // Validate resource ownership
    await this._verifyResourceOwnership(userId, resourceIds);

    const planPreview = await smartStudyPlannerService.generatePlanPreview(userId, {
      title,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      priority,
      resourceIds
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ planPreview }, 'AI study plan preview generated successfully.')
    );
  });

  acceptAIPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { plan, tasks } = req.body;

    if (!plan || !tasks || !Array.isArray(tasks)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid payload structure.');
    }

    // Verify ownership of plan resources
    await this._verifyResourceOwnership(userId, plan.resourceIds);

    // Double-click / Idempotency protection check
    const existingPlan = await StudyPlan.findOne({
      user: userId,
      title: plan.title,
      subject: plan.subject,
      startDate: new Date(plan.startDate),
      endDate: new Date(plan.endDate),
      createdAt: { $gte: new Date(Date.now() - 10000) } // Created in the last 10 seconds
    });
    if (existingPlan) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'This study plan is currently being created. Please wait.');
    }

    // Create plan
    const createdPlan = await StudyPlan.create({
      user: userId,
      title: plan.title,
      description: plan.description || '',
      subject: plan.subject,
      startDate: new Date(plan.startDate),
      endDate: new Date(plan.endDate),
      dailyStudyMinutes: plan.dailyStudyMinutes,
      preferredStudyDays: plan.preferredStudyDays,
      priority: plan.priority,
      status: 'ACTIVE',
      resourceIds: plan.resourceIds
    });

    // Create tasks
    const tasksToInsert = tasks.map((task, index) => ({
      user: userId,
      studyPlanId: createdPlan._id,
      title: task.title,
      description: task.description || '',
      taskType: task.taskType || 'CUSTOM',
      scheduledDate: new Date(task.scheduledDate),
      estimatedMinutes: task.estimatedMinutes || 30,
      priority: task.priority || 'MEDIUM',
      resourceId: task.resourceId || null,
      order: index,
      status: 'PENDING'
    }));

    await StudyTask.insertMany(tasksToInsert);

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success({ plan: createdPlan }, 'AI study plan accepted and created successfully.')
    );
  });

  applyLocks = new Set();

  getPlanProgress = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id: planId } = req.params;
    const { clientDate } = req.query;

    const plan = await StudyPlan.findOne({ _id: planId, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    const tasks = await StudyTask.find({ studyPlanId: planId, user: userId }).lean();
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Filter tasks scheduled for today (server timezone-safe date matching)
    const todayStr = clientDate || formatUtcDateString(new Date());
    const todayTasks = tasks.filter(t => formatUtcDateString(t.scheduledDate) === todayStr);

    const todayTotalCount = todayTasks.length;
    const todayCompletedCount = todayTasks.filter(t => t.status === 'COMPLETED').length;
    
    const todayTotalMinutes = todayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const todayCompletedMinutes = todayTasks.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + t.estimatedMinutes, 0);

    // Simple Derived Streak
    const tasksByDate = {};
    tasks.forEach(t => {
      const dKey = formatUtcDateString(t.scheduledDate);
      tasksByDate[dKey] = tasksByDate[dKey] || [];
      tasksByDate[dKey].push(t);
    });

    let streak = 0;
    let checkDate = clientDate ? parseUtcDateString(clientDate) : new Date();
    // Look back up to 30 days
    for (let i = 0; i < 30; i++) {
      const checkStr = formatUtcDateString(checkDate);
      const dayTasks = tasksByDate[checkStr];
      
      if (dayTasks && dayTasks.length > 0) {
        const allCompleted = dayTasks.every(t => t.status === 'COMPLETED');
        if (allCompleted) {
          streak++;
        } else {
          if (i > 0) break;
        }
      } else {
        if (i > 0) break;
      }
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({
        planId,
        title: plan.title,
        progress: progressPercent,
        completedTasksCount: completedTasks,
        totalTasksCount: totalTasks,
        today: {
          totalTasksCount: todayTotalCount,
          completedTasksCount: todayCompletedCount,
          totalMinutes: todayTotalMinutes,
          completedMinutes: todayCompletedMinutes,
          progress: todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0
        },
        streak
      }, 'Plan progress retrieved successfully.')
    );
  });

  getAdaptationPreview = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id: planId } = req.params;
    const { clientDate } = req.body;

    const preview = await adaptiveStudyPlannerService.generateAdaptationPreview(userId, planId, clientDate);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ preview }, 'Adaptive study plan recommendations generated successfully.')
    );
  });

  applyAdaptation = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id: planId } = req.params;

    const lockKey = `${userId}-${planId}`;
    if (this.applyLocks.has(lockKey)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'An adaptive update is already in progress. Please wait.');
    }
    this.applyLocks.add(lockKey);

    try {
      const result = await adaptiveStudyPlannerService.applyAdaptation(userId, planId, req.body);
      res.status(HTTP_STATUS.OK).json(
        ApiResponse.success(result, 'Adaptive study plan changes applied successfully.')
      );
    } finally {
      this.applyLocks.delete(lockKey);
    }
  });

  getPendingTasks = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const tasks = await StudyTask.find({
      user: userId,
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    }).sort({ scheduledDate: 1, order: 1 });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ tasks }, 'Pending study tasks retrieved successfully.')
    );
  });
}

export default new StudyPlanController();
