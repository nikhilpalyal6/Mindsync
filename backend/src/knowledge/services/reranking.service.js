import rerankerProvider from '../providers/rerankerProvider.js';
import winstonLogger from '../../config/logger.js';

class RerankingService {
  /**
   * Rerank hybrid search results using Ollama.
   * If reranking is disabled or fails, falls back immediately to hybrid order.
   * @param {string} query - The search query.
   * @param {Array<Object>} candidates - List of chunks from hybrid search.
   * @returns {Promise<Array<Object>>} Reranked chunk list.
   */
  async rerankCandidates(query, candidates) {
    if (process.env.KNOWLEDGE_RERANK_ENABLED !== 'true') {
      return candidates;
    }

    const topN = parseInt(process.env.KNOWLEDGE_RERANK_TOP_N, 10) || 20;
    const candidatesToRerank = candidates.slice(0, topN);
    const trailingCandidates = candidates.slice(topN);

    if (candidatesToRerank.length === 0) {
      return candidates;
    }

    try {
      const payload = candidatesToRerank.map(c => ({
        id: c._id.toString(),
        text: c.text
      }));

      const rerankedList = await rerankerProvider.rerank(query, payload);

      // Create map of ID to score
      const scoreMap = new Map();
      rerankedList.forEach(item => {
        scoreMap.set(item.id, item.score);
      });

      // Map back and re-score candidates
      const rerankedCandidates = candidatesToRerank.map(c => {
        const idStr = c._id.toString();
        // Fallback to 0 if model omitted this chunk
        const score = scoreMap.has(idStr) ? scoreMap.get(idStr) : 0.0;
        return {
          ...c,
          score: score
        };
      });

      // Sort by new score descending
      rerankedCandidates.sort((a, b) => b.score - a.score);

      return [...rerankedCandidates, ...trailingCandidates];
    } catch (err) {
      winstonLogger.warn(`[Reranking Service] Reranker failed: ${err.message}. Falling back to hybrid ranking.`);
      return candidates; // Safe Fallback
    }
  }
}

export default new RerankingService();
