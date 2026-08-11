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

    // Check Cache: Avoid duplicate transcript/metadata fetching if video URL matches and has valid transcript
    const existingRes = session.resources?.find(r => r.type === 'youtube' && r.url === videoUrl);
    if (existingRes && existingRes.data?.processingStatus === 'completed' && existingRes.data?.transcript) {
      logger.info(`[YouTube Loaded from Cache] Reusing stored transcript and metadata for session ${sessionId}`);
      return res.status(200).json({
        success: true,
        data: existingRes.data,
        cached: true
      });
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

    await session.save();

    // 3. Respond immediately to the client
    logger.info(`[Response sent immediately] Initial metadata linked for session: ${sessionId}`);
    res.status(200).json({
      success: true,
      data: initialYoutubeData,
      cached: false
    });

    // 4. Run Transcript extraction & Translation in the background asynchronously
    (async () => {
      try {
        logger.info(`[Background YouTube Ingestion] Starting processVideo for video: ${videoId}`);
        const youtubeData = await youtubeService.processVideo(videoUrl, initialYoutubeData);

        const finalYoutubeData = {
          ...youtubeData,
          processingStatus: 'completed'
        };

        const bgSession = await StudySession.findById(sessionId);
        if (bgSession) {
          const resIdx = bgSession.resources.findIndex(
            r => r.type === 'youtube' && r.url === videoUrl
          );
          if (resIdx > -1) {
            bgSession.resources[resIdx].data = finalYoutubeData;
            bgSession.markModified('resources');

            // Also update session.metadata.youtube if active
            if (bgSession.metadata?.youtube && (bgSession.metadata.youtube.videoId === videoId || bgSession.metadata.youtube.videoUrl === videoUrl)) {
              bgSession.metadata.youtube = finalYoutubeData;
              bgSession.markModified('metadata');
            }

            await bgSession.save();
            logger.info(`[Background YouTube Ingestion] Completed successfully for video: ${videoId}`);
          }
        }
      } catch (bgErr) {
        logger.error(`[Background YouTube Ingestion Error] Video: ${videoId}`, bgErr);
        try {
          const bgSession = await StudySession.findById(sessionId);
          if (bgSession) {
            const resIdx = bgSession.resources.findIndex(
              r => r.type === 'youtube' && r.url === videoUrl
            );
            if (resIdx > -1) {
              bgSession.resources[resIdx].data.processingStatus = 'failed';
              bgSession.resources[resIdx].data.error = bgErr.message;
              bgSession.markModified('resources');
              await bgSession.save();
            }
          }
        } catch (dbErr) {
          logger.error(`[Background YouTube Ingestion Fail-Save Error]`, dbErr);
        }
      }
    })();

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
