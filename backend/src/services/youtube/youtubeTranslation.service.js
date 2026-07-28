import aiProviderService from '../ai/aiProvider.service.js';
import logger from '../../config/logger.js';

class YouTubeTranslationService {
  /**
   * Detect transcript language from text content and hint code
   */
  detectLanguage(transcriptText, languageCodeHint = null) {
    if (languageCodeHint && typeof languageCodeHint === 'string') {
      const hintLower = languageCodeHint.toLowerCase();
      if (hintLower.startsWith('en') || hintLower === 'english') {
        return 'en';
      }
      if (hintLower.startsWith('hi') || hintLower === 'hindi') {
        return 'hi';
      }
    }

    if (!transcriptText || typeof transcriptText !== 'string') return 'en';

    // Check for Devanagari (Hindi / Marathi / Sanskrit) characters
    if (/[\u0900-\u097F]/.test(transcriptText)) {
      return 'hi';
    }

    // Check for generic non-ASCII script dominance
    const nonAsciiCount = (transcriptText.match(/[^\x00-\x7F]/g) || []).length;
    if (transcriptText.length > 50 && (nonAsciiCount / transcriptText.length > 0.12)) {
      return 'non-en';
    }

    return 'en';
  }

  /**
   * Check if a language code string is English
   */
  isEnglish(langCode) {
    if (!langCode || typeof langCode !== 'string') return true;
    const lower = langCode.toLowerCase();
    return lower === 'en' || lower.startsWith('en-') || lower === 'english';
  }

  /**
   * Split transcript items into safe chunks for LLM processing (~30 items per chunk)
   */
  chunkTranscriptItems(items, chunkSize = 30) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Process and translate transcript with chunking engine, structured logging, and MongoDB caching
   */
  async processTranslation({ videoId, originalTranscript, originalTranscriptItems = [], transcriptLanguageHint = 'en', existingYoutubeData = null }) {
    try {
      logger.info(`[START processTranslation] Video ID: ${videoId}`);

      // 1. Check Cache: Reuse existing translation if already completed
      if (existingYoutubeData && existingYoutubeData.videoId === videoId && existingYoutubeData.translationStatus === 'completed' && existingYoutubeData.englishTranscript) {
        logger.info(`[Loaded English Transcript From Cache] Reusing cached translation for ID: ${videoId}`);
        return {
          originalTranscript: existingYoutubeData.originalTranscript || originalTranscript,
          originalTranscriptItems: existingYoutubeData.originalTranscriptItems || originalTranscriptItems,
          englishTranscript: existingYoutubeData.englishTranscript,
          englishTranscriptItems: existingYoutubeData.englishTranscriptItems || [],
          transcriptLanguage: existingYoutubeData.transcriptLanguage || 'en',
          translationStatus: 'completed',
          translated: true,
          translatedAt: existingYoutubeData.translatedAt || new Date().toISOString()
        };
      }

      // 2. Detect Language
      const detectedLang = this.detectLanguage(originalTranscript, transcriptLanguageHint);
      logger.info(`[Language Detection] Detected transcript language: "${detectedLang}" for video ID: ${videoId}`);

      // 3. If English, return without AI translation
      if (this.isEnglish(detectedLang)) {
        logger.info(`[Translation Skipped] Transcript is already in English for ID: ${videoId}`);
        return {
          originalTranscript,
          originalTranscriptItems,
          englishTranscript: originalTranscript,
          englishTranscriptItems: originalTranscriptItems,
          transcriptLanguage: 'en',
          translationStatus: 'completed',
          translated: false,
          translatedAt: null
        };
      }

      // 4. Translate Non-English Transcript in Chunks
      logger.info(`[Translation Started] Starting transcript translation for Video ID: ${videoId} (Language: ${detectedLang})`);

      const itemsToTranslate = (originalTranscriptItems && originalTranscriptItems.length > 0)
        ? originalTranscriptItems
        : originalTranscript.split('\n').map(line => {
            const match = line.match(/^\[([\d:]+)\]\s*(.*)/);
            return match ? { time: match[1], text: match[2] } : { time: '00:00', text: line };
          });

      const chunks = this.chunkTranscriptItems(itemsToTranslate, 30);
      logger.info(`[Chunk Allocation] Split ${itemsToTranslate.length} transcript items into ${chunks.length} chunks`);

      const mergedEnglishItems = [];
      const systemInstruction = 
        'You are an expert multilingual translator for MindSync AI. ' +
        'Translate the provided transcript chunk into clear, natural English.\n' +
        'CRITICAL RULES:\n' +
        '1. PRESERVE EVERY TIMESTAMP tag formatted as [MM:SS] or [HH:MM:SS] exactly as given.\n' +
        '2. PRESERVE technical terminology, code, formulas, and names.\n' +
        '3. Do NOT summarize, shorten, or omit any text.\n' +
        '4. Output ONLY the translated timestamp lines with zero extra text.';

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info(`[Chunk ${i + 1}/${chunks.length}] Translating ${chunk.length} items...`);

        const chunkText = chunk.map(item => `[${item.time}] ${item.text}`).join('\n');
        const userContent = `Translate the following ${detectedLang.toUpperCase()} transcript chunk to English:\n\n${chunkText}`;

        const response = await aiProviderService.generateAIResponse({
          messages: [{ role: 'user', content: userContent }],
          systemInstruction
        });

        const translatedChunkText = (typeof response === 'string'
          ? response
          : (response?.content || response?.message?.content || '')
        ).trim();

        // Parse translated lines into items
        const translatedLines = translatedChunkText.split('\n');
        translatedLines.forEach((line, idx) => {
          const match = line.match(/^\[([\d:]+)\]\s*(.*)/);
          if (match) {
            mergedEnglishItems.push({
              time: match[1],
              seconds: chunk[idx]?.seconds || 0,
              text: match[2].trim()
            });
          } else if (line.trim()) {
            mergedEnglishItems.push({
              time: chunk[idx]?.time || '00:00',
              seconds: chunk[idx]?.seconds || 0,
              text: line.trim()
            });
          }
        });
      }

      const englishTranscriptString = mergedEnglishItems
        .map(item => `[${item.time}] ${item.text}`)
        .join('\n');

      logger.info(`[Translation Completed] Translated all ${chunks.length} chunks (${englishTranscriptString.length} characters)`);

      return {
        originalTranscript,
        originalTranscriptItems,
        englishTranscript: englishTranscriptString || originalTranscript,
        englishTranscriptItems: mergedEnglishItems.length > 0 ? mergedEnglishItems : originalTranscriptItems,
        transcriptLanguage: detectedLang,
        translationStatus: 'completed',
        translated: true,
        translatedAt: new Date().toISOString()
      };
    } catch (err) {
      logger.error(`[EXCEPTION IN processTranslation] Stack: ${err.stack}`);
      // DO NOT THROW! Return original transcript so translation failure does not block/abort original transcript
      return {
        originalTranscript,
        originalTranscriptItems,
        englishTranscript: originalTranscript,
        englishTranscriptItems: originalTranscriptItems,
        transcriptLanguage: transcriptLanguageHint,
        translationStatus: 'failed',
        translated: false,
        translatedAt: null,
        error: err.message
      };
    }
  }
}

export default new YouTubeTranslationService();
