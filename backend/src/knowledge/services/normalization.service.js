import logger from '../../config/logger.js';

class NormalizationService {
  /**
   * Normalizes a resource into a canonical document structure.
   * @param {Object} resource - The raw resource object from StudySession.resources.
   * @returns {Object} Canonical document contents { text, pages, sections }.
   */
  normalize(resource) {
    if (!resource || !resource.type) {
      throw new Error('Invalid resource provided for normalization');
    }

    const type = resource.type.toUpperCase();

    if (type === 'PDF') {
      return this._normalizePdf(resource);
    } else if (type === 'YOUTUBE') {
      return this._normalizeYouTube(resource);
    } else {
      throw new Error(`Unsupported resource type for normalization: ${type}`);
    }
  }

  _normalizePdf(resource) {
    logger.info(`[Normalization Service] Normalizing PDF resource: "${resource.title || resource.url}"`);
    
    // SAFE DIAGNOSTIC LOGGING
    try {
      const textLen = resource.data?.extractedText?.length || 0;
      const pageCount = Array.isArray(resource.data?.pages) ? resource.data.pages.length : 0;
      logger.info(`[Normalization Service] PDF details - Text Length: ${textLen}, Pages Count: ${pageCount}`);
    } catch (logErr) {
      logger.error(`[Normalization Diagnostic Error] Failed to write log: ${logErr.message}`);
    }

    const data = resource.data || {};
    
    // Extract full text
    const text = data.extractedText || '';
    
    // Extract page-by-page mapping
    const pages = [];
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      data.pages.forEach(p => {
        pages.push({
          pageNumber: p.pageNumber || 1,
          text: p.text || ''
        });
      });
    } else if (text) {
      // Fallback: single page if pages array is empty but text exists
      pages.push({
        pageNumber: 1,
        text: text
      });
    }

    return {
      text,
      pages,
      sections: [] // Placeholder for future headers/sections
    };
  }

  _normalizeYouTube(resource) {
    logger.info(`[Normalization Service] Normalizing YouTube resource: "${resource.title || resource.url}"`);
    const data = resource.data || {};

    const text = data.transcript || '';
    const pages = []; // For YouTube, we map transcript segments as pages containing timestamp starts and ends

    if (Array.isArray(data.transcriptItems) && data.transcriptItems.length > 0) {
      data.transcriptItems.forEach((item, index) => {
        const nextItem = data.transcriptItems[index + 1];
        const startSec = item.seconds !== undefined ? item.seconds : 0;
        const endSec = nextItem && nextItem.seconds !== undefined ? nextItem.seconds : startSec + 10; // estimate 10s if last item

        pages.push({
          pageNumber: index + 1, // sequential identifier
          timestampStart: startSec,
          timestampEnd: endSec,
          text: item.text || ''
        });
      });
    } else if (text) {
      pages.push({
        pageNumber: 1,
        timestampStart: 0,
        timestampEnd: data.duration ? parseInt(data.duration, 10) || 60 : 60,
        text: text
      });
    }

    return {
      text,
      pages,
      sections: []
    };
  }
}

export default new NormalizationService();
