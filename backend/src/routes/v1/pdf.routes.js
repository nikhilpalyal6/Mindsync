import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import pdfChatController from '../../controllers/pdfChat.controller.js';

const router = Router();

// Protect all PDF routes
router.use(protect);

router.route('/chat')
  .get(pdfChatController.getPDFChatHistory)
  .post(pdfChatController.sendPDFChatMessage);

export default router;
