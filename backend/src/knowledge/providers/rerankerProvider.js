import winstonLogger from '../../config/logger.js';

class OllamaRerankerProvider {
  /**
   * Calls the local Ollama API to rerank candidates.
   * @param {string} query - The search query.
   * @param {Array<Object>} candidates - List of chunks [{ id, text }].
   * @returns {Promise<Array<Object>>} List of { id, score } mappings.
   */
  async rerank(query, candidates) {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_RERANK_MODEL || 'qwen3:4b';
    const timeoutMs = parseInt(process.env.OLLAMA_RERANK_TIMEOUT_MS, 10) || 5000;

    winstonLogger.info(`[Ollama Reranker] Reranking ${candidates.length} candidates using model ${model} via ${ollamaUrl}`);

    const prompt = `You are a precision search ranker. Your task is to rank the following passages based on their semantic relevance to the query: "${query}".

Passages to rank:
${candidates.map((c, idx) => `[ID: ${c.id}] ${c.text}`).join('\n\n')}

Respond strictly in a valid raw JSON array format, containing objects with "id" and "score" (a relevance float between 0.0 and 1.0).
Example response format:
[
  {"id": "id1", "score": 0.95},
  {"id": "id2", "score": 0.45}
]

Do not write any introductory text, concluding notes, markdown code blocks, or explanations. Respond with ONLY the raw JSON array.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 500
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama responded with status code ${response.status}`);
      }

      const resBody = await response.json();
      const rawText = resBody.response || '';
      
      return this._parseJSONResponse(rawText);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  _parseJSONResponse(text) {
    const trimmed = text.trim();
    
    // Find array boundaries in case the model wrapped it in markdown or text
    const startIdx = trimmed.indexOf('[');
    const endIdx = trimmed.lastIndexOf(']');
    
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      throw new Error('Ollama model output did not contain a valid JSON array structure.');
    }

    const cleanJson = trimmed.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(cleanJson);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed Ollama output is not an array.');
    }

    return parsed.map(item => {
      if (!item || typeof item.id !== 'string') {
        throw new Error('Malformed individual rerank item.');
      }
      return {
        id: item.id,
        score: typeof item.score === 'number' ? item.score : parseFloat(item.score) || 0.0
      };
    });
  }
}

export default new OllamaRerankerProvider();
