/**
 * Combines semantic and keyword scores using Reciprocal Rank Fusion or weighted sum.
 * We implement a weighted sum: Combined Score = (Semantic * weightSemantic) + (Keyword * weightKeyword)
 */
export const fuseScores = (semanticResults, keywordResults, options = {}) => {
  const semanticWeight = options.semanticWeight !== undefined ? options.semanticWeight : 0.7;
  const keywordWeight = options.keywordWeight !== undefined ? options.keywordWeight : 0.3;

  const fusedMap = new Map();

  // Process semantic results
  semanticResults.forEach(item => {
    const id = item._id.toString();
    fusedMap.set(id, {
      chunk: item,
      semanticScore: item.score || 0,
      keywordScore: 0
    });
  });

  // Process keyword results
  keywordResults.forEach(item => {
    const id = item._id.toString();
    const existing = fusedMap.get(id);
    const score = item.score !== undefined ? item.score : 1.0; // Fallback score if raw match

    if (existing) {
      existing.keywordScore = score;
    } else {
      fusedMap.set(id, {
        chunk: item,
        semanticScore: 0,
        keywordScore: score
      });
    }
  });

  // Calculate final fused score
  const fusedList = [];
  fusedMap.forEach((value, key) => {
    const combinedScore = (value.semanticScore * semanticWeight) + (value.keywordScore * keywordWeight);
    fusedList.push({
      ...value.chunk,
      score: Number(combinedScore.toFixed(4)),
      _details: {
        semanticScore: value.semanticScore,
        keywordScore: value.keywordScore
      }
    });
  });

  // Sort by combined score descending
  fusedList.sort((a, b) => b.score - a.score);

  return fusedList;
};

export default {
  fuseScores
};
