import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import studyController from '../../controllers/study.controller.js';
import summaryController from '../../controllers/summary.controller.js';
import youtubeController from '../../controllers/youtube.controller.js';

const router = Router();

// Protect all study routes
router.use(protect);

router.route('/activity')
  .get(studyController.getActivities);

router.route('/')
  .get(studyController.getSessions)
  .post(studyController.createSession);

router.route('/:sessionId/summary')
  .get(summaryController.getSummary)
  .post(summaryController.generateSummary);

router.route('/:sessionId/youtube/fetch')
  .post(youtubeController.fetchYouTubeData);

router.route('/:id')
  .get(studyController.getSessionById)
  .patch(studyController.updateSession)
  .delete(studyController.deleteSession);

export default router;
