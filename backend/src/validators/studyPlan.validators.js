import { body, param } from 'express-validator';

export const createPlanValidator = [
  body('title').trim().notEmpty().withMessage('Plan title is required').isLength({ max: 200 }).withMessage('Title is too long'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('startDate').notEmpty().withMessage('Start date is required').isISO8601().withMessage('Invalid start date format').toDate(),
  body('endDate').notEmpty().withMessage('End date is required').isISO8601().withMessage('Invalid end date format').toDate()
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before start date');
      }
      return true;
    }),
  body('dailyStudyMinutes').isInt({ min: 1, max: 1440 }).withMessage('Daily study minutes must be between 1 and 1440'),
  body('preferredStudyDays').optional().isArray().withMessage('Preferred study days must be an array'),
  body('preferredStudyDays.*').optional().isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).withMessage('Invalid study day'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).withMessage('Invalid status'),
  body('resourceIds').optional().isArray().withMessage('resourceIds must be an array')
];

export const updatePlanValidator = [
  param('id').isMongoId().withMessage('Invalid plan ID'),
  body('title').optional().trim().notEmpty().withMessage('Plan title cannot be empty').isLength({ max: 200 }).withMessage('Title is too long'),
  body('subject').optional().trim().notEmpty().withMessage('Subject cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date format').toDate(),
  body('endDate').optional().isISO8601().withMessage('Invalid end date format').toDate()
    .custom((value, { req }) => {
      const start = req.body.startDate;
      if (start && new Date(value) < new Date(start)) {
        throw new Error('End date cannot be before start date');
      }
      return true;
    }),
  body('dailyStudyMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Daily study minutes must be between 1 and 1440'),
  body('preferredStudyDays').optional().isArray().withMessage('Preferred study days must be an array'),
  body('preferredStudyDays.*').optional().isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).withMessage('Invalid study day'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).withMessage('Invalid status'),
  body('resourceIds').optional().isArray().withMessage('resourceIds must be an array')
];

export const createTaskValidator = [
  body('title').trim().notEmpty().withMessage('Task title is required').isLength({ max: 200 }).withMessage('Title is too long'),
  body('taskType').isIn(['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM']).withMessage('Invalid task type'),
  body('scheduledDate').notEmpty().withMessage('Scheduled date is required').isISO8601().withMessage('Invalid scheduled date format').toDate(),
  body('estimatedMinutes').isInt({ min: 1, max: 1440 }).withMessage('Estimated minutes must be between 1 and 1440'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
  body('resourceId').optional().trim()
];

export const updateTaskValidator = [
  body('title').optional().trim().notEmpty().withMessage('Task title cannot be empty').isLength({ max: 200 }).withMessage('Title is too long'),
  body('taskType').optional().isIn(['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM']).withMessage('Invalid task type'),
  body('scheduledDate').optional().isISO8601().withMessage('Invalid scheduled date format').toDate(),
  body('estimatedMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Estimated minutes must be between 1 and 1440'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
  body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).withMessage('Invalid status'),
  body('resourceId').optional().trim(),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer')
];
