import logger from '../../config/logger.js';

class ChunkingService {
  /**
   * Chunks a normalized canonical document.
   * @param {Object} doc - Canonical document object { text, pages, sections }.
   * @param {Object} options - { title, type } for context enrichment.
   * @returns {Array<Object>} Array of raw chunk payloads (without embeddings).
   */
  chunk(doc, { title, type }) {
    if (!doc || !Array.isArray(doc.pages)) {
      throw new Error('Invalid document structure for chunking');
    }

    const chunkSize = parseInt(process.env.KNOWLEDGE_CHUNK_SIZE, 10) || 800;
    const overlap = parseInt(process.env.KNOWLEDGE_CHUNK_OVERLAP, 10) || 120;
    const resType = (type || 'PDF').toUpperCase();

    logger.info(`[Chunking Service] Chunking document: "${title}" (Type: ${resType}, ChunkSize: ${chunkSize}, Overlap: ${overlap})`);

    if (resType === 'PDF') {
      return this._chunkPdf(doc, title, chunkSize, overlap);
    } else {
      return this._chunkYouTube(doc, title, chunkSize, overlap);
    }
  }

  _chunkPdf(doc, title, chunkSize, overlap) {
    const chunks = [];
    let chunkIndex = 0;

    const maxPages = doc.pageCount || (doc.pages.length > 0 ? Math.max(...doc.pages.map(p => p.pageNumber).filter(n => typeof n === 'number' && !isNaN(n))) : 0);

    doc.pages.forEach(page => {
      const pageNum = page.pageNumber;
      if (typeof pageNum !== 'number' || isNaN(pageNum) || pageNum < 1 || (maxPages > 0 && pageNum > maxPages)) {
        logger.warn(`[Chunking Service] Skipping page with invalid or out-of-bounds pageNumber: ${pageNum} (max pages: ${maxPages})`);
        return;
      }
      const text = this._normalizeWhitespace(page.text || '');
      if (!text) return;

      // Split page text into sentences
      const sentences = this._splitIntoSentences(text);
      let currentChunkText = '';
      let currentSentences = [];

      for (const sentence of sentences) {
        if ((currentChunkText + ' ' + sentence).trim().length <= chunkSize) {
          currentChunkText = (currentChunkText + ' ' + sentence).trim();
          currentSentences.push(sentence);
        } else {
          if (currentChunkText) {
            chunks.push(this._createPdfChunk(
              currentChunkText,
              title,
              pageNum,
              pageNum,
              chunkIndex++,
              doc.contentHash || ''
            ));
          }

          // Build overlap from end of current sentences
          currentSentences = this._buildOverlapSentences(currentSentences, sentence, overlap);
          currentChunkText = currentSentences.join(' ');
        }
      }

      // Add trailing chunk if it contains text
      if (currentChunkText.trim()) {
        chunks.push(this._createPdfChunk(
          currentChunkText,
          title,
          pageNum,
          pageNum,
          chunkIndex++,
          doc.contentHash || ''
        ));
      }
    });

    return chunks;
  }

  _chunkYouTube(doc, title, chunkSize, overlap) {
    const chunks = [];
    let chunkIndex = 0;

    let currentChunkText = '';
    let startSec = null;
    let endSec = null;
    let segmentBatch = [];

    doc.pages.forEach(seg => {
      const segText = seg.text || '';
      const segStart = seg.timestampStart !== undefined ? seg.timestampStart : 0;
      const segEnd = seg.timestampEnd !== undefined ? seg.timestampEnd : segStart + 5;

      if (startSec === null) {
        startSec = segStart;
      }
      endSec = segEnd;

      if ((currentChunkText + ' ' + segText).trim().length <= chunkSize) {
        currentChunkText = (currentChunkText + ' ' + segText).trim();
        segmentBatch.push(seg);
      } else {
        if (currentChunkText) {
          chunks.push(this._createYouTubeChunk(
            currentChunkText,
            title,
            startSec,
            endSec,
            chunkIndex++,
            doc.contentHash || ''
          ));
        }

        // Apply overlap by shifting segment batches back
        segmentBatch = this._buildOverlapSegments(segmentBatch, seg, overlap);
        currentChunkText = segmentBatch.map(s => s.text).join(' ');
        startSec = segmentBatch.length > 0 ? segmentBatch[0].timestampStart : segStart;
        endSec = segEnd;
      }
    });

    if (currentChunkText.trim()) {
      chunks.push(this._createYouTubeChunk(
        currentChunkText,
        title,
        startSec,
        endSec,
        chunkIndex++,
        doc.contentHash || ''
      ));
    }

    return chunks;
  }

  _createPdfChunk(text, title, pageStart, pageEnd, chunkIndex, contentHash) {
    const enrichedText = `Document: ${title}\nPage: ${pageStart}\n---\n${text}`;
    return {
      text,
      enrichedText,
      metadata: {
        pageStart,
        pageEnd,
        section: '',
        heading: ''
      },
      chunkIndex,
      contentHash
    };
  }

  _createYouTubeChunk(text, title, timestampStart, timestampEnd, chunkIndex, contentHash) {
    const formattedStart = this._formatTime(timestampStart);
    const formattedEnd = this._formatTime(timestampEnd);
    const enrichedText = `Document: ${title}\nTimestamp: ${formattedStart}-${formattedEnd}\n---\n${text}`;
    return {
      text,
      enrichedText,
      metadata: {
        timestampStart,
        timestampEnd,
        section: '',
        heading: ''
      },
      chunkIndex,
      contentHash
    };
  }

  _normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  _splitIntoSentences(text) {
    // Simple sentence splitter matching standard punctuation
    const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (!matches) return [text];
    return matches.map(s => s.trim());
  }

  _buildOverlapSentences(currentSentences, newSentence, overlapSize) {
    const result = [];
    let lengthSum = newSentence.length;
    result.unshift(newSentence);

    for (let i = currentSentences.length - 1; i >= 0; i--) {
      const sentence = currentSentences[i];
      if (lengthSum + sentence.length + 1 <= overlapSize) {
        result.unshift(sentence);
        lengthSum += sentence.length + 1;
      } else {
        break;
      }
    }
    return result;
  }

  _buildOverlapSegments(currentSegments, newSegment, overlapSize) {
    const result = [];
    let lengthSum = (newSegment.text || '').length;
    result.unshift(newSegment);

    for (let i = currentSegments.length - 1; i >= 0; i--) {
      const seg = currentSegments[i];
      const textLen = (seg.text || '').length;
      if (lengthSum + textLen + 1 <= overlapSize) {
        result.unshift(seg);
        lengthSum += textLen + 1;
      } else {
        break;
      }
    }
    return result;
  }

  _formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
  }
}

export default new ChunkingService();
