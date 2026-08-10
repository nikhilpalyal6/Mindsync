import SmartHighlightPreference from '../models/smartHighlightPreference.model.js';

const CATEGORY_PRIORITY = {
  'FORMULA': 12,
  'DEFINITION': 11,
  'IMPORTANT_CONCEPT': 10,
  'RULE': 9,
  'PROCESS': 8,
  'EXAM_POINT': 7,
  'COMPARISON': 6,
  'WARNING': 5,
  'EXAMPLE': 4,
  'KEY_TERM': 3,
  'FACT': 2,
  'SUMMARY_POINT': 1
};

class SmartHighlightRankingService {
  async getPreferences(userId) {
    let pref = await SmartHighlightPreference.findOne({ userId });
    if (!pref) {
      // Return a baseline mock preference
      pref = {
        categoryPreferences: new Map(),
        acceptedCount: 0,
        rejectedCount: 0
      };
    }
    return pref;
  }

  async updatePreferences(userId, category, isAccept) {
    let pref = await SmartHighlightPreference.findOne({ userId });
    if (!pref) {
      pref = new SmartHighlightPreference({ userId, categoryPreferences: new Map() });
    }

    const currentMap = pref.categoryPreferences || new Map();
    const currentVal = currentMap.get(category) ?? 0.5;

    let newVal;
    if (isAccept) {
      newVal = Math.min(1.0, currentVal + 0.1);
      pref.acceptedCount += 1;
    } else {
      newVal = Math.max(0.0, currentVal - 0.1);
      pref.rejectedCount += 1;
    }

    currentMap.set(category, newVal);
    pref.categoryPreferences = currentMap;
    pref.markModified('categoryPreferences');
    await pref.save();
    return pref;
  }

  async rankSuggestions(userId, suggestions) {
    const pref = await this.getPreferences(userId);
    const categoryPrefs = pref.categoryPreferences || new Map();

    const ranked = suggestions.map(sug => {
      const category = sug.category.toUpperCase();
      const baseScore = sug.importanceScore || (sug.importance ? sug.importance * 100 : 75);

      // Category priority weight contribution (0 to 12 points)
      const priorityWeight = CATEGORY_PRIORITY[category] || 0;

      // Personalization category preference bonus/penalty (-10 to +10 points)
      const prefVal = categoryPrefs.get(category) ?? 0.5;
      const prefBonus = (prefVal - 0.5) * 20;

      // Uniqueness and text quality bonus (0 to 10 points)
      // Longer descriptive sentences get slightly higher quality scores
      const wordsCount = (sug.text || '').split(/\s+/).filter(Boolean).length;
      const qualityBonus = wordsCount >= 10 && wordsCount <= 30 ? 10 : 5;

      const finalScore = Math.min(100, Math.max(0, baseScore + priorityWeight + prefBonus + qualityBonus));
      
      let importanceLevel = 'MEDIUM';
      if (finalScore >= 80) importanceLevel = 'HIGH';
      else if (finalScore < 60) importanceLevel = 'LOW';

      return {
        ...sug,
        importanceScore: Math.round(finalScore),
        importanceLevel,
        importance: finalScore / 100 // Keep for backward compatibility
      };
    });

    // Sort by finalScore descending
    ranked.sort((a, b) => b.importanceScore - a.importanceScore);

    return ranked;
  }
}

export default new SmartHighlightRankingService();
