import flashcardService from '../services/flashcard/flashcard.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class FlashcardController {
  generateFlashcards = asyncHandler(async (req, res) => {
    const { studySessionId, resourceId, resourceType, forceRegenerate } = req.body;
    const userId = req.user._id;

    const result = await flashcardService.generateFlashcards({
      userId,
      studySessionId,
      resourceId,
      resourceType,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Flashcards generated successfully')
    );
  });

  getFlashcards = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const { studySessionId } = req.query;
    const userId = req.user._id;

    const result = await flashcardService.getFlashcards({
      userId,
      studySessionId,
      resourceId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Flashcards retrieved successfully')
    );
  });

  updateFlashcardState = asyncHandler(async (req, res) => {
    const { resourceId, cardId } = req.params;
    const { studySessionId, bookmarked, incrementReview } = req.body;
    const userId = req.user._id;

    const result = await flashcardService.updateFlashcardState({
      userId,
      studySessionId,
      resourceId,
      cardId,
      bookmarked,
      incrementReview: Boolean(incrementReview)
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Flashcard state updated successfully')
    );
  });
}

export default new FlashcardController();
