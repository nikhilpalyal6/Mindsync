import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import studyPlanController from '../../controllers/studyPlan.controller.js';
import { createPlanValidator, updatePlanValidator, createTaskValidator } from '../../validators/studyPlan.validators.js';

const router = Router();

// Protect all study-planner endpoints
router.use(protect);

router.route('/')
  .post(validate(createPlanValidator), studyPlanController.createPlan)
  .get(studyPlanController.getPlans);

router.route('/ai/generate')
  .post(studyPlanController.generateAIPlan);

router.route('/ai/accept')
  .post(studyPlanController.acceptAIPlan);

router.route('/:id/progress')
  .get(studyPlanController.getPlanProgress);

router.route('/:id/adapt/preview')
  .post(studyPlanController.getAdaptationPreview);

router.route('/:id/adapt/apply')
  .post(studyPlanController.applyAdaptation);

router.route('/:id')
  .get(studyPlanController.getPlan)
  .patch(validate(updatePlanValidator), studyPlanController.updatePlan)
  .delete(studyPlanController.deletePlan);

router.route('/:planId/tasks')
  .post(validate(createTaskValidator), studyPlanController.createTask)
  .get(studyPlanController.getPlanTasks);

export default router;
