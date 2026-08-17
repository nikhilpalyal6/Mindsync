import logger from '../providers/embeddingProvider.js'; // Wait, let's import the default instance
import embeddingProvider from '../providers/embeddingProvider.js';
import winstonLogger from '../../config/logger.js';

class EmbeddingService {
  /**
   * Generates embeddings for chunks, handling batching, retries, and validation.
   * @param {Array<Object>} chunks - Array of chunk payloads.
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors.
   */
  async generateEmbeddings(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return [];
    }

    const batchSize = parseInt(process.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE, 10) || 50;
    const textsToEmbed = chunks.map(c => c.enrichedText || c.text);
    const results = [];

    winstonLogger.info(`[Embedding Service] Starting batch embedding generation for ${textsToEmbed.length} items (Batch Size: ${batchSize})`);

    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, i + batchSize);
      winstonLogger.info(`[Embedding Service] Dispatching embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(textsToEmbed.length / batchSize)}`);
      
      const batchVectors = await this._executeWithRetry(async () => {
        return await embeddingProvider.generateEmbeddings(batch);
      });

      // Validate batch response
      if (!Array.isArray(batchVectors) || batchVectors.length !== batch.length) {
        throw new Error(`Embedding response count mismatch. Expected ${batch.length}, received ${batchVectors?.length}`);
      }

      batchVectors.forEach((vector, idx) => {
        this._validateVector(vector);
      });

      results.push(...batchVectors);
    }

    // Double check overall dimension consistency
    if (results.length > 0) {
      const expectedDimension = results[0].length;
      results.forEach((v, idx) => {
        if (v.length !== expectedDimension) {
          throw new Error(`Inconsistent vector dimensions: expected ${expectedDimension}, found ${v.length} at index ${idx}`);
        }
      });
    }

    return results;
  }

  /**
   * Generates embedding for a single query text.
   * @param {string} text - Input text.
   * @returns {Promise<Array<number>>} The embedding vector.
   */
  async generateEmbedding(text) {
    if (!text || !text.trim()) {
      throw new Error('Text cannot be empty for embedding generation.');
    }
    return await this._executeWithRetry(async () => {
      return await embeddingProvider.generateEmbedding(text);
    });
  }

  async _executeWithRetry(fn) {
    const maxRetries = parseInt(process.env.KNOWLEDGE_MAX_RETRIES, 10) || 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const errorMsg = err.message || '';
        const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('RESOURCE_EXHAUSTED');
        
        winstonLogger.warn(`[Embedding Service] API attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);

        if (attempt === maxRetries) {
          throw err;
        }

        // Only retry if it is a rate limit or a transient error (timeout, network)
        const isTransient = isRateLimit || 
                            errorMsg.toLowerCase().includes('timeout') || 
                            errorMsg.toLowerCase().includes('fetch') || 
                            errorMsg.toLowerCase().includes('network') ||
                            errorMsg.toLowerCase().includes('503') ||
                            errorMsg.toLowerCase().includes('500');

        if (!isTransient) {
          // Permanent authentication/validation error: throw immediately
          winstonLogger.error(`[Embedding Service] Permanent error encountered. Skipping retries.`);
          throw err;
        }

        // Exponential backoff
        winstonLogger.info(`[Embedding Service] Backing off for ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  _validateVector(vector) {
    if (!Array.isArray(vector)) {
      throw new Error('Vector validation failed: embedding is not an array.');
    }
    if (vector.length === 0) {
      throw new Error('Vector validation failed: embedding array is empty.');
    }
    vector.forEach((val, idx) => {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`Vector validation failed: non-finite value found at index ${idx}`);
      }
    });
  }
}

export default new EmbeddingService();
