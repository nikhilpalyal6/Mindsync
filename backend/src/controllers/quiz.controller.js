import quizService from '../services/quiz/quiz.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class QuizController {
  generateQuiz = asyncHandler(async (req, res) => {
    const { studySessionId, resourceId, resourceType, forceRegenerate, quizType, difficulty, questionCount, topic, attemptMode, learningGoal } = req.body;
    const userId = req.user._id;

    const result = await quizService.generateQuiz({
      userId,
      studySessionId,
      resourceId,
      resourceType,
      forceRegenerate: Boolean(forceRegenerate),
      quizType,
      difficulty,
      questionCount,
      topic,
      attemptMode,
      learningGoal
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Quiz generated successfully')
    );
  });

  getQuiz = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const { studySessionId } = req.query;
    const userId = req.user._id;

    const result = await quizService.getQuiz({
      userId,
      studySessionId,
      resourceId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Quiz retrieved successfully')
    );
  });

  updateQuestionState = asyncHandler(async (req, res) => {
    const { resourceId, questionId } = req.params;
    const { studySessionId, selectedAnswer, attempted, bookmarked, reviewCount, isCorrect, questions, timeTaken, preferences } = req.body;
    const userId = req.user._id;

    const result = await quizService.updateQuestionState({
      userId,
      studySessionId,
      resourceId,
      questionId,
      selectedAnswer,
      attempted,
      bookmarked,
      reviewCount,
      isCorrect,
      questions,
      timeTaken,
      preferences
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Quiz state updated successfully')
    );
  });
}

export default new QuizController();
