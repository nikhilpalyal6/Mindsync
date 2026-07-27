import youtubeService from '../services/youtube/youtube.service.js';
import StudySession from '../models/studySession.model.js';
import logger from '../config/logger.js';

/**
 * @desc Fetch & process YouTube metadata, transcript, and chapters for a study session
 * @route POST /api/v1/study/:sessionId/youtube/fetch
 * @access Private
 */
export const fetchYouTubeData = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, message: 'Video URL is required.' });
    }

    const session = await StudySession.findOne({ _id: sessionId, user: req.user._id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Study Session not found or unauthorized.' });
    }

    const currentYoutubeMeta = session.metadata?.youtube;

    // Check Cache: Avoid duplicate transcript/metadata fetching if video URL matches and has valid completed transcript
    if (currentYoutubeMeta && currentYoutubeMeta.videoUrl === videoUrl && currentYoutubeMeta.transcript && currentYoutubeMeta.transcript.trim() && currentYoutubeMeta.processingStatus === 'completed') {
      logger.info(`[Transcript Loaded from Cache] Reusing stored transcript and metadata for session ${sessionId}`);
      return res.status(200).json({
        success: true,
        data: {
          ...currentYoutubeMeta,
          processingStatus: 'completed'
        },
        cached: true
      });
    }

    logger.info(`[Transcript Processing Started] Processing video data for URL: ${videoUrl}`);
    const youtubeData = await youtubeService.processVideo(videoUrl, currentYoutubeMeta);

    const finalYoutubeData = {
      ...youtubeData,
      processingStatus: youtubeData.hasTranscript !== false ? 'completed' : 'completed'
    };

    // Save metadata, transcript, and chapters to MongoDB metadata
    const updatedMetadata = {
      ...(session.metadata || {}),
      youtube: finalYoutubeData,
      activeResourceType: 'youtube',
      lastTab: 'youtube'
    };

    logger.info(`[DEBUG] MongoDB save started for session: ${sessionId}`);
    session.metadata = updatedMetadata;
    session.markModified('metadata');
    await session.save();
    logger.info(`[DEBUG] MongoDB save successful for session: ${sessionId}`);

    logger.info(`[Transcript Processing Completed] Processed transcript and chapters for session ${sessionId}`);
    logger.info(`[Workshop Updated] Updated session ${sessionId} with YouTube intelligence`);

    return res.status(200).json({
      success: true,
      data: finalYoutubeData,
      cached: false
    });
  } catch (err) {
    logger.error(`[YouTube Controller Error] ${err.message} - Stack: ${err.stack}`);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to process YouTube video data.',
      processingStatus: 'failed'
    });
  }
};

export default { fetchYouTubeData };
