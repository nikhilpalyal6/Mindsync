import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiRouterConfig } from '../../config/aiRouter.config.js';
import logger from '../../config/logger.js';

class PDFExtractorService {
  async extractTextFromBase64(base64DataUrl) {
    try {
      const apiKey = aiRouterConfig.providers.gemini.apiKey();
      if (!apiKey) {
        logger.warn('[PDF Extractor] Gemini API key not configured, skipping auto-extraction');
        return '';
      }

      const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        logger.warn('[PDF Extractor] Invalid Data URL format');
        return '';
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      logger.info('[PDF Extractor] Running Gemini AI transcription for PDF text extraction...');
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Use standard Gemini model config
      const modelName = aiRouterConfig.providers.gemini.model() || 'gemini-1.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      const parts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'application/pdf'
          }
        },
        { text: "Extract all readable text, formulas, headings, and details from this PDF document. Return ONLY the transcribed text. Do not summarize, do not explain, and do not add any markdown blocks or conversational text." }
      ];

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text() || '';
      logger.info(`[PDF Extractor] Successfully extracted ${text.length} characters of PDF text.`);
      return text.trim();
    } catch (err) {
      logger.error('[PDF Extractor] Text extraction failed:', err);
      return '';
    }
  }
}

export default new PDFExtractorService();
