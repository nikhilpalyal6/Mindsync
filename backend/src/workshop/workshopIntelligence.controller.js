import workshopIntelligenceService from './workshopIntelligence.service.js';
import ExtractedConcept from '../models/extractedConcept.model.js';
import ConceptRelationship from '../models/conceptRelationship.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class WorkshopIntelligenceController {
  /**
   * GET /workshops/:workshopId/intelligence
   */
  getIntelligenceStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const statusData = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workshopId, userId);

    res.set('Cache-Control', 'no-store');
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(statusData, 'Workshop intelligence status retrieved successfully.')
    );
  });

  /**
   * GET /workshops/:workshopId/intelligence/resources
   */
  getWorkshopResources = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const resources = await workshopIntelligenceService.getWorkshopResources(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(resources, 'Workshop resources inventory retrieved successfully.')
    );
  });

  /**
   * POST /workshops/:workshopId/intelligence/initialize
   */
  initializeIntelligence = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const intelligence = await workshopIntelligenceService.initializeWorkshopIntelligence(workshopId, userId);

    const responseData = {
      status: intelligence.status,
      version: intelligence.version,
      resourceCount: intelligence.resourceCount,
      processedResourceCount: intelligence.processedResourceCount
    };

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(responseData, 'Workshop intelligence initialized successfully.')
    );
  });

  /**
   * POST /workshops/:workshopId/intelligence/extract
   */
  extractKnowledge = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const intelligence = await workshopIntelligenceService.extractWorkshopKnowledge(workshopId, userId);
    const conceptCount = await ExtractedConcept.countDocuments({ workspaceId: workshopId, user: userId });

    const responseData = {
      status: intelligence.status,
      version: intelligence.version,
      resourceCount: intelligence.resourceCount,
      processedResourceCount: intelligence.processedResourceCount,
      conceptCount
    };

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(responseData, 'Workshop knowledge extraction completed successfully.')
    );
  });

  /**
   * GET /workshops/:workshopId/intelligence/knowledge
   */
  getExtractedKnowledge = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const knowledge = await workshopIntelligenceService.getExtractedKnowledge(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(knowledge, 'Workshop extracted knowledge retrieved successfully.')
    );
  });

  /**
   * POST /workshops/:workshopId/intelligence/relationships/extract
   */
  extractRelationships = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const result = await workshopIntelligenceService.extractConceptRelationships(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Workshop concept relationships extraction completed successfully.')
    );
  });

  /**
   * GET /workshops/:workshopId/intelligence/relationships
   */
  getRelationships = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const result = await workshopIntelligenceService.getConceptRelationships(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(result, 'Workshop concept relationships retrieved successfully.')
    );
  });

  /**
   * GET /workshops/:workshopId/intelligence/graph
   */
  getWorkshopKnowledgeGraph = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const graph = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(graph, 'Workshop knowledge graph retrieved successfully.')
    );
  });

  /**
   * GET /workshops/:workshopId/intelligence/insights
   */
  getWorkshopIntelligenceInsights = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workshopId } = req.params;

    const insights = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workshopId, userId);

    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(insights, 'Workshop intelligence insights retrieved successfully.')
    );
  });
}

export default new WorkshopIntelligenceController();
