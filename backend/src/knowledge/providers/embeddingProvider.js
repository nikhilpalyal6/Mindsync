import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../config/logger.js';
import { aiRouterConfig } from '../../config/aiRouter.config.js';

class GeminiEmbeddingProvider {
  constructor() {
    this._client = null;
  }

  _getClient() {
    if (this._client) return this._client;

    const apiKey = aiRouterConfig.providers.gemini.apiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured for embeddings.');
    }
    this._client = new GoogleGenerativeAI(apiKey);
    return this._client;
  }

  /**
   * Generates embedding for a single text.
   * @param {string} text - The input text.
   * @returns {Promise<Array<number>>} The embedding vector.
   */
  async generateEmbedding(text) {
    if (!text || !text.trim()) {
      throw new Error('Text cannot be empty for embedding generation.');
    }

    const modelName = process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001';
    logger.info(`[Gemini Embedding Provider] Generating single embedding using model: ${modelName}`);

    const client = this._getClient();
    const model = client.getGenerativeModel({ model: modelName });
    
    const result = await model.embedContent(text);
    if (!result || !result.embedding || !Array.isArray(result.embedding.values)) {
      throw new Error('Failed to retrieve embedding values from Gemini response.');
    }

    return result.embedding.values;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param {Array<string>} texts - The input texts.
   * @returns {Promise<Array<Array<number>>>} The embedding vectors.
   */
  async generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array for batch embedding generation.');
    }

    const modelName = process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001';
    logger.info(`[Gemini Embedding Provider] Batch generating ${texts.length} embeddings using model: ${modelName}`);

    const client = this._getClient();
    const model = client.getGenerativeModel({ model: modelName });

    const result = await model.batchEmbedContents({
      requests: texts.map(t => ({
        content: { parts: [{ text: t }] }
      }))
    });

    if (!result || !Array.isArray(result.embeddings)) {
      throw new Error('Failed to retrieve batch embeddings from Gemini response.');
    }

    return result.embeddings.map(e => {
      if (!e || !Array.isArray(e.values)) {
        throw new Error('Malformed individual embedding values in batch response.');
      }
      return e.values;
    });
  }
}

// We export the provider class to allow multiple implementations,
// and export a default instance of our active provider.
export { GeminiEmbeddingProvider };
export default new GeminiEmbeddingProvider();
