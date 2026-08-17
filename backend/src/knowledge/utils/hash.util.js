import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of a string.
 * @param {string} content - The text content to hash.
 * @returns {string} The hex encoded hash.
 */
export const generateContentHash = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  return crypto.createHash('sha256').update(content).digest('hex');
};

export default {
  generateContentHash
};
