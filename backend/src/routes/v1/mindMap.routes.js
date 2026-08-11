import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import mindMapController from '../../controllers/mindMap.controller.js';

const router = Router();

// Protect all mind map endpoints
router.use(protect);

router.route('/workspace/:workspaceId')
  .get(mindMapController.getMindMapByWorkspace);

router.route('/workspace/:workspaceId/generate')
  .post(mindMapController.generateMindMap);

export default router;
