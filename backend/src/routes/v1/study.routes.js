import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import studyController from '../../controllers/study.controller.js';
import summaryController from '../../controllers/summary.controller.js';
import youtubeController from '../../controllers/youtube.controller.js';
import { uploadPdf } from '../../config/multer.js';

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

router.route('/:sessionId/resources')
  .get(studyController.getResources)
  .post(studyController.addResource);

router.route('/:sessionId/resources/upload-pdf')
  .post(uploadPdf, studyController.uploadPdfResource);

router.route('/:sessionId/resources/:resourceId')
  .patch(studyController.renameResource)
  .delete(studyController.deleteResource);

router.route('/:sessionId/resources/:resourceId/replace')
  .put(studyController.replaceResource);

router.route('/:id')
  .get(studyController.getSessionById)
  .patch(studyController.updateSession)
  .delete(studyController.deleteSession);

export default router;
