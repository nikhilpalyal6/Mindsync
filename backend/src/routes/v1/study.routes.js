import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import studyController from '../../controllers/study.controller.js';

const router = Router();

// Protect all study routes
router.use(protect);

router.route('/activity')
  .get(studyController.getActivities);

router.route('/')
  .get(studyController.getSessions)
  .post(studyController.createSession);

router.route('/:id')
  .patch(studyController.updateSession)
  .delete(studyController.deleteSession);

export default router;
