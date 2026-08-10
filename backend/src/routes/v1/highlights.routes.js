import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import highlightController from '../../controllers/highlight.controller.js';

const router = Router();

// Protect all routes in this router
router.use(protect);

router.route('/')
  .post(highlightController.createHighlight);

router.route('/:resourceId')
  .get(highlightController.getHighlights);

router.route('/:highlightId')
  .delete(highlightController.deleteHighlight);

export default router;
