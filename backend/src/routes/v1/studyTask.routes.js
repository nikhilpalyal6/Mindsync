import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import studyPlanController from '../../controllers/studyPlan.controller.js';
import { updateTaskValidator } from '../../validators/studyPlan.validators.js';

const router = Router();

// Protect all study-tasks endpoints
router.use(protect);

router.route('/today')
  .get(studyPlanController.getTodayTasks);

router.route('/upcoming')
  .get(studyPlanController.getUpcomingTasks);

router.route('/:taskId')
  .patch(validate(updateTaskValidator), studyPlanController.updateTask)
  .delete(studyPlanController.deleteTask);

router.route('/:taskId/complete')
  .patch(studyPlanController.completeTask);

export default router;
