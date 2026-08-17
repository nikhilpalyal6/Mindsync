class CitationService {
  /**
   * Deterministically builds citation references from chunk metadata.
   * @param {Object} chunk - The knowledge chunk record.
   * @param {string} resourceType - PDF or YOUTUBE.
   * @returns {Object} Citation reference object.
   */
  buildCitation(chunk, resourceType) {
    const type = (resourceType || 'PDF').toUpperCase();
    const metadata = chunk.metadata || {};

    if (type === 'PDF') {
      return {
        type: 'PDF',
        pageStart: typeof metadata.pageStart === 'number' ? metadata.pageStart : null,
        pageEnd: typeof metadata.pageEnd === 'number' ? metadata.pageEnd : null
      };
    } else if (type === 'YOUTUBE') {
      return {
        type: 'YOUTUBE',
        timestampStart: typeof metadata.timestampStart === 'number' ? metadata.timestampStart : null,
        timestampEnd: typeof metadata.timestampEnd === 'number' ? metadata.timestampEnd : null
      };
    }

    return {
      type: 'UNKNOWN',
      pageStart: null,
      pageEnd: null
    };
  }
}

export default new CitationService();
