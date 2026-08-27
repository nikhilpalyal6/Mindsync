import studyService from '../services/study.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import mindMapService from '../services/mindMap.service.js';
import MindMap from '../models/mindMap.model.js';
import logger from '../config/logger.js';
import fs from 'fs';
import ApiError from '../utils/ApiError.js';

class StudyController {
  getSessions = asyncHandler(async (req, res) => {
    console.log('[DEBUG CONTROLLER] Entering getSessions. User ID:', req.user._id);
    const { search } = req.query;
    const userId = req.user._id;

    console.log('[DEBUG CONTROLLER] Calling studyService.getSessions...');
    const sessions = await studyService.getSessions(userId, { search });
    console.log('[DEBUG CONTROLLER] studyService.getSessions returned. Count:', sessions?.length);

    // One-time automatic backfill for workspace learning maps (Step 28)
    if (process.env.AUTOMATIC_MIND_MAP_GENERATION === 'true' && sessions && Array.isArray(sessions)) {
      (async () => {
        try {
          for (const sess of sessions) {
            const hasValidContent = (sess.resources || []).some(r => {
              const text = r.data?.extractedText || r.data?.transcript || r.data?.content || r.data?.noteContent || r.data?.notesContent || '';
              return text && text.trim().length > 0;
            });
            if (hasValidContent) {
              const existing = await MindMap.findOne({ user: userId, workspaceId: sess._id.toString() });
              if (!existing) {
                logger.info(`[Workspace MindMap Backfill] Auto-generating missing mind map for workspace: ${sess.title}`);
                mindMapService.generateWorkspaceMindMapBackground(
                  userId.toString(),
                  sess._id.toString(),
                  sess.title,
                  sess.resources || []
                ).catch(err => logger.error(`[Workspace MindMap Backfill] Error: ${err.message}`));
              }
            }
          }
        } catch (e) {
          logger.error(`[Workspace MindMap Backfill] Failed: ${e.message}`);
        }
      })();
    }

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(sessions, 'Study sessions retrieved successfully')
    );
  });

  getSessionById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('[DEBUG CONTROLLER] Entering getSessionById. User ID:', userId, 'Session ID:', id);
    const session = await studyService.getSessionById(userId, id);

    // One-time automatic backfill for workspace learning maps (Step 28)
    if (process.env.AUTOMATIC_MIND_MAP_GENERATION === 'true' && session && session.resources && Array.isArray(session.resources)) {
      (async () => {
        try {
          const hasValidContent = (session.resources || []).some(r => {
            const text = r.data?.extractedText || r.data?.transcript || r.data?.content || r.data?.noteContent || r.data?.notesContent || '';
            return text && text.trim().length > 0;
          });
          if (hasValidContent) {
            const existing = await MindMap.findOne({ user: userId, workspaceId: session._id.toString() });
            if (!existing) {
              logger.info(`[Workspace MindMap Backfill] Auto-generating missing mind map for workspace: ${session.title}`);
              mindMapService.generateWorkspaceMindMapBackground(
                userId.toString(),
                session._id.toString(),
                session.title,
                session.resources || []
              ).catch(err => logger.error(`[Workspace MindMap Backfill] Error: ${err.message}`));
            }
          }
        } catch (e) {
          logger.error(`[Workspace MindMap Backfill] Failed: ${e.message}`);
        }
      })();
    }

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Study session retrieved successfully')
    );
  });

  createSession = asyncHandler(async (req, res) => {
    const { title, description, metadata } = req.body;
    const userId = req.user._id;

    const session = await studyService.createSession(userId, {
      title,
      description,
      metadata
    });

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success(session, 'Study session created successfully')
    );
  });

  updateSession = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await studyService.updateSession(userId, id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Study session updated successfully')
    );
  });

  deleteSession = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    await studyService.deleteSession(userId, id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(null, 'Study session deleted successfully')
    );
  });

  deleteResource = asyncHandler(async (req, res) => {
    const { sessionId, resourceId } = req.params;
    const userId = req.user._id;

    const session = await studyService.deleteResource(userId, sessionId, resourceId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Resource deleted successfully')
    );
  });

  getResources = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const resources = await studyService.getResources(userId, sessionId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(resources, 'Resources retrieved successfully')
    );
  });

  addResource = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await studyService.addResource(userId, sessionId, req.body);

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse.success(session, 'Resource added successfully')
    );
  });

  renameResource = asyncHandler(async (req, res) => {
    const { sessionId, resourceId } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    const session = await studyService.renameResource(userId, sessionId, resourceId, title);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Resource renamed successfully')
    );
  });

  replaceResource = asyncHandler(async (req, res) => {
    const { sessionId, resourceId } = req.params;
    const userId = req.user._id;

    const session = await studyService.replaceResource(userId, sessionId, resourceId, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(session, 'Resource replaced successfully')
    );
  });

  getActivities = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const activities = await studyService.getActivities(userId);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(activities, 'Study activities retrieved successfully')
    );
  });

  uploadPdfResource = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Please upload a PDF file.');
    }

    // 1. Verify workspace ownership
    const StudySession = (await import('../models/studySession.model.js')).default;
    const session = await StudySession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      // Clean up multer temporary file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this study workspace.');
    }

    try {
      const storagePath = req.file.path.replace(/\\/g, '/');
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

      const initialPdfMeta = {
        filename: req.file.originalname,
        pdfFilename: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        storagePath: storagePath,
        pageNumber: 1,
        scale: 1.0,
        fitMode: 'page',
        lastOpened: new Date().toISOString(),
        processingStatus: 'processing',
        pageCount: 0,
        totalPages: 0,
        pages: []
      };

      const updatedSession = await studyService.addResource(userId, sessionId, {
        type: 'pdf',
        url: req.file.originalname,
        title: req.file.originalname,
        data: initialPdfMeta
      });

      // Respond immediately to the client
      res.status(HTTP_STATUS.CREATED).json(
        ApiResponse.success(updatedSession, 'PDF uploaded and resource created successfully.')
      );

      // Run AI Text Extraction in the background asynchronously
      (async () => {
        try {
          logger.info(`[Background PDF Ingestion] Starting text extraction for session: ${sessionId}, file: ${req.file.originalname}`);
          const pdfExtractorService = (await import('../services/pdf/pdfExtractor.service.js')).default;
          const extractedText = await pdfExtractorService.extractTextFromBase64(dataUrl);

          const pages = [];
          const pageRegex = /\[Page\s+(\d+)\]/gi;
          let match;
          const pagePositions = [];

          while ((match = pageRegex.exec(extractedText)) !== null) {
            pagePositions.push({
              pageNumber: parseInt(match[1], 10),
              index: match.index,
              headerLength: match[0].length
            });
          }

          if (pagePositions.length === 0) {
            pages.push({
              pageNumber: 1,
              text: extractedText,
              extractionStatus: 'completed',
              wordCount: extractedText.split(/\s+/).filter(Boolean).length
            });
          } else {
            for (let i = 0; i < pagePositions.length; i++) {
              const current = pagePositions[i];
              const next = pagePositions[i + 1];
              const startIdx = current.index + current.headerLength;
              const endIdx = next ? next.index : extractedText.length;
              const text = extractedText.substring(startIdx, endIdx).trim();

              pages.push({
                pageNumber: current.pageNumber,
                text: text,
                extractionStatus: 'completed',
                wordCount: text.split(/\s+/).filter(Boolean).length
              });
            }
          }

          const totalPages = pages.length;

          const StudySession = (await import('../models/studySession.model.js')).default;
          const bgSession = await StudySession.findById(sessionId);
          if (bgSession) {
            const resIdx = bgSession.resources.findIndex(
              r => r.type === 'pdf' && (r.title === req.file.originalname || r.url === req.file.originalname)
            );
            if (resIdx > -1) {
              const resId = bgSession.resources[resIdx]._id;

              const updateFields = {
                'resources.$.data.pageCount': totalPages,
                'resources.$.data.totalPages': totalPages,
                'resources.$.data.processedPages': totalPages,
                'resources.$.data.successfulPages': totalPages,
                'resources.$.data.failedPages': 0,
                'resources.$.data.extractionStatus': 'completed',
                'resources.$.data.processingStatus': 'completed',
                'resources.$.data.pages': pages
              };

              // If it's the active PDF in metadata, sync it
              if (bgSession.metadata?.pdf && (bgSession.metadata.pdf.filename === req.file.originalname || bgSession.metadata.pdf._id?.toString() === resId.toString())) {
                updateFields['metadata.pdf'] = {
                  ...bgSession.metadata.pdf,
                  pageCount: totalPages,
                  totalPages,
                  processingStatus: 'completed'
                };
              }

              await StudySession.updateOne(
                { _id: sessionId, 'resources._id': resId },
                { $set: updateFields }
              );

              // Save to Knowledge base (KnowledgeDocument & KnowledgeChunks)
              const resourceService = (await import('../services/resource.service.js')).default;
              await resourceService._savePdfContentToKnowledge(
                userId.toString(),
                sessionId.toString(),
                resId.toString(),
                req.file.originalname,
                req.file.originalname,
                extractedText,
                pages
              );

              logger.info(`[Background PDF Ingestion] Completed successfully for file: ${req.file.originalname}`);

              // Trigger safe fire-and-forget Knowledge Ingestion sidecar
              try {
                const processingService = (await import('../knowledge/services/processing.service.js')).default;
                processingService.queueProcessing(
                  userId.toString(),
                  sessionId.toString(),
                  resId.toString(),
                  extractedText,
                  'PDF',
                  req.file.originalname
                ).catch(keErr => logger.error(`[Background Knowledge Trigger Error] PDF Ingestion failed: ${keErr.message}`));
              } catch (keErr) {
                logger.error(`[Background Knowledge Trigger Load Error] PDF Ingestion failed: ${keErr.message}`);
              }
            }
          }
        } catch (bgErr) {
          logger.error(`[Background PDF Ingestion Error] File: ${req.file.originalname}`, bgErr);
          try {
            const StudySession = (await import('../models/studySession.model.js')).default;
            const bgSession = await StudySession.findById(sessionId);
            let resId = null;
            if (bgSession) {
              const resIdx = bgSession.resources.findIndex(
                r => r.type === 'pdf' && (r.title === req.file.originalname || r.url === req.file.originalname)
              );
              if (resIdx > -1) {
                resId = bgSession.resources[resIdx]._id;
              }
            }

            await StudySession.updateOne(
              { _id: sessionId, 'resources.url': req.file.originalname },
              {
                $set: {
                  'resources.$.data.processingStatus': 'failed',
                  'resources.$.data.error': bgErr.message
                }
              }
            );

            if (resId) {
              const KnowledgeJob = (await import('../models/knowledgeJob.model.js')).default;
              await KnowledgeJob.findOneAndUpdate(
                { userId, workspaceId: sessionId, resourceId: resId },
                {
                  $set: {
                    status: 'FAILED',
                    progress: 0,
                    errorCode: bgErr.code || 'AI_EXTRACTION_UNAVAILABLE',
                    errorMessage: bgErr.message,
                    attempts: 1,
                    completedAt: new Date()
                  }
                },
                { upsert: true }
              );
            }
          } catch (saveErr) {
            logger.error('[Background PDF Ingestion Error Save] Failed to save error status:', saveErr);
          }
        }
      })();

    } catch (err) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw err;
    }
  });

  getPdfFile = asyncHandler(async (req, res) => {
    const { sessionId, resourceId } = req.params;
    const userId = req.user._id;

    const StudySession = (await import('../models/studySession.model.js')).default;
    const session = await StudySession.findOne({ _id: sessionId, user: userId }).lean();
    if (!session) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this study workspace.');
    }

    console.log(`[PDF] Requested:\nworkspace=${sessionId}\nresource=${resourceId}`);

    const resource = session.resources?.find(
      r => r._id?.toString() === resourceId || r.url === resourceId
    );
    if (!resource || resource.type !== 'pdf') {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'PDF resource not found in workspace.');
    }

    const storagePath = resource.data?.storagePath;
    if (!storagePath) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'PDF storage path not set.');
    }

    console.log(`[PDF] Resolved:\nresource=${resource._id?.toString()}\nstoragePath=${storagePath}\nfilename=${resource.title || resource.url}`);

    const path = await import('path');
    const fs = await import('fs');
    const fileURLToPath = (await import('url')).fileURLToPath;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const backendDir = path.resolve(__dirname, '../../');
    const absPath = path.resolve(backendDir, storagePath);

    if (!fs.existsSync(absPath)) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'PDF file not found on disk.');
    }

    const fileBuffer = fs.readFileSync(absPath);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${resource.data.fileType || 'application/pdf'};base64,${base64Data}`;

    res.status(HTTP_STATUS.OK).json(
      ApiResponse.success({ fileData: dataUrl }, 'PDF file loaded successfully.')
    );
  });
}

export default new StudyController();
