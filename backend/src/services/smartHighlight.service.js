import StudySession from '../models/studySession.model.js';
import SmartHighlightSuggestion from '../models/smartHighlightSuggestion.model.js';
import Highlight from '../models/highlight.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import highlightService from './highlight.service.js';
import logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';
import smartHighlightQualityService from './smartHighlightQuality.service.js';
import smartHighlightRankingService from './smartHighlightRanking.service.js';

const activeAnalysisRequests = new Map();

// Parse page numbers and text sections from the extractedText string
function parsePagesFromExtractedText(extractedText) {
  const pages = [];
  if (!extractedText) return pages;

  const pageRegex = /\[Page\s+(\d+)\]/gi;
  let match;
  const pagePositions = [];

  while ((match = pageRegex.exec(extractedText)) !== null) {
    pagePositions.push({
      pageNumber: parseInt(match[1], 10),
      index: match.index,
      headerLength: match[0].length
    });
  }

  if (pagePositions.length === 0) {
    return [{
      pageNumber: 1,
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    }];
  }

  for (let i = 0; i < pagePositions.length; i++) {
    const current = pagePositions[i];
    const next = pagePositions[i + 1];
    const startIdx = current.index + current.headerLength;
    const endIdx = next ? next.index : extractedText.length;
    const text = extractedText.substring(startIdx, endIdx).trim();

    pages.push({
      pageNumber: current.pageNumber,
      text: text,
      wordCount: text.split(/\s+/).filter(Boolean).length
    });
  }

  return pages;
}

// Searches and validates suggestedText within pageText, returning exact original casing substring
function findExactSourceSubstring(pageText, suggestedText) {
  if (!pageText || !suggestedText) return null;
  
  const clean = (str) => str.replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanPageText = clean(pageText);
  const cleanSuggested = clean(suggestedText);
  
  const cleanIdx = cleanPageText.indexOf(cleanSuggested);
  if (cleanIdx === -1) return null;

  const pageWords = pageText.split(/\s+/).filter(Boolean);
  const suggestedWords = suggestedText.split(/\s+/).filter(Boolean);

  if (suggestedWords.length === 0) return null;

  for (let i = 0; i <= pageWords.length - suggestedWords.length; i++) {
    let match = true;
    for (let j = 0; j < suggestedWords.length; j++) {
      const pw = pageWords[i + j].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const sw = suggestedWords[j].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (pw !== sw) {
        match = false;
        break;
      }
    }
    if (match) {
      const originalSlice = pageWords.slice(i, i + suggestedWords.length);
      const approximatePhrase = originalSlice.join(' ');
      
      const firstWord = originalSlice[0];
      let startCharIdx = pageText.indexOf(firstWord);
      
      while (startCharIdx !== -1) {
        let currentIdx = startCharIdx;
        let windowMatch = true;
        for (let w of originalSlice) {
          const foundIdx = pageText.indexOf(w, currentIdx);
          if (foundIdx === -1 || (foundIdx - currentIdx > w.length + 100)) {
            windowMatch = false;
            break;
          }
          currentIdx = foundIdx + w.length;
        }
        if (windowMatch) {
          return pageText.substring(startCharIdx, currentIdx).trim();
        }
        startCharIdx = pageText.indexOf(firstWord, startCharIdx + 1);
      }
      return approximatePhrase;
    }
  }
  return null;
}

function filterOverlappingSuggestions(suggestions) {
  const sorted = [...suggestions].sort((a, b) => b.importance - a.importance);
  const result = [];
  
  for (const sug of sorted) {
    const overlaps = result.some(r => 
      r.pageNumber === sug.pageNumber &&
      (r.text.toLowerCase().includes(sug.text.toLowerCase()) ||
       sug.text.toLowerCase().includes(r.text.toLowerCase()))
    );
    if (!overlaps) {
      result.push(sug);
    }
  }
  
  return result;
}

function resolveOverlapsAndKeepStrongest(suggestions) {
  const sorted = [...suggestions].sort((a, b) => b.importanceScore - a.importanceScore);
  const result = [];
  
  for (const sug of sorted) {
    const overlaps = result.some(r => 
      r.pageNumber === sug.pageNumber &&
      (r.text.toLowerCase().includes(sug.text.toLowerCase()) ||
       sug.text.toLowerCase().includes(r.text.toLowerCase()))
    );
    if (!overlaps) {
      result.push(sug);
    }
  }
  
  return result;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function partitionPagesIntoAdaptiveBatches(pages) {
  const maxInputTokens = parseInt(process.env.SMART_HIGHLIGHT_MAX_INPUT_TOKENS, 10) || 4000;
  const defaultBatchSize = parseInt(process.env.SMART_HIGHLIGHT_BATCH_SIZE, 10) || 2;

  const batches = [];
  let currentBatch = [];
  let currentBatchTokens = 0;

  for (const page of pages) {
    const pageText = page.text || '';
    const pageTokens = estimateTokens(pageText);

    if (pageTokens >= maxInputTokens) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }
      batches.push([page]);
      continue;
    }

    if (currentBatch.length >= defaultBatchSize || (currentBatchTokens + pageTokens) > maxInputTokens) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      currentBatch = [page];
      currentBatchTokens = pageTokens;
    } else {
      currentBatch.push(page);
      currentBatchTokens += pageTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

const ALLOWED_CATEGORIES = [
  'DEFINITION',
  'IMPORTANT_CONCEPT',
  'KEY_TERM',
  'EXAM_POINT',
  'FORMULA',
  'RULE',
  'PROCESS',
  'EXAMPLE',
  'COMPARISON',
  'WARNING',
  'FACT',
  'SUMMARY_POINT'
];

const systemPrompt = `You are the MindSync Smart Highlighting Engine, an AI designed to behave as an expert educational content curator.
Your job is to analyze ONLY the supplied PDF page and identify the smallest number of passages that provide the highest learning value.

Select exact contiguous text passages from the input text that fit into one of the following categories:
1. DEFINITION: Clear, formal definitions of terms, variables, or concepts.
2. IMPORTANT_CONCEPT: Core ideas, paradigms, models, theories, or key topics.
3. KEY_TERM: Key keywords, variables, acronyms, or terminologies.
4. EXAM_POINT: Highly testable, exam-relevant statements, rules of thumb, or key rules.
5. FORMULA: Mathematical formulas, equations, or scientific laws.
6. PROCESS: Sequences of steps, algorithm descriptions, workflows, or instructions.
7. COMPARISON: Key comparisons, contrasts, pros and cons, or trade-offs.
8. EXAMPLE: Instructive examples that clarify complex theoretical ideas.
9. WARNING: Common pitfalls, caveats, mistakes, or limitations.
10. FACT: Concrete statistics, history, dates, or notable discoveries.
11. SUMMARY_POINT: Summarizing sentences that draw key conclusions.

CRITICAL RULES:
- The highlighted text must be an EXACT contiguous substring of the text provided in the input. Do NOT change punctuation, casing, spacing, or spelling. Do NOT summarize or shorten the passage inside the "text" field of the JSON. It must match the source text word-for-word.
- Do NOT hallucinate quotes or synthesize information.
- Prefer definitions, core concepts, formulas, processes, and rules. Avoid generic sentences, introductory fluff, or headers lacking useful information.
- Provide a brief, student-friendly explanation in the "reason" field detailing why this specific passage is important to highlight.
- Assign an "importanceScore" between 0 and 100 (with 85+ indicating extremely high priority).
- Specify the correct "pageNumber" corresponding to the page where the text resides.

You MUST respond ONLY with a JSON object containing a list of suggestions.
Schema:
{
  "suggestions": [
    {
      "pageNumber": 4,
      "text": "exact matching text substring from source",
      "category": "IMPORTANT_CONCEPT",
      "importanceScore": 92,
      "reason": "This passage defines the difference between TCP and UDP which is a core concept in networks."
    }
  ]
}`;

class SmartHighlightService {
  async getSuggestions(userId, resourceId) {
    return await SmartHighlightSuggestion.find({
      userId,
      resourceId,
      category: { $ne: 'NONE' },
      status: 'suggested'
    }).sort({ pageNumber: 1, createdAt: 1 });
  }

  async generatePageSuggestions(userId, resourceId, pageNumber, studySessionId) {
    logger.info(`[SmartHighlights] SERVICE START`);

    if (!resourceId || !pageNumber || !studySessionId) {
      throw ApiError.badRequest('Missing resourceId, pageNumber, or studySessionId');
    }

    const pageNum = Number(pageNumber);
    if (isNaN(pageNum) || pageNum < 1 || !Number.isInteger(pageNum)) {
      throw ApiError.badRequest('Invalid page number');
    }

    // 1. Check database cache
    const existing = await SmartHighlightSuggestion.find({
      userId,
      resourceId,
      pageNumber: pageNum
    });

    if (existing.length > 0) {
      logger.info(`[SmartHighlights] Cache hit page ${pageNum}`);
      const suggestions = existing.filter(s => s.category !== 'NONE' && s.status === 'suggested');
      const hasInsufficientText = existing.some(s => s.category === 'NONE');
      
      // Preserve rank order on cache retrieval
      suggestions.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));

      return {
        resourceId,
        pageNumber: pageNum,
        suggestions,
        status: hasInsufficientText ? 'no_text' : 'success'
      };
    }

    // 2. Authorize resource ownership
    const session = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!session) {
      throw ApiError.forbidden('Unauthorized access to this session');
    }

    const resource = session.resources.find(r => r && (r.url === resourceId || (r._id && r._id.toString() === resourceId)));
    if (!resource) {
      throw ApiError.notFound('PDF resource not found.');
    }

    logger.info(`[SmartHighlights] RESOURCE FOUND\nsessionId: ${session._id}\nresourceId: ${resourceId}\nresourceTitle: ${resource.title}`);

    const extractedText = resource.data?.extractedText || session.metadata?.pdf?.extractedText;
    if (!extractedText || !extractedText.trim()) {
      throw ApiError.badRequest('No extracted text content available for this document.');
    }

    const pages = parsePagesFromExtractedText(extractedText);
    const totalPages = pages.length;

    if (pageNum > totalPages) {
      throw ApiError.badRequest('Requested PDF page does not exist.');
    }

    const page = pages.find(p => p.pageNumber === pageNum);
    if (!page) {
      // Save cache marker
      await SmartHighlightSuggestion.create({
        userId,
        resourceId,
        pageNumber: pageNum,
        text: '',
        category: 'NONE',
        importance: 0,
        importanceScore: 0,
        importanceLevel: 'LOW',
        reason: 'Empty page',
        status: 'suggested'
      });
      return {
        resourceId,
        pageNumber: pageNum,
        suggestions: [],
        status: 'no_text'
      };
    }

    const cleanText = (page.text || '').trim();
    if (cleanText.length < 50) {
      logger.info(`[SmartHighlights] Page ${pageNum} has insufficient text content. Saving cache marker.`);
      await SmartHighlightSuggestion.create({
        userId,
        resourceId,
        pageNumber: pageNum,
        text: '',
        category: 'NONE',
        importance: 0,
        importanceScore: 0,
        importanceLevel: 'LOW',
        reason: 'Insufficient text',
        status: 'suggested'
      });
      return {
        resourceId,
        pageNumber: pageNum,
        suggestions: [],
        status: 'no_text'
      };
    }

    logger.info(`[SmartHighlights] PAGE FOUND\npageNumber: ${pageNum}\ntotalPages: ${totalPages}\ntextLength: ${cleanText.length}`);

    // 3. Concurrent Request Guard
    const lockKey = `${userId}_${resourceId}_${pageNum}`;
    let promise = activeAnalysisRequests.get(lockKey);
    if (!promise) {
      promise = (async () => {
        try {
          logger.info(`[SmartHighlights] AI START\npageNumber: ${pageNum}\ntextLength: ${cleanText.length}`);

          const existingHighlights = await Highlight.find({ userId, resourceId });

          let response = null;
          let attempt = 0;
          let delay = parseInt(process.env.SMART_HIGHLIGHT_RETRY_DELAY, 10) || 1200;
          const maxRetries = parseInt(process.env.SMART_HIGHLIGHT_MAX_RETRIES, 10) || 3;
          let chunkSucceeded = false;
          let lastError = null;

          const prompt = `Analyze the following PDF page.\n\n[Page ${pageNum}]\n${cleanText}\n\nReturn important study-worthy passages from THIS PAGE ONLY. Do not invent information. Every returned passage must exist exactly in the supplied source text. Do not reference other pages.`;

          while (attempt < maxRetries && !response) {
            try {
              response = await Promise.race([
                aiProviderService.generateAIResponse({
                  prompt,
                  systemPrompt,
                  jsonMode: true
                }),
                new Promise((_, reject) => {
                  const timeoutMs = parseInt(process.env.SMART_HIGHLIGHT_JOB_TIMEOUT, 10) || 30000;
                  setTimeout(() => reject(new Error('AI Request Timeout')), timeoutMs);
                })
              ]);
              chunkSucceeded = true;
            } catch (err) {
              attempt++;
              lastError = err;
              logger.warn(`[SmartHighlights] Page ${pageNum} failed attempt ${attempt}/${maxRetries}. Retrying... Error: ${err.message}`);
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
              }
            }
          }

          if (!chunkSucceeded || !response) {
            logger.error(`[SmartHighlights] Page ${pageNum} permanently failed to analyze.`);
            throw lastError || new Error('AI analysis timed out or failed.');
          }

          const resText = typeof response === 'string' ? response : (response.text || '');
          if (!resText.trim()) {
            await SmartHighlightSuggestion.create({
              userId,
              resourceId,
              pageNumber: pageNum,
              text: '',
              category: 'NONE',
              importance: 0,
              importanceScore: 0,
              importanceLevel: 'LOW',
              reason: 'Empty AI response',
              status: 'suggested'
            });
            return [];
          }

          let parsed;
          try {
            parsed = JSON.parse(resText.replace(/```json|```/g, '').trim());
          } catch (jsonErr) {
            logger.error(`[SmartHighlights] Page ${pageNum} JSON parse failed: ${jsonErr.message}`);
            throw new ApiError(500, `JSON parse failed: ${jsonErr.message}`);
          }

          const suggestionsToSave = [];
          if (parsed && Array.isArray(parsed.suggestions)) {
            for (const sug of parsed.suggestions) {
              const category = (sug.category || 'IMPORTANT_CONCEPT').toUpperCase();
              if (!ALLOWED_CATEGORIES.includes(category)) continue;

              const textVal = sug.text || '';
              if (typeof textVal !== 'string' || !textVal.trim()) continue;

              const reasonVal = sug.reason || '';
              if (typeof reasonVal !== 'string' || reasonVal.length > 300) continue;

              const rawScore = parseInt(sug.importanceScore || (sug.importance ? sug.importance * 100 : 75), 10);

              const verifiedText = findExactSourceSubstring(cleanText, textVal);
              if (!verifiedText || verifiedText.length < 10) continue;

              suggestionsToSave.push({
                userId,
                resourceId,
                pageNumber: pageNum,
                text: verifiedText,
                category,
                importanceScore: rawScore,
                reason: reasonVal,
                status: 'suggested'
              });
            }
          }

          logger.info(`[SmartHighlights] AI RESPONSE\nprovider: Gemini\nstatus: success\nsuggestionCount: ${suggestionsToSave.length}`);

          // Evaluate candidate quality
          const passedQuality = await smartHighlightQualityService.evaluateSuggestions(
            userId,
            resourceId,
            pageNum,
            suggestionsToSave,
            cleanText
          );

          // Overlap check and keep strongest
          const deduplicated = resolveOverlapsAndKeepStrongest(passedQuality);

          // Rank suggestions using personalization
          const ranked = await smartHighlightRankingService.rankSuggestions(userId, deduplicated);

          // Limit suggestions to default target: 3–7 strong suggestions per page.
          const topSuggestions = ranked.slice(0, 7);

          if (topSuggestions.length > 0) {
            const saved = await SmartHighlightSuggestion.insertMany(topSuggestions);
            logger.info(`[SmartHighlights] SAVED\npageNumber: ${pageNum}\ncount: ${saved.length}`);
            return saved;
          } else {
            await SmartHighlightSuggestion.create({
              userId,
              resourceId,
              pageNumber: pageNum,
              text: '',
              category: 'NONE',
              importance: 0,
              importanceScore: 0,
              importanceLevel: 'LOW',
              reason: 'No key concepts found',
              status: 'suggested'
            });
            logger.info(`[SmartHighlights] Page ${pageNum} analyzed. No suggestions generated.`);
            return [];
          }
        } catch (err) {
          logger.error(`[SmartHighlights] Page ${pageNum} processing error:`, err);
          throw err;
        } finally {
          activeAnalysisRequests.delete(lockKey);
        }
      })();
      activeAnalysisRequests.set(lockKey, promise);
    }

    const suggestions = await promise;
    return {
      resourceId,
      pageNumber: pageNum,
      suggestions: suggestions.filter(s => s.category !== 'NONE' && s.status === 'suggested'),
      status: suggestions.some(s => s.category === 'NONE') ? 'no_text' : 'success'
    };
  }

  async regeneratePageSuggestions(userId, resourceId, pageNumber, studySessionId) {
    const pageNum = parseInt(pageNumber, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw ApiError.badRequest('Invalid page number');
    }

    // Remove only previous suggestions belonging to current user, resource, pageNumber
    await SmartHighlightSuggestion.deleteMany({
      userId,
      resourceId,
      pageNumber: pageNum,
      status: 'suggested'
    });

    logger.info(`[SmartHighlights] Invalidated cache for page ${pageNum}. Regenerating...`);

    return await this.generatePageSuggestions(userId, resourceId, pageNum, studySessionId);
  }

  async acceptSuggestions(userId, resourceId, suggestionsToAccept) {
    if (!resourceId || !Array.isArray(suggestionsToAccept)) {
      throw ApiError.badRequest('Missing resourceId or suggestions list');
    }

    const createdHighlights = [];
    let lastError = null;

    for (const item of suggestionsToAccept) {
      const { suggestionId, rects } = item;
      if (!suggestionId || !rects || !Array.isArray(rects) || rects.length === 0) continue;

      logger.info(`[SmartHighlight Accept] suggestionId=${suggestionId} userId=${userId} resourceId=${resourceId}`);

      const sug = await SmartHighlightSuggestion.findOne({
        _id: suggestionId,
        userId,
        resourceId,
        status: { $in: ['suggested', 'accepted'] }
      });

      if (!sug) {
        logger.warn(`[SmartHighlight Accept] Suggestion ${suggestionId} not found or status invalid.`);
        continue;
      }

      logger.info(`[SmartHighlight Accept] Suggestion found. status=${sug.status} page=${sug.pageNumber}`);

      if (sug.status === 'accepted') {
        const existingHighlight = await Highlight.findOne({
          userId,
          resourceId,
          pageNumber: sug.pageNumber,
          text: sug.text.trim()
        });
        if (existingHighlight) {
          logger.info(`[SmartHighlight Accept] Idempotent hit: highlight already exists. id=${existingHighlight._id}`);
          createdHighlights.push(existingHighlight);
          continue;
        }
      }

      let type = 'important';
      if (sug.category === 'DEFINITION') type = 'definition';
      else if (sug.category === 'IMPORTANT_CONCEPT') type = 'concept';
      else if (sug.category === 'FORMULA') type = 'formula';
      else if (sug.category === 'KEY_TERM') type = 'concept';

      try {
        const highlightDoc = await highlightService.createHighlight(userId, {
          resourceId,
          pageNumber: sug.pageNumber,
          text: sug.text,
          type,
          rects,
          source: 'ai'
        });

        if (highlightDoc) {
          sug.status = 'accepted';
          await sug.save();
          createdHighlights.push(highlightDoc);
          logger.info(`[SmartHighlight Accept] Highlight created successfully. id=${highlightDoc._id}`);
          
          // Update category preferences
          await smartHighlightRankingService.updatePreferences(userId, sug.category, true);
        }
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          const existingHighlight = await Highlight.findOne({
            userId,
            resourceId,
            pageNumber: sug.pageNumber,
            text: sug.text.trim()
          });
          if (existingHighlight) {
            sug.status = 'accepted';
            await sug.save();
            createdHighlights.push(existingHighlight);
            logger.info(`[SmartHighlight Accept] Recovered from duplicate insert: highlight already exists. id=${existingHighlight._id}`);
            continue;
          }
        }
        logger.error(`[SmartHighlight Accept] Failed to create highlight for suggestion ${suggestionId}:`, err);
        lastError = err;
      }
    }

    if (createdHighlights.length === 0 && suggestionsToAccept.length > 0 && lastError) {
      throw lastError;
    }

    return createdHighlights;
  }

  async rejectSuggestions(userId, resourceId, suggestionIds) {
    const query = { userId, resourceId, status: 'suggested' };
    if (suggestionIds && Array.isArray(suggestionIds) && suggestionIds.length > 0) {
      query._id = { $in: suggestionIds };
    }

    const suggestions = await SmartHighlightSuggestion.find(query);
    for (const sug of suggestions) {
      sug.status = 'rejected';
      await sug.save();
      // Update category preferences
      await smartHighlightRankingService.updatePreferences(userId, sug.category, false);
    }

    return { count: suggestions.length };
  }
}

export default new SmartHighlightService();
