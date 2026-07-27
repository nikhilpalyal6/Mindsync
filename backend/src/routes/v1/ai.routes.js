import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import aiController from '../../controllers/ai.controller.js';

const router = Router();

// Protect all AI routes
router.use(protect);

router.route('/conversations')
  .get(aiController.getConversations)
  .post(aiController.createConversation);

router.route('/conversations/:id')
  .patch(aiController.updateConversation)
  .delete(aiController.deleteConversation);

router.route('/messages')
  .get(aiController.getMessages)
  .post(aiController.sendMessage);

export default router;
