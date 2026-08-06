import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import aiController from '../../controllers/ai.controller.js';
import flashcardController from '../../controllers/flashcard.controller.js';
import quizController from '../../controllers/quiz.controller.js';
import explainController from '../../controllers/explain.controller.js';

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

// AI Flashcard Routes
router.route('/flashcards/generate')
  .post(flashcardController.generateFlashcards);

router.route('/flashcards/:resourceId')
  .get(flashcardController.getFlashcards);

router.route('/flashcards/:resourceId/cards/:cardId')
  .patch(flashcardController.updateFlashcardState);

// AI Quiz Routes
router.route('/quiz/generate')
  .post(quizController.generateQuiz);

router.route('/quiz/:resourceId')
  .get(quizController.getQuiz);

router.route('/quiz/:resourceId/question/:questionId')
  .patch(quizController.updateQuestionState);

// AI Explain Mode Routes
router.route('/explain')
  .post(explainController.generateExplanation);

router.route('/explain/:resourceId')
  .get(explainController.getExplanations);

router.route('/explain/:id')
  .patch(explainController.updateExplanationFeedback);

export default router;
