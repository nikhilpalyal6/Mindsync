import logger from '../../config/logger.js';
import youtubeTranscriptService from './youtubeTranscript.service.js';
import youtubeTranslationService from './youtubeTranslation.service.js';

class YouTubeService {
  /**
   * Extract 11-character YouTube Video ID from various URL formats
   */
  extractVideoId(url) {
    return youtubeTranscriptService.extractVideoId(url);
  }

  /**
   * Format seconds to HH:MM:SS or MM:SS timestamp
   */
  formatTime(seconds) {
    return youtubeTranscriptService.formatTime(seconds);
  }

  /**
   * Convert timestamp string (HH:MM:SS or MM:SS) to total seconds
   */
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  /**
   * Fetch Video Metadata via YouTube oEmbed & Watch Page Scraper
   */
  async fetchMetadata(videoId, videoUrl) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);

      if (response.ok) {
        const data = await response.json();
        logger.info(`[Video Metadata Loaded] Title: "${data.title}" (ID: ${videoId})`);

        return {
          videoId,
          videoUrl: videoUrl || `https://www.youtube.com/watch?v=${videoId}`,
          title: data.title || 'YouTube Educational Video',
          authorName: data.author_name || 'YouTube Creator',
          authorUrl: data.author_url || '',
          thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: 'Unknown',
          publishedDate: new Date().toISOString()
        };
      }
    } catch (err) {
      logger.warn(`[YouTube Service] Failed to fetch oEmbed metadata for ${videoId}: ${err.message}`);
    }

    // Fallback metadata
    logger.info(`[Video Metadata Loaded] Fallback metadata for ID: ${videoId}`);
    return {
      videoId,
      videoUrl: videoUrl || `https://www.youtube.com/watch?v=${videoId}`,
      title: 'YouTube Educational Video',
      authorName: 'YouTube Creator',
      authorUrl: '',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 'Unknown',
      publishedDate: new Date().toISOString()
    };
  }

  /**
   * Extract chapters from description or generate interval timestamps from transcript
   */
  extractOrGenerateChapters(descriptionText, transcriptItems) {
    // 1. Try extracting chapters from description
    if (descriptionText) {
      const timestampRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})\s+[-–—]?\s*([^\n]+)/g;
      const matches = [...descriptionText.matchAll(timestampRegex)];
      if (matches.length > 0) {
        const chapters = matches.map(m => ({
          time: m[1] ? `${m[1]}:${m[2]}:${m[3]}` : `${m[2]}:${m[3]}`,
          title: m[4].trim()
        }));
        logger.info(`[Chapters Generated] Extracted ${chapters.length} chapters from description`);
        return chapters;
      }
    }

    // 2. Generate interval checkpoints from transcript items if available
    if (transcriptItems && transcriptItems.length > 0) {
      const chapters = [];
      const intervalSec = 180; // Every 3 minutes
      let lastCheckpoint = -intervalSec;

      transcriptItems.forEach((item, index) => {
        const sec = item.seconds !== undefined ? item.seconds : this.parseTimeToSeconds(item.time);
        if (index === 0 || sec - lastCheckpoint >= intervalSec) {
          lastCheckpoint = sec;
          chapters.push({
            time: item.time || '00:00',
            title: index === 0 ? 'Introduction' : `Key Concept (${item.time})`
          });
        }
      });

      if (chapters.length > 0) {
        logger.info(`[Chapters Generated] Generated ${chapters.length} timestamp checkpoints from transcript`);
        return chapters;
      }
    }

    logger.info(`[Chapters Generated] Fallback default chapters set`);
    return [
      { time: '00:00', title: 'Introduction' },
      { time: '02:15', title: 'Main Topic' },
      { time: '05:30', title: 'Key Concepts' }
    ];
  }

  /**
   * Main Pipeline: Process YouTube Video URL, fetch metadata, transcript, chapters, and multilingual translation
   */
  async processVideo(videoUrl, existingYoutubeData = null) {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube video URL format.');
    }

    const metadata = await this.fetchMetadata(videoId, videoUrl);
    const transcriptResult = await youtubeTranscriptService.getTranscript(videoUrl, existingYoutubeData);
    const chapters = this.extractOrGenerateChapters('', transcriptResult.transcriptItems);

    const translationResult = await youtubeTranslationService.processTranslation({
      videoId,
      originalTranscript: transcriptResult.transcript,
      originalTranscriptItems: transcriptResult.transcriptItems,
      transcriptLanguageHint: transcriptResult.languageCode || null,
      existingYoutubeData
    });

    return {
      videoId,
      videoUrl,
      title: metadata.title,
      authorName: metadata.authorName,
      authorUrl: metadata.authorUrl,
      thumbnailUrl: metadata.thumbnailUrl,
      duration: metadata.duration,
      publishedDate: metadata.publishedDate,
      chapters,
      originalTranscript: translationResult.originalTranscript,
      originalTranscriptItems: translationResult.originalTranscriptItems,
      englishTranscript: translationResult.englishTranscript,
      englishTranscriptItems: translationResult.englishTranscriptItems,
      transcriptItems: translationResult.englishTranscriptItems || translationResult.originalTranscriptItems,
      transcript: translationResult.englishTranscript || translationResult.originalTranscript,
      transcriptLanguage: translationResult.transcriptLanguage,
      translationStatus: translationResult.translationStatus || 'completed',
      translated: translationResult.translated,
      translatedAt: translationResult.translatedAt,
      hasTranscript: transcriptResult.hasTranscript,
      transcriptMessage: transcriptResult.message || null,
      lastOpened: new Date().toISOString()
    };
  }
}

export default new YouTubeService();
