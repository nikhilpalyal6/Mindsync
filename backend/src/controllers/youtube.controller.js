import youtubeService from '../services/youtube/youtube.service.js';
import StudySession from '../models/studySession.model.js';
import resourceService from '../services/resource.service.js';
import logger from '../config/logger.js';

/**
 * @desc Fetch & process YouTube metadata, transcript, and chapters for a study session
 * @route POST /api/v1/study/:sessionId/youtube/fetch
 * @access Private
 */
export const fetchYouTubeData = async (req, res) => {
  const { sessionId } = req.params;
  const { videoUrl } = req.body;

  try {
    logger.info(`[START fetchYouTubeData] Session: ${sessionId}, Video URL: ${videoUrl}`);

    if (!videoUrl) {
      return res.status(400).json({ success: false, message: 'Video URL is required.' });
    }

    const session = await StudySession.findOne({ _id: sessionId, user: req.user._id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Study Session not found or unauthorized.' });
    }

    // Check Cache: Avoid duplicate transcript/metadata fetching if video URL matches and has valid transcript in Knowledge base
    const existingRes = session.resources?.find(r => r.type === 'youtube' && r.url === videoUrl);
    if (existingRes && existingRes.data?.processingStatus === 'completed') {
      const KnowledgeDocument = (await import('../models/knowledgeDocument.model.js')).default;
      const doc = await KnowledgeDocument.findOne({ userId: req.user._id, workspaceId: sessionId, resourceId: existingRes._id });
      if (doc && doc.processingStatus === 'READY') {
        logger.info(`[YouTube Loaded from Cache] Reusing stored transcript and metadata for session ${sessionId}`);
        const StudyService = (await import('../services/study.service.js')).default;
        const populatedSession = await StudyService.getSessionById(req.user._id, sessionId);
        const popRes = populatedSession.resources.find(r => r._id.toString() === existingRes._id.toString());
        return res.status(200).json({
          success: true,
          data: popRes ? popRes.data : existingRes.data,
          cached: true
        });
      }
    }

    const videoId = youtubeService.extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ success: false, message: 'Invalid YouTube video URL format.' });
    }

    // 1. Fetch metadata synchronously (extremely fast!)
    logger.info('[Calling youtubeService.fetchMetadata]');
    const metadata = await youtubeService.fetchMetadata(videoId, videoUrl);

    const initialYoutubeData = {
      videoId,
      videoUrl,
      title: metadata.title || 'YouTube Educational Video',
      authorName: metadata.authorName || 'YouTube Creator',
      authorUrl: metadata.authorUrl || '',
      thumbnailUrl: metadata.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 'Unknown',
      publishedDate: new Date().toISOString(),
      processingStatus: 'processing',
      chapters: [],
      transcriptItems: [],
      transcript: ''
    };

    // 2. Link YouTube resource synchronously
    await resourceService.linkResourceToSession(session, {
      type: 'youtube',
      url: videoUrl,
      title: initialYoutubeData.title,
      data: initialYoutubeData
    });

    // Save initial state atomically
    const newRes = session.resources.find(r => r.type === 'youtube' && r.url === videoUrl);
    const isNew = !existingRes;

    if (isNew) {
      await StudySession.updateOne(
        { _id: sessionId },
        {
          $push: { resources: newRes },
          $set: {
            metadata: session.metadata,
            videoCount: session.videoCount,
            youtubeCount: session.youtubeCount,
            pdfCount: session.pdfCount,
            notesCount: session.notesCount,
            resourceCount: session.resourceCount
          }
        }
      );
    } else {
      await StudySession.updateOne(
        { _id: sessionId, 'resources._id': existingRes._id },
        {
          $set: {
            'resources.$.data': newRes.data,
            'resources.$.title': newRes.title,
            metadata: session.metadata
          }
        }
      );
    }

    // 3. Respond immediately to the client
    logger.info(`[Response sent immediately] Initial metadata linked for session: ${sessionId}`);
    res.status(200).json({
      success: true,
      data: newRes.data,
      cached: false
    });

    // 4. Run Transcript extraction & Translation in the background asynchronously
    (async () => {
      try {
        logger.info(`[Background YouTube Ingestion] Starting processVideo for video: ${videoId}`);
        const youtubeData = await youtubeService.processVideo(videoUrl, initialYoutubeData);

        const strippedData = {
          videoId: youtubeData.videoId || videoId,
          videoUrl,
          title: youtubeData.title || initialYoutubeData.title,
          authorName: youtubeData.authorName || initialYoutubeData.authorName,
          authorUrl: youtubeData.authorUrl || initialYoutubeData.authorUrl,
          thumbnailUrl: youtubeData.thumbnailUrl || initialYoutubeData.thumbnailUrl,
          duration: youtubeData.duration || initialYoutubeData.duration,
          publishedDate: youtubeData.publishedDate || initialYoutubeData.publishedDate,
          processingStatus: 'completed'
        };

        const bgSession = await StudySession.findById(sessionId);
        if (bgSession) {
          const resIdx = bgSession.resources.findIndex(
            r => r.type === 'youtube' && r.url === videoUrl
          );
          if (resIdx > -1) {
            const resId = bgSession.resources[resIdx]._id;

            const updateFields = {
              'resources.$.data': strippedData
            };

            // Also update session.metadata.youtube if active
            if (bgSession.metadata?.youtube && (bgSession.metadata.youtube.videoId === videoId || bgSession.metadata.youtube.videoUrl === videoUrl)) {
              updateFields['metadata.youtube'] = strippedData;
            }

            await StudySession.updateOne(
              { _id: sessionId, 'resources._id': resId },
              { $set: updateFields }
            );

            // Save transcript content to Knowledge base (upsert KnowledgeDocument & KnowledgeChunks)
            const resourceService = (await import('../services/resource.service.js')).default;
            await resourceService._saveYoutubeContentToKnowledge(
              bgSession.user.toString(),
              sessionId.toString(),
              resId.toString(),
              youtubeData.title || initialYoutubeData.title,
              videoUrl,
              youtubeData
            );

            logger.info(`[Background YouTube Ingestion] Completed successfully for video: ${videoId}`);

            // Trigger safe fire-and-forget Knowledge Ingestion sidecar
            try {
              const processingService = (await import('../knowledge/services/processing.service.js')).default;
              processingService.queueProcessing(
                bgSession.user.toString(),
                sessionId.toString(),
                resId.toString(),
                youtubeData.transcript || '',
                'YOUTUBE',
                youtubeData.title || 'YouTube Educational Video'
              ).catch(keErr => logger.error(`[Background Knowledge Trigger Error] YouTube Ingestion failed: ${keErr.message}`));
            } catch (keErr) {
              logger.error(`[Background Knowledge Trigger Load Error] YouTube Ingestion failed: ${keErr.message}`);
            }
          }
        }
      } catch (bgErr) {
        logger.error(`[Background YouTube Ingestion Error] Video: ${videoId}`, bgErr);
        try {
          const StudySession = (await import('../models/studySession.model.js')).default;
          await StudySession.updateOne(
            { _id: sessionId, 'resources.url': videoUrl },
            {
              $set: {
                'resources.$.data.processingStatus': 'failed',
                'resources.$.data.error': bgErr.message
              }
            }
          );
        } catch (saveErr) {
          logger.error('[Background YouTube Ingestion Error Save] Failed to save error status:', saveErr);
        }
      }
    })();

  } catch (err) {
    logger.error(`[EXCEPTION IN fetchYouTubeData] Stack: ${err.stack}`);
    
    try {
      const session = await StudySession.findOne({ _id: sessionId, user: req.user._id });
      if (session) {
        const errorData = {
          videoUrl,
          processingStatus: 'failed',
          error: err.message
        };
        await StudySession.updateOne(
          { _id: sessionId },
          { $set: { 'metadata.youtube': errorData } }
        );
        logger.info(`[Mongo save failed status finished] Session: ${sessionId}`);
      }
    } catch (dbErr) {
      logger.error(`[DB Fail-Save Error] ${dbErr.stack}`);
    }

    const isClientError = err.message.includes('No transcript captions') || err.message.includes('Invalid YouTube');
    const statusCode = isClientError ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to process YouTube video data.',
      processingStatus: 'failed'
    });
  }
};

export default { fetchYouTubeData };
