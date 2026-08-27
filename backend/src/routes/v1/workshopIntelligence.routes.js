import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import workshopIntelligenceController from '../../workshop/workshopIntelligence.controller.js';

const router = Router();

// Secure all workshop intelligence routes
router.use(protect);

router.route('/:workshopId/intelligence')
  .get(workshopIntelligenceController.getIntelligenceStatus);

router.route('/:workshopId/intelligence/resources')
  .get(workshopIntelligenceController.getWorkshopResources);

router.route('/:workshopId/intelligence/initialize')
  .post(workshopIntelligenceController.initializeIntelligence);

router.route('/:workshopId/intelligence/extract')
  .post(workshopIntelligenceController.extractKnowledge);

router.route('/:workshopId/intelligence/knowledge')
  .get(workshopIntelligenceController.getExtractedKnowledge);

router.route('/:workshopId/intelligence/relationships/extract')
  .post(workshopIntelligenceController.extractRelationships);

router.route('/:workshopId/intelligence/relationships')
  .get(workshopIntelligenceController.getRelationships);

router.route('/:workshopId/intelligence/graph')
  .get(workshopIntelligenceController.getWorkshopKnowledgeGraph);

router.route('/:workshopId/intelligence/insights')
  .get(workshopIntelligenceController.getWorkshopIntelligenceInsights);

export default router;
