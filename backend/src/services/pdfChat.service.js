import PDFChat from '../models/pdfChat.model.js';
import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import pdfExtractorService from './pdf/pdfExtractor.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';


// Helper to detect specific page number requests in a query
function detectRequestedPages(message, totalPages) {
  const pages = new Set();
  
  // Look for patterns like "page 20", "page 15", "pages 15-18", "p. 20", etc.
  const regexes = [
    /\bpages?\s*(\d+)(?:\s*(?:to|and|-)\s*(\d+))?\b/gi,
    /\bp\.\s*(\d+)(?:\s*(?:to|and|-)\s*(\d+))?\b/gi
  ];
  
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(message)) !== null) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      if (start > 0 && start <= totalPages) {
        pages.add(start);
      }
      if (end > 0 && end <= totalPages) {
        for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
          pages.add(p);
        }
      }
    }
  }

  // Look for "last page"
  if (/\blast\s*pages?\b/i.test(message)) {
    pages.add(totalPages);
  }

  return Array.from(pages);
}

// Helper to parse pages from legacy extractedText string
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
    // Fallback: treat the entire text as page 1
    return [{
      pageNumber: 1,
      text: extractedText,
      extractionStatus: 'completed',
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
      extractionStatus: 'completed',
      wordCount: text.split(/\s+/).filter(Boolean).length
    });
  }

  return pages;
}

// Helper to score and select the most relevant pages for LLM context
function selectRelevantPages(pages, message, requestedPageNums, limitChars = 250000) {
  const selectedPages = [];
  const selectedPageNums = new Set();

  const addPage = (page) => {
    if (page && !selectedPageNums.has(page.pageNumber)) {
      selectedPages.push(page);
      selectedPageNums.add(page.pageNumber);
    }
  };

  // If specific page numbers were requested, we ONLY include them and nothing else!
  if (requestedPageNums && requestedPageNums.length > 0) {
    for (const pageNum of requestedPageNums) {
      const page = pages.find(p => p.pageNumber === pageNum);
      if (page) addPage(page);
    }
    selectedPages.sort((a, b) => a.pageNumber - b.pageNumber);
    return selectedPages;
  }

  // Score remaining pages by keyword matches (for general questions)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'tell', 'me', 'please', 'what', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'been', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
  
  const cleanString = (str) => (str || '').toLowerCase().replace(/[^\w]/g, ' ');
  
  const keywords = cleanString(message)
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const scoredPages = pages
    .map(p => {
      let score = 0;
      if (p.text) {
        const cleanText = cleanString(p.text);
        const words = cleanText.split(/\s+/).filter(Boolean);
        for (const word of keywords) {
          const count = words.filter(w => w === word).length;
          score += count;
        }
      }
      return { page: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  let currentLength = 0;

  for (const item of scoredPages) {
    const textLen = (item.page.text || '').length;
    if (currentLength + textLen < limitChars) {
      addPage(item.page);
      currentLength += textLen;
    } else {
      break;
    }
  }

  // If we still have room, add pages in sequence
  for (const page of pages) {
    const textLen = (page.text || '').length;
    if (currentLength + textLen < limitChars) {
      addPage(page);
      currentLength += textLen;
    } else {
      break;
    }
  }

  selectedPages.sort((a, b) => a.pageNumber - b.pageNumber);
  return selectedPages;
}

class PDFChatService {
  /**
   * Retrieve PDF-specific chat history
   */
  async getPDFChatHistory({ userId, workspaceId, resourceId }) {
    // Verify study session ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    let pdfChat = await PDFChat.findOne({ workspaceId, resourceId });
    if (!pdfChat) {
      pdfChat = await PDFChat.create({
        workspaceId,
        resourceId,
        messages: []
      });
    }

    return pdfChat;
  }

  /**
   * Send a message to the PDF AI assistant and generate a response grounded only in the PDF text
   */
  async sendPDFChatMessage({ userId, workspaceId, resourceId, message }) {
    // 1. Verify study session ownership
    const session = await StudySession.findOne({ _id: workspaceId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // 2. Fetch or create PDFChat record
    let pdfChat = await PDFChat.findOne({ workspaceId, resourceId });
    if (!pdfChat) {
      pdfChat = new PDFChat({
        workspaceId,
        resourceId,
        messages: []
      });
    }

    // 3. Extract PDF text content
    let pdfText = '';
    let pages = [];
    let pageCount = 0;

    const resource = session.resources?.find(
      r => r.type === 'pdf' && (
        (r._id && r._id.toString() === resourceId) ||
        r.url === resourceId ||
        r.title === resourceId
      )
    );

    if (resource?.data) {
      pdfText = resource.data.extractedText || '';
      pages = resource.data.pages || [];
      pageCount = resource.data.pageCount || resource.data.totalPages || 0;
    } else if (session.metadata?.pdf) {
      pdfText = session.metadata.pdf.extractedText || '';
      pages = session.metadata.pdf.pages || [];
      pageCount = session.metadata.pdf.pageCount || session.metadata.pdf.totalPages || 0;
    }

    if (!pdfText && (!pages || pages.length === 0)) {
      // Auto extraction trigger fallback
      const pdfMeta = session.metadata?.pdf || {};
      const fileData = pdfMeta.fileData || resource?.data?.fileData;
      if (fileData) {
        logger.info(`[PDF Chat Service] Text is empty. Triggering auto-extraction...`);
        pdfText = await pdfExtractorService.extractTextFromBase64(fileData);
        if (pdfText) {
          pages = parsePagesFromExtractedText(pdfText);
          pageCount = pages.length;
          const updates = {
            extractedText: pdfText,
            pageCount,
            totalPages: pageCount,
            processedPages: pageCount,
            successfulPages: pageCount,
            failedPages: 0,
            extractionStatus: 'completed',
            pages
          };
          if (session.metadata?.pdf) {
            session.metadata.pdf = { ...session.metadata.pdf, ...updates };
            session.markModified('metadata');
          }
          if (resource) {
            resource.data = { ...(resource.data || {}), ...updates };
            session.markModified('resources');
          }
          await session.save();
        }
      }
    }

    if ((!pdfText || !pdfText.trim()) && (!pages || pages.length === 0)) {
      throw ApiError.badRequest("I can see that a PDF is open, but its contents haven't been processed yet.");
    }

    // Ensure we have a populated pages array (parse legacy extractedText if necessary)
    if ((!pages || pages.length === 0) && pdfText) {
      pages = parsePagesFromExtractedText(pdfText);
      pageCount = pages.length;
    }

    // Set fallback pageCount if not set
    if (!pageCount && pages && pages.length > 0) {
      pageCount = pages.length;
    }

    // Detect if specific pages are mentioned in the query
    const requestedPageNums = detectRequestedPages(message, pageCount || pages.length);
    logger.info(`[PDF Chat Service] Detected requested pages in query: ${JSON.stringify(requestedPageNums)}`);

    // Select the most relevant pages
    const relevantPages = selectRelevantPages(pages, message, requestedPageNums);
    logger.info(`[PDF Chat Service] Selected ${relevantPages.length} relevant pages out of ${pages.length} total pages.`);

    // Build context
    const selectedPagesText = relevantPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');

    // 4. Construct isolated prompt
    const systemInstruction = 
      `You are an AI assistant.\n` +
      `Only answer using the PDF content provided below. ` +
      `If the answer is not contained inside the PDF, say "I couldn't find this information in the uploaded PDF."\n\n` +
      `PDF Content:\n${selectedPagesText}\n\n`;

    // 5. Structure conversation history
    const apiMessages = [
      ...pdfChat.messages.map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    // 6. Invoke AI Provider
    let aiResponseText = '';
    try {
      const aiResponse = await aiProviderService.generateAIResponse({
        messages: apiMessages,
        systemInstruction
      });
      aiResponseText = aiResponse.text || aiResponse.toString() || '';
    } catch (err) {
      logger.error('[PDF Chat Service] AI generation failed:', err);
      throw ApiError.internal(`AI Assistant failed to generate response: ${err.message}`);
    }

    // 7. Save conversation messages
    pdfChat.messages.push({ role: 'user', content: message, timestamp: new Date() });
    pdfChat.messages.push({ role: 'assistant', content: aiResponseText, timestamp: new Date() });
    await pdfChat.save();

    return {
      success: true,
      userMessage: pdfChat.messages[pdfChat.messages.length - 2],
      assistantMessage: pdfChat.messages[pdfChat.messages.length - 1],
      history: pdfChat.messages
    };
  }
}

export default new PDFChatService();
