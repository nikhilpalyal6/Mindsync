import Highlight from '../models/highlight.model.js';
import SmartHighlightSuggestion from '../models/smartHighlightSuggestion.model.js';

class SmartHighlightQualityService {
  async evaluateSuggestions(userId, resourceId, pageNumber, candidates, originalPageText) {
    const passed = [];
    
    // Fetch highlights and rejected suggestions on the page for comparison
    const existingHighlights = await Highlight.find({ userId, resourceId, pageNumber });
    const rejectedSuggestions = await SmartHighlightSuggestion.find({ userId, resourceId, pageNumber, status: 'rejected' });

    const cleanPageText = originalPageText.toLowerCase().trim();

    for (const sug of candidates) {
      const textVal = (sug.text || '').trim();
      
      // 1. Text is empty
      if (!textVal) continue;
      
      const words = textVal.split(/\s+/).filter(Boolean);
      const category = (sug.category || 'IMPORTANT_CONCEPT').toUpperCase();

      // 2. Length rules
      // target minimum: 5 words (except for DEFINITION, FORMULA, RULE, EXAM_POINT, KEY_TERM which can be shorter)
      const isShortAllowed = ['DEFINITION', 'FORMULA', 'RULE', 'EXAM_POINT', 'KEY_TERM'].includes(category);
      if (words.length < 5 && !isShortAllowed) continue;
      
      // target maximum: 80 words
      if (words.length > 80) continue;

      // 3. Text only punctuation check
      const onlyPunc = textVal.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").trim().length === 0;
      if (onlyPunc) continue;

      // 4. Source page check (must exist on page)
      const cleanSugText = textVal.toLowerCase().replace(/\s+/g, ' ');
      const cleanOriginalText = originalPageText.toLowerCase().replace(/\s+/g, ' ');
      if (!cleanOriginalText.includes(cleanSugText)) continue;

      // 5. Overlap with manual or accepted AI highlights
      const overlapsHighlight = existingHighlights.some(h => {
        const hText = h.text.toLowerCase().trim();
        const sText = textVal.toLowerCase().trim();
        return hText.includes(sText) || sText.includes(hText);
      });
      if (overlapsHighlight) continue;

      // 6. Match previously rejected suggestion
      const matchesRejected = rejectedSuggestions.some(r => {
        return r.text.toLowerCase().trim() === textVal.toLowerCase().trim();
      });
      if (matchesRejected) continue;

      // 7. Obvious hallucination or non-educational / heading check
      // headings usually don't have terminal punctuation and are very short (e.g. 1-2 words that aren't formulas or terms)
      const isLikelyHeadingOnly = words.length <= 3 && 
        !textVal.includes('.') && 
        !textVal.includes(':') && 
        !['DEFINITION', 'FORMULA', 'KEY_TERM'].includes(category);
      if (isLikelyHeadingOnly) continue;

      passed.push(sug);
    }

    return passed;
  }
}

export default new SmartHighlightQualityService();
