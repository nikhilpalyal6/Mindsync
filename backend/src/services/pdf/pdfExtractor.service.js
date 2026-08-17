import { aiRouterConfig } from '../../config/aiRouter.config.js';
import aiRouterService from '../ai/router/aiRouter.service.js';
import logger from '../../config/logger.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

class PDFExtractorService {
  isTextMeaningful(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 100) return false;
    
    // Alphanumeric ratio check: at least 35% of non-whitespace characters must be [a-zA-Z0-9]
    const nonWhitespaceChars = trimmed.replace(/\s+/g, '');
    if (nonWhitespaceChars.length === 0) return false;
    
    const alphaNumericMatches = nonWhitespaceChars.match(/[a-zA-Z0-9]/g) || [];
    const alphaNumericRatio = alphaNumericMatches.length / nonWhitespaceChars.length;
    if (alphaNumericRatio < 0.35) return false;
    
    // Whitespace density check: whitespace must not exceed 60% of total length
    const whitespaceChars = trimmed.length - nonWhitespaceChars.length;
    const whitespaceDensity = whitespaceChars / trimmed.length;
    if (whitespaceDensity > 0.60) return false;

    return true;
  }

  async extractTextFromBase64(base64DataUrl) {
    const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      const formatError = new Error('Invalid Data URL format');
      formatError.code = 'PDF_PARSE_ERROR';
      throw formatError;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // 1. Attempt Native PDF Text Extraction First
    try {
      logger.info('[PDF Extractor] Attempting native/local PDF text extraction...');
      const { PDFParse } = require('pdf-parse');
      const u8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
      const parser = new PDFParse(u8);
      const parsed = await parser.getText();
      const nativeText = parsed.text || '';
      
      if (this.isTextMeaningful(nativeText)) {
        logger.info(`[PDF Extractor] Native PDF text extraction succeeded (${nativeText.trim().length} characters). Bypassing AI Router.`);
        if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          return parsed.pages.map(page => `[Page ${page.num}]\n${page.text || ''}`).join('\n\n');
        }
        return nativeText.trim();
      }
      logger.info('[PDF Extractor] Native PDF text extraction returned empty or non-meaningful content. Proceeding to AI/OCR Fallback.');
    } catch (nativeErr) {
      logger.warn('[PDF Extractor] Native PDF extraction failed. Falling back to AI/OCR.', nativeErr);
    }

    // 2. AI/OCR Fallback Ingestion via AI Router
    logger.info('[PDF Extractor] Initializing AI Router PDF extraction fallback...');
    try {
      const prompt = "Extract all readable text, formulas, headings, and details from this PDF document. For each page, prefix the extracted text with a header line like '[Page X]' where X is the 1-based page number. Return ONLY the transcribed text. Do not summarize, do not explain, and do not add any markdown blocks or conversational text.";
      
      const routerResponse = await aiRouterService.routeRequest({
        prompt,
        pdfBase64: base64Data,
        requestType: 'pdf_extraction'
      });

      const extractedText = routerResponse?.text || '';
      if (!extractedText.trim()) {
        const emptyErr = new Error('AI extraction returned empty text.');
        emptyErr.code = 'EMPTY_CONTENT';
        throw emptyErr;
      }

      logger.info(`[PDF Extractor] Successfully extracted ${extractedText.length} characters of PDF text via AI Router.`);
      return extractedText.trim();
    } catch (err) {
      logger.error('[PDF Extractor] AI Router PDF text extraction failed:', err);
      // Propagate structured errors directly
      throw err;
    }
  }
}

export default new PDFExtractorService();
