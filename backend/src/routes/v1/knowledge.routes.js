import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import knowledgeController from '../../controllers/knowledge.controller.js';

const router = Router();

// Protect all routes
router.use(protect);

router.route('/resource/:resourceId/status')
  .get(knowledgeController.getStatus);

router.route('/resource/:resourceId/reindex')
  .post(knowledgeController.reindex);

router.route('/search')
  .post(knowledgeController.search);

export default router;
