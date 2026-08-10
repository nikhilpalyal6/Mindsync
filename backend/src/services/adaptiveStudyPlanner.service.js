import StudyPlan from '../models/studyPlan.model.js';
import StudyTask from '../models/studyTask.model.js';
import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import logger from '../config/logger.js';

function formatUtcDateString(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseUtcDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

// Clean markdown tags from JSON responses
function parseCleanJson(text) {
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.substring(7);
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3);
  }
  return JSON.parse(clean.trim());
}

class AdaptiveStudyPlannerService {
  async getQuizPerformance(userId, resourceIds) {
    const performances = [];
    if (!resourceIds || resourceIds.length === 0) return performances;

    for (const resId of resourceIds) {
      const session = await StudySession.findOne({
        user: userId,
        $or: [
          { 'resources._id': resId },
          { 'resources.url': resId }
        ]
      });
      if (session) {
        const resource = session.resources.find(r => r._id.toString() === resId.toString() || r.url === resId);
        if (resource && resource.ai?.quiz?.analytics) {
          performances.push({
            resourceId: resId,
            resourceTitle: resource.title,
            accuracy: resource.ai.quiz.analytics.accuracy || 0,
            correctPercentage: resource.ai.quiz.analytics.correctPercentage || 0,
            wrongPercentage: resource.ai.quiz.analytics.wrongPercentage || 0,
            completionRate: resource.ai.quiz.analytics.completionRate || 0
          });
        }
      }
    }
    return performances;
  }

  // Generate adaptation recommendations preview without making DB changes
  async generateAdaptationPreview(userId, planId, clientDate) {
    const plan = await StudyPlan.findOne({ _id: planId, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    const tasks = await StudyTask.find({ studyPlanId: planId, user: userId }).lean();
    
    // Server timezone-safe today boundary
    const todayStr = clientDate || formatUtcDateString(new Date());
    
    const completedTasks = [];
    const missedTasks = [];
    const futureTasks = [];

    for (const task of tasks) {
      const taskDateStr = formatUtcDateString(task.scheduledDate);
      if (task.status === 'COMPLETED') {
        completedTasks.push(task);
      } else if (task.status === 'SKIPPED' || taskDateStr < todayStr) {
        missedTasks.push(task);
      } else {
        futureTasks.push(task);
      }
    }

    // Determine available future study dates matching user's preferred days
    const studyDates = [];
    const current = parseUtcDateString(todayStr);
    const end = new Date(plan.endDate);
    
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const activeDays = plan.preferredStudyDays && plan.preferredStudyDays.length > 0 ? plan.preferredStudyDays : dayNames;

    while (current <= end) {
      const dayName = dayNames[current.getUTCDay()];
      if (activeDays.includes(dayName)) {
        studyDates.push(formatUtcDateString(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Fall back to all days in range if preferred days list was empty or none matched
    if (studyDates.length === 0) {
      const fallbackCurrent = parseUtcDateString(todayStr);
      while (fallbackCurrent <= end) {
        studyDates.push(formatUtcDateString(fallbackCurrent));
        fallbackCurrent.setUTCDate(fallbackCurrent.getUTCDate() + 1);
      }
    }

    // Get quiz performance
    const performances = await this.getQuizPerformance(userId, plan.resourceIds);
    const weakResources = performances.filter(p => p.accuracy < 50);
    const strongResources = performances.filter(p => p.accuracy >= 85);

    // Calculate daily loads already scheduled (completed or future tasks)
    const dailyLoads = {};
    studyDates.forEach(d => { dailyLoads[d] = 0; });
    
    tasks.forEach(t => {
      if (t.status === 'COMPLETED') {
        const dStr = formatUtcDateString(t.scheduledDate);
        if (dailyLoads[dStr] !== undefined) {
          dailyLoads[dStr] += t.estimatedMinutes;
        }
      }
    });

    logger.info(`[Adaptive Planner] Generating adaptation preview for plan ${planId}. Missed count: ${missedTasks.length}, Available days: ${studyDates.length}`);

    // If there are no missed tasks and no weak areas, return empty recommendations
    if (missedTasks.length === 0 && weakResources.length === 0) {
      return {
        plan,
        overdueCount: 0,
        warnings: [],
        rescheduledTasks: [],
        newAdaptiveTasks: [],
        performance: performances
      };
    }

    const aiPrompt = `
      You are MindSync's academic study-planning engine.
      Analyze the student's study plan and generate adaptive scheduling recommendations.
      
      Plan Specifications:
      - Subject: "${plan.subject}"
      - Daily Capacity Target: ${plan.dailyStudyMinutes} minutes
      - Available Future Dates: ${JSON.stringify(studyDates)}
      - Current Scheduled Daily Loads (Already Taken): ${JSON.stringify(dailyLoads)}
      
      Student Performance & Status:
      - Completed Tasks (DO NOT ALTER): ${JSON.stringify(completedTasks.map(t => ({ id: t._id, title: t.title })))}
      - Missed/Overdue/Skipped Tasks (NEED RESCHEDULING): ${JSON.stringify(missedTasks.map(t => ({ id: t._id, title: t.title, estimatedMinutes: t.estimatedMinutes, resourceId: t.resourceId })))}
      - Future Scheduled Tasks (Can be moved or re-prioritized if needed): ${JSON.stringify(futureTasks.map(t => ({ id: t._id, title: t.title, estimatedMinutes: t.estimatedMinutes, scheduledDate: formatUtcDateString(t.scheduledDate) })))}
      - Weak Resources (Quiz Score < 50% - generate extra review/practice tasks): ${JSON.stringify(weakResources)}
      - Strong Resources (Quiz Score >= 85% - do not generate remediation): ${JSON.stringify(strongResources)}
      
      Safety/Scheduling Rules:
      1. Assign/reschedule tasks only on the available dates.
      2. The sum of task durations on any date must not exceed ${plan.dailyStudyMinutes} minutes.
      3. For each weak resource, recommend 1 or 2 small adaptive review/practice tasks (20-30 mins max).
      4. If the workload exceeds the remaining calendar capacity, do not overload the schedule. Instead, list a warning description in the warnings array.
      
      Expected Response Format JSON ONLY:
      {
        "rescheduledTasks": [
          {
            "taskId": "string (matching a missed task ID)",
            "newScheduledDate": "YYYY-MM-DD",
            "newEstimatedMinutes": number
          }
        ],
        "newAdaptiveTasks": [
          {
            "title": "string (e.g. TCP/IP Review)",
            "description": "string",
            "taskType": "REVIEW" | "FLASHCARDS" | "QUIZ" | "EXPLAIN" | "PRACTICE",
            "scheduledDate": "YYYY-MM-DD",
            "estimatedMinutes": number,
            "priority": "MEDIUM" | "HIGH",
            "resourceId": "string or null"
          }
        ],
        "warnings": ["string"]
      }
    `;

    const systemInstruction = "You are MindSync's academic study-planning engine. Return ONLY valid JSON matching the requested schema. Do not output markdown backticks or explanations.";
    
    let recommendation = { rescheduledTasks: [], newAdaptiveTasks: [], warnings: [] };
    
    try {
      const aiResponse = await aiProviderService.generateAIResponse({
        messages: [{ role: 'user', content: aiPrompt }],
        systemInstruction,
        jsonMode: true
      });
      const text = (aiResponse.text || aiResponse.toString() || '').trim();
      const parsed = parseCleanJson(text);
      if (parsed) {
        recommendation = parsed;
      }
    } catch (err) {
      logger.error(`[Adaptive Planner] AI Generation failed: ${err.message}`);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Unable to generate adaptive study plan. Please try again.');
    }

    // Validate recommendation content
    const validatedRescheduled = [];
    const validatedNew = [];
    const validTaskTypes = ['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM'];

    if (Array.isArray(recommendation.rescheduledTasks)) {
      for (const item of recommendation.rescheduledTasks) {
        // Validate task exists in missedTasks
        const match = missedTasks.find(t => t._id.toString() === item.taskId);
        if (!match) continue;

        // Validate date
        if (!item.newScheduledDate || !studyDates.includes(item.newScheduledDate)) continue;

        // Validate minutes
        const mins = parseInt(item.newEstimatedMinutes, 10);
        if (isNaN(mins) || mins <= 0) continue;

        validatedRescheduled.push({
          taskId: item.taskId,
          title: match.title,
          previousDate: formatUtcDateString(match.scheduledDate),
          newScheduledDate: item.newScheduledDate,
          estimatedMinutes: Math.min(mins, plan.dailyStudyMinutes)
        });
      }
    }

    if (Array.isArray(recommendation.newAdaptiveTasks)) {
      for (const item of recommendation.newAdaptiveTasks) {
        if (!item.title || !item.title.trim()) continue;
        if (!item.scheduledDate || !studyDates.includes(item.scheduledDate)) continue;
        
        const type = (item.taskType || 'REVIEW').toUpperCase();
        const taskType = validTaskTypes.includes(type) ? type : 'REVIEW';
        
        const mins = parseInt(item.estimatedMinutes, 10);
        if (isNaN(mins) || mins <= 0) continue;

        let linkedResId = null;
        if (item.resourceId && plan.resourceIds.includes(item.resourceId)) {
          linkedResId = item.resourceId;
        }

        validatedNew.push({
          title: item.title.trim(),
          description: item.description ? item.description.trim() : '',
          taskType,
          scheduledDate: item.scheduledDate,
          estimatedMinutes: Math.min(mins, plan.dailyStudyMinutes),
          priority: item.priority || 'MEDIUM',
          resourceId: linkedResId
        });
      }
    }

    // Verify workload capacities
    const dailyFutureSums = {};
    studyDates.forEach(d => { dailyFutureSums[d] = dailyLoads[d] || 0; });

    validatedRescheduled.forEach(t => {
      dailyFutureSums[t.newScheduledDate] += t.estimatedMinutes;
    });
    validatedNew.forEach(t => {
      dailyFutureSums[t.scheduledDate] += t.estimatedMinutes;
    });

    const capacityWarnings = recommendation.warnings || [];
    for (const [dateStr, totalMins] of Object.entries(dailyFutureSums)) {
      if (totalMins > plan.dailyStudyMinutes + 15) {
        capacityWarnings.push(`Workload on ${dateStr} (${totalMins} mins) exceeds your daily limit of ${plan.dailyStudyMinutes} mins.`);
        // Scale down to capacity
        const scaleFactor = plan.dailyStudyMinutes / totalMins;
        validatedRescheduled.forEach(t => {
          if (t.newScheduledDate === dateStr) {
            t.estimatedMinutes = Math.max(1, Math.round(t.estimatedMinutes * scaleFactor));
          }
        });
        validatedNew.forEach(t => {
          if (t.scheduledDate === dateStr) {
            t.estimatedMinutes = Math.max(1, Math.round(t.estimatedMinutes * scaleFactor));
          }
        });
      }
    }

    return {
      plan,
      overdueCount: missedTasks.length,
      warnings: [...new Set(capacityWarnings)],
      rescheduledTasks: validatedRescheduled,
      newAdaptiveTasks: validatedNew,
      performance: performances
    };
  }

  // Apply adaptation changes inside a single clean execution block
  async applyAdaptation(userId, planId, adaptationPayload) {
    const plan = await StudyPlan.findOne({ _id: planId, user: userId });
    if (!plan) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study plan not found.');
    }

    const { rescheduledTasks, newAdaptiveTasks } = adaptationPayload;

    logger.info(`[Adaptive Planner] Applying adaptation changes to plan ${planId}. Rescheduled: ${rescheduledTasks?.length || 0}, New: ${newAdaptiveTasks?.length || 0}`);

    // Update rescheduled tasks
    if (Array.isArray(rescheduledTasks)) {
      for (const item of rescheduledTasks) {
        const task = await StudyTask.findOne({ _id: item.taskId, studyPlanId: planId, user: userId });
        if (task && task.status !== 'COMPLETED') {
          const originalDate = task.originalScheduledDate || task.scheduledDate;
          task.originalScheduledDate = originalDate;
          task.scheduledDate = parseUtcDateString(item.newScheduledDate);
          task.estimatedMinutes = item.estimatedMinutes;
          task.rescheduleCount = (task.rescheduleCount || 0) + 1;
          task.rescheduleReason = 'Adaptive reallocation of missed task';
          task.status = 'PENDING'; // reset skipped/pending status
          await task.save();
        }
      }
    }

    // Insert new adaptive tasks
    if (Array.isArray(newAdaptiveTasks) && newAdaptiveTasks.length > 0) {
      const orderCount = await StudyTask.countDocuments({ studyPlanId: planId, user: userId });
      const tasksToInsert = newAdaptiveTasks.map((t, idx) => ({
        user: userId,
        studyPlanId: planId,
        title: t.title,
        description: t.description || 'Remediation task created by adaptive planning',
        taskType: t.taskType,
        scheduledDate: parseUtcDateString(t.scheduledDate),
        estimatedMinutes: t.estimatedMinutes,
        priority: t.priority || 'MEDIUM',
        resourceId: t.resourceId || null,
        order: orderCount + idx,
        status: 'PENDING'
      }));
      await StudyTask.insertMany(tasksToInsert);
    }

    return { success: true };
  }
}

export default new AdaptiveStudyPlannerService();
