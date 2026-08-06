import explainService from '../services/explain.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class ExplainController {
  generateExplanation = asyncHandler(async (req, res) => {
    const { concept, resourceId, studySessionId, difficulty, mode } = req.body;
    const userId = req.user._id;

    const result = await explainService.explainConcept({
      userId,
      concept,
      resourceId,
      studySessionId,
      difficulty,
      mode
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Explanation generated successfully')
    );
  });

  getExplanations = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const { studySessionId } = req.query;
    const userId = req.user._id;

    const result = await explainService.getExplanations({
      userId,
      resourceId,
      studySessionId
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Explanations retrieved successfully')
    );
  });

  updateExplanationFeedback = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { resourceId, studySessionId, feedback } = req.body;
    const userId = req.user._id;

    const result = await explainService.updateFeedback({
      userId,
      explanationId: id,
      resourceId,
      studySessionId,
      feedback
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Feedback updated successfully')
    );
  });
}

export default new ExplainController();
