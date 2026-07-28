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

    const currentYoutubeMeta = session.metadata?.youtube;

    // Check Cache: Avoid duplicate transcript/metadata fetching if video URL matches and has valid transcript
    if (currentYoutubeMeta && currentYoutubeMeta.videoUrl === videoUrl && currentYoutubeMeta.transcript && currentYoutubeMeta.transcript.trim()) {
      logger.info(`[Transcript Loaded from Cache] Reusing stored transcript and metadata for session ${sessionId}`);
      
      if (currentYoutubeMeta.processingStatus !== 'completed') {
        currentYoutubeMeta.processingStatus = 'completed';
        session.markModified('metadata');
        await session.save();
      }

      logger.info(`[Response sent] Cached completed`);
      return res.status(200).json({
        success: true,
        data: {
          ...currentYoutubeMeta,
          processingStatus: 'completed'
        },
        cached: true
      });
    }

    logger.info('[Calling youtubeService.processVideo]');
    const youtubeData = await youtubeService.processVideo(videoUrl, currentYoutubeMeta);
    logger.info('[Finished youtubeService.processVideo]');

    const finalYoutubeData = {
      ...youtubeData,
      processingStatus: 'completed'
    };

    logger.info(`[Mongo save started] Session: ${sessionId}`);

    // Link YouTube resource using resourceService (appends, never overwrites)
    await resourceService.linkResourceToSession(session, {
      type: 'youtube',
      url: videoUrl,
      title: finalYoutubeData.title || 'YouTube Video',
      data: finalYoutubeData
    });

    const updateResult = await session.save();
    
    if (updateResult) {
      logger.info(`[Mongo save finished] Session: ${sessionId}`);
    } else {
      throw new Error('MongoDB save operation not acknowledged.');
    }

    const freshSession = await StudySession.findById(sessionId);
    const freshYoutubeData = freshSession?.metadata?.youtube || finalYoutubeData;

    logger.info(`[Response sent] Fresh completed`);
    return res.status(200).json({
      success: true,
      data: freshYoutubeData,
      cached: false
    });
  } catch (err) {
    logger.error(`[EXCEPTION IN fetchYouTubeData] Stack: ${err.stack}`);
    
    try {
      const session = await StudySession.findOne({ _id: sessionId, user: req.user._id });
      if (session) {
        session.metadata = {
          ...(session.metadata || {}),
          youtube: {
            videoUrl,
            processingStatus: 'failed',
            error: err.message
          }
        };
        session.markModified('metadata');
        await session.save();
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
