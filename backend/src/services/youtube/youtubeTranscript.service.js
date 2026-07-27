import { YoutubeTranscript } from 'youtube-transcript';
import logger from '../../config/logger.js';

class YouTubeTranscriptService {
  /**
   * Extract 11-character YouTube Video ID from supported URL formats
   */
  extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  /**
   * Format seconds to HH:MM:SS or MM:SS timestamp
   */
  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  /**
   * Fetch and format transcript for a given YouTube URL or Video ID with MongoDB caching
   */
  async getTranscript(videoUrl, existingYoutubeData = null) {
    logger.info(`[DEBUG] Enter youtubeTranscript.service with URL: ${videoUrl}`);

    const videoId = this.extractVideoId(videoUrl);
    logger.info(`[DEBUG] Extracted videoId: ${videoId}`);

    if (!videoId) {
      logger.warn(`[YouTube Transcript] Invalid video URL: ${videoUrl}`);
      return {
        videoId: null,
        hasTranscript: false,
        transcriptItems: [],
        transcript: '',
        message: 'Invalid YouTube URL provided.'
      };
    }

    // 1. Check Cache: Return cached transcript if already fetched
    if (existingYoutubeData && existingYoutubeData.videoId === videoId && existingYoutubeData.transcript && existingYoutubeData.transcript.trim()) {
      logger.info(`[Transcript Loaded from Cache] Reusing cached transcript for ID: ${videoId} (Length: ${existingYoutubeData.transcript.length})`);
      return {
        videoId,
        hasTranscript: existingYoutubeData.hasTranscript !== false,
        transcriptItems: existingYoutubeData.transcriptItems || [],
        transcript: existingYoutubeData.transcript,
        cached: true
      };
    }

    logger.info(`[Transcript Fetch Started] Video ID: ${videoId}`);
    logger.info(`[DEBUG] Transcript request started for videoId: ${videoId}`);

    // 2. Fetch Transcript using youtube-transcript library with timedtext fallback
    try {
      const rawSegments = await YoutubeTranscript.fetchTranscript(videoId);
      logger.info(`[DEBUG] Transcript response received from youtube-transcript library. Raw segments count: ${rawSegments?.length || 0}`);

      if (rawSegments && rawSegments.length > 0) {
        const transcriptItems = rawSegments.map(seg => {
          const startSec = Math.floor((seg.offset || 0) / 1000);
          const rawText = (seg.text || '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();

          return {
            time: this.formatTime(startSec),
            seconds: startSec,
            text: rawText
          };
        }).filter(item => item.text.length > 0);

        const transcriptString = transcriptItems
          .map(item => `[${item.time}] ${item.text}`)
          .join('\n');

        logger.info(`[Transcript Fetched] Extracted ${transcriptItems.length} transcript segments`);
        logger.info(`[DEBUG] Transcript length: ${transcriptString.length} characters`);

        return {
          videoId,
          hasTranscript: true,
          transcriptItems,
          transcript: transcriptString,
          cached: false
        };
      }
    } catch (libraryErr) {
      logger.warn(`[DEBUG] youtube-transcript library failed for ${videoId}: ${libraryErr.message}. Attempting timedtext fallback... Stack: ${libraryErr.stack}`);
    }

    // 3. Fallback Timedtext Extraction
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      logger.info(`[DEBUG] Timedtext fallback fetch started for: ${watchUrl}`);
      const pageRes = await fetch(watchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const captionTrackMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionTrackMatch && captionTrackMatch[1]) {
          const captionTracks = JSON.parse(captionTrackMatch[1]);
          const track = captionTracks.find(t => t.languageCode === 'en' || t.languageCode?.startsWith('en')) || captionTracks[0];

          if (track && track.baseUrl) {
            const captionRes = await fetch(track.baseUrl);
            if (captionRes.ok) {
              const xml = await captionRes.text();
              const textMatches = [...xml.matchAll(/<text start="([\d\.]+)" dur="([\d\.]+)".*?>(.*?)<\/text>/g)];
              if (textMatches.length > 0) {
                const transcriptItems = textMatches.map(m => {
                  const startSec = parseFloat(m[1]);
                  const rawText = m[3]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/<[^>]*>/g, '');
                  return {
                    time: this.formatTime(startSec),
                    seconds: startSec,
                    text: rawText
                  };
                });

                const transcriptString = transcriptItems
                  .map(item => `[${item.time}] ${item.text}`)
                  .join('\n');

                logger.info(`[Transcript Fetched] Timedtext fallback extracted ${transcriptItems.length} transcript segments`);
                logger.info(`[DEBUG] Transcript length (fallback): ${transcriptString.length} characters`);

                return {
                  videoId,
                  hasTranscript: true,
                  transcriptItems,
                  transcript: transcriptString,
                  cached: false
                };
              }
            }
          }
        }
      }
    } catch (fallbackErr) {
      logger.error(`[DEBUG] Timedtext fallback error for ${videoId}: ${fallbackErr.message}. Stack: ${fallbackErr.stack}`);
    }

    // 4. Friendly Status for Unavailable Captions
    logger.info(`[Transcript Unavailable] No caption track found for ID: ${videoId}`);
    return {
      videoId,
      hasTranscript: false,
      transcriptItems: [],
      transcript: '',
      message: 'I can see the video, but no transcript is available yet.',
      cached: false
    };
  }
}

export default new YouTubeTranscriptService();
