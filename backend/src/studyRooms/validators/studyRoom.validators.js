import { body, param } from 'express-validator';

export const roomIdParamValidator = [
  param('roomId').isMongoId().withMessage('Invalid room ID')
];

export const createRoomValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Room title is required')
    .isLength({ max: 255 })
    .withMessage('Title cannot exceed 255 characters'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('capacity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Capacity must be between 1 and 1000'),
  body('visibility')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['PUBLIC', 'PRIVATE'])
    .withMessage('Visibility must be PUBLIC or PRIVATE'),
  body('scheduledStart')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid scheduled start date format')
    .toDate(),
  body('scheduledEnd')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid scheduled end date format')
    .toDate()
    .custom((value, { req }) => {
      if (value && req.body.scheduledStart && new Date(value) <= new Date(req.body.scheduledStart)) {
        throw new Error('Scheduled end must be after scheduled start');
      }
      return true;
    }),
  body('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'])
    .withMessage('Invalid room status'),
  body('workshopId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid workshop ID')
];

export const updateRoomValidator = [
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('title')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Title cannot exceed 255 characters'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('capacity')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 1000 })
    .withMessage('Capacity must be between 1 and 1000'),
  body('visibility')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['PUBLIC', 'PRIVATE'])
    .withMessage('Visibility must be PUBLIC or PRIVATE'),
  body('scheduledStart')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid scheduled start date format')
    .toDate(),
  body('scheduledEnd')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid scheduled end date format')
    .toDate()
    .custom((value, { req }) => {
      const start = req.body.scheduledStart || req.query?.scheduledStart; // fallback check
      if (value && start && new Date(value) <= new Date(start)) {
        throw new Error('Scheduled end must be after scheduled start');
      }
      return true;
    }),
  body('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'])
    .withMessage('Invalid room status'),
  body('workshopId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid workshop ID')
];

export const focusStartValidator = [
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('plannedDuration')
    .isInt({ min: 1 })
    .withMessage('Planned duration must be at least 1 minute')
];

export const goalCreateValidator = [
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Goal title is required')
    .isLength({ max: 255 })
    .withMessage('Goal title cannot exceed 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('studyTaskId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid study task ID')
];

export const goalUpdateValidator = [
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  param('goalId').isMongoId().withMessage('Invalid goal ID'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Goal title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Goal title cannot exceed 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'COMPLETED', 'ABANDONED'])
    .withMessage('Invalid goal status')
];
