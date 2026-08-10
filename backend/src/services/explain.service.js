import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';
import pdfExtractorService from './pdf/pdfExtractor.service.js';
import Highlight from '../models/highlight.model.js';

class ExplainService {
  /**
   * Explain a concept: AI Reuse First flow -> AI router query -> Cache save
   */
  async explainConcept({ userId, concept, question, answer, resourceId, resourceType, studySessionId, difficulty = 'Medium', mode }) {
    const targetConcept = (concept || answer || question || '').trim();
    if (!targetConcept || !resourceId || !studySessionId) {
      throw ApiError.badRequest('Missing concept, resourceId, or studySessionId');
    }

    logger.info(`[Explain] Request received`);
    logger.info(`[Explain] Resource ID: ${resourceId}`);
    logger.info(`[Explain] Concept received: "${targetConcept}"`);

    // Determine target difficulty level based on mode
    let targetDifficulty = difficulty;
    if (mode === 'simpler') {
      targetDifficulty = 'Easy';
    } else if (mode === 'deeper') {
      targetDifficulty = 'Hard';
    }

    // 1. Load active study session
    const session = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found');
    }

    // 2. Find matching resource
    let resourceIndex = session.resources.findIndex(
      r => r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId
    );

    // If resource is not in array but metadata has it, link it
    if (resourceIndex === -1 && session.metadata) {
      const type = resourceType || (session.metadata.activeResourceType || session.metadata.lastTab || 'pdf').toLowerCase();
      let title = 'Resource';
      let data = {};
      if (type === 'pdf' && session.metadata.pdf) {
        title = session.metadata.pdf.filename || 'PDF Document';
        data = session.metadata.pdf;
      } else if (type === 'youtube' && session.metadata.youtube) {
        title = session.metadata.youtube.title || 'YouTube Video';
        data = session.metadata.youtube;
      } else if (type === 'notes' && session.metadata.notes) {
        title = session.metadata.notes.title || 'Notes';
        data = session.metadata.notes;
      }

      session.resources.push({
        type,
        url: resourceId,
        title,
        data,
        addedAt: new Date(),
        updatedAt: new Date()
      });
      await session.save();
      resourceIndex = session.resources.length - 1;
    }

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in session');
    }

    const resource = session.resources[resourceIndex];

    // Auto-extract text if PDF and empty
    if (resource.type === 'pdf' && (!resource.data?.extractedText || !resource.data.extractedText.trim())) {
      const pdfMeta = session.metadata?.pdf || {};
      const fileData = pdfMeta.fileData || resource.data?.fileData;
      if (fileData) {
        logger.info(`[Explain Engine] Auto-extracting empty PDF text...`);
        const extractedText = await pdfExtractorService.extractTextFromBase64(fileData);
        if (extractedText) {
          if (session.metadata?.pdf) {
            session.metadata.pdf.extractedText = extractedText;
            session.markModified('metadata');
          }
          resource.data = {
            ...(resource.data || {}),
            extractedText
          };
          session.resources[resourceIndex] = resource;
          session.markModified('resources');
          await session.save();
        }
      }
    }

    // Ensure ai container exists on resource
    if (!resource.ai) resource.ai = {};
    if (!resource.ai.explanations) resource.ai.explanations = [];

    // --- CHECK 1: Stored Explanations (Smart Cache) ---
    const existingExplanation = resource.ai.explanations.find(
      e => e.concept.toLowerCase() === targetConcept.toLowerCase() && 
           e.difficulty.toLowerCase() === targetDifficulty.toLowerCase()
    );

    if (existingExplanation) {
      logger.info(`[Explain Service] Smart Cache Hit: Found existing explanation for concept "${targetConcept}" (${targetDifficulty})`);
      return { ...existingExplanation, cached: true };
    }

    // --- AI REUSE FIRST: SEARCH RESOURCE DATA FOR GROUNDING CONTEXT ---
    let backgroundContext = '';

    // A. Search Quiz Questions
    if (resource.ai.quiz?.questions) {
      const matchedQuizQuestions = resource.ai.quiz.questions.filter(q => 
        (q.question && q.question.toLowerCase().includes(targetConcept.toLowerCase())) ||
        (q.explanation && q.explanation.toLowerCase().includes(targetConcept.toLowerCase()))
      );
      if (matchedQuizQuestions.length > 0) {
        backgroundContext += `[Quiz Questions context]: ${matchedQuizQuestions.map(q => `Q: ${q.question} | Explanation: ${q.explanation}`).join('\n')}\n`;
      }
    }

    // B. Search Summary
    if (resource.ai.summary) {
      let summaryText = '';
      if (typeof resource.ai.summary === 'string') {
        summaryText = resource.ai.summary;
      } else if (resource.ai.summary.chapters) {
        summaryText = JSON.stringify(resource.ai.summary.chapters);
      } else if (Array.isArray(resource.ai.summary)) {
        summaryText = JSON.stringify(resource.ai.summary);
      }
      
      if (summaryText && summaryText.toLowerCase().includes(targetConcept.toLowerCase())) {
        backgroundContext += `[Summary context]: ${summaryText.substring(0, 1500)}...\n`;
      }
    }

    // C. Search Flashcards
    if (resource.ai.flashcards && Array.isArray(resource.ai.flashcards.cards)) {
      const matchedCards = resource.ai.flashcards.cards.filter(c =>
        (c.question && c.question.toLowerCase().includes(targetConcept.toLowerCase())) ||
        (c.answer && c.answer.toLowerCase().includes(targetConcept.toLowerCase()))
      );
      if (matchedCards.length > 0) {
        backgroundContext += `[Flashcard context]: ${matchedCards.map(c => `Question: ${c.question} | Answer: ${c.answer}`).join('\n')}\n`;
      }
    }

    // D. Search Resource Metadata
    if (resource.data?.relatedConcepts) {
      const match = resource.data.relatedConcepts.find(c => c.toLowerCase() === targetConcept.toLowerCase());
      if (match) {
        backgroundContext += `[Related concept matches]: ${targetConcept} is explicitly flagged in list of resource concepts.\n`;
      }
    }
    if (resource.data?.learningObjectives) {
      const match = resource.data.learningObjectives.find(o => o.toLowerCase().includes(targetConcept.toLowerCase()));
      if (match) {
        backgroundContext += `[Learning objective context]: ${match}\n`;
      }
    }

    // E. Ground with raw text content directly
    if (resource.type === 'pdf') {
      const pdfText = resource.data?.extractedText || session.metadata?.pdf?.extractedText || '';
      if (pdfText) {
        const isSavedHighlight = await Highlight.exists({ userId, resourceId, text: targetConcept });
        if (isSavedHighlight) {
          const idx = pdfText.toLowerCase().indexOf(targetConcept.toLowerCase());
          if (idx !== -1) {
            const start = Math.max(0, idx - 300);
            const end = Math.min(pdfText.length, idx + targetConcept.length + 300);
            const context = pdfText.substring(start, end).trim();
            backgroundContext += `[Highlighted Concept Context]:\n... ${context} ...\n`;
          } else {
            backgroundContext += `[Highlighted Concept]:\n${targetConcept}\n`;
          }
        } else {
          backgroundContext += `[Extracted PDF text content]:\n${pdfText.slice(0, 4000)}\n`;
        }
      }
    } else if (resource.type === 'notes') {
      const notesText = resource.data?.content || session.metadata?.notes?.content || '';
      if (notesText) {
        backgroundContext += `[Notes content]:\n${notesText.slice(0, 4000)}\n`;
      }
    } else if (resource.type === 'youtube') {
      const ytTranscript = resource.data?.transcript || session.metadata?.youtube?.transcript || '';
      if (ytTranscript) {
        backgroundContext += `[Video transcript content]:\n${ytTranscript.slice(0, 4000)}\n`;
      }
    }

    // 3. Invoke AI Router to generate structured explanation
    logger.info(`[Explain Service] Cache Miss. Querying AI Router for concept explanation: "${targetConcept}" (${targetDifficulty})`);
    
    const systemInstruction = 
      `You are MindSync's AI learning tutor.\n` +
      `Your job is to teach the concept from the provided flashcard.\n` +
      `Do not merely repeat or paraphrase the answer.\n` +
      `Explain the concept in a way that helps a student understand, remember, and apply it.\n` +
      `Start with a simple explanation.\n` +
      `Then explain how it works when applicable.\n` +
      `Give one clear example.\n` +
      `Highlight the most important points.\n` +
      `Include a short memory aid or takeaway when useful.\n` +
      `Stay strictly focused on the provided concept.\n` +
      `Preserve the terminology and meaning of the source material.\n` +
      `Do not invent facts or unrelated information.\n` +
      `If the provided concept is already simple, keep the explanation concise.\n` +
      `If the concept is technically difficult, explain it progressively from basic intuition to technical detail.\n\n` +
      `You must explain the requested concept inside the context of the student's resource: "${resource.title || 'Study Material'}".\n\n` +
      `When explaining, return strictly a structured JSON object with the following schema:\n` +
      `{\n` +
      `  "title": "Short descriptive title",\n` +
      `  "difficulty": "Easy" | "Medium" | "Hard",\n` +
      `  "simpleExplanation": "Clear beginner explanation. Avoid jargon.",\n` +
      `  "howItWorks": ["Step 1...", "Step 2..."],\n` +
      `  "example": "An intuitive real-world or technical example",\n` +
      `  "keyPoints": ["Important point 1", "Important point 2"],\n` +
      `  "remember": "A short memory trick or one-line takeaway when appropriate"\n` +
      `}\n\n` +
      `Do not include markdown tags (\`\`\`json) outside the JSON output. Just output the raw JSON object.`;

    let promptContent = '';
    if (question && answer) {
      promptContent = `Provide a concept explanation for this flashcard:\nQuestion: "${question}"\nAnswer/Concept: "${answer}"\n`;
    } else {
      promptContent = `Provide a concept explanation for: "${targetConcept}".\n`;
    }
    promptContent += `Target difficulty: ${targetDifficulty}.\n`;

    if (backgroundContext) {
      promptContent += `\nGround the explanation in the student's existing study resource details:\n${backgroundContext}`;
    }

    logger.info(`[Explain] AI request started`);
    const aiResponse = await aiProviderService.generateAIResponse({
      messages: [{ role: 'user', content: promptContent }],
      systemInstruction,
      jsonMode: true
    });
    logger.info(`[Explain] AI response received`);

    // Parse the response
    let parsedExplanation;
    const responseText = (aiResponse.text || aiResponse.toString() || '').trim();
    try {
      if (typeof responseText === 'object') {
        parsedExplanation = responseText;
      } else {
        parsedExplanation = JSON.parse(responseText);
      }
    } catch (parseErr) {
      logger.warn(`[Explain Service] JSON parse failed. Extracting JSON string...`);
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedExplanation = JSON.parse(match[0].trim());
        } catch (innerErr) {
          logger.error(`[Explain Service] Extracting JSON object failed. Raw response: ${responseText}`);
          throw ApiError.internal(`AI response parsing failed: Invalid JSON structure generated by AI model.`);
        }
      } else {
        logger.error(`[Explain Service] No JSON object found in response. Raw response: ${responseText}`);
        throw ApiError.internal(`AI response parsing failed: No JSON object found in AI response.`);
      }
    }

    // 4. Construct complete Explanation Object
    const newExplanation = {
      id: new mongoose.Types.ObjectId().toString(),
      concept: targetConcept,
      difficulty: parsedExplanation.difficulty || targetDifficulty,
      title: parsedExplanation.title || `${targetConcept} Explained`,
      simpleExplanation: parsedExplanation.simpleExplanation || '',
      stepByStep: parsedExplanation.howItWorks || parsedExplanation.stepByStep || [],
      howItWorks: parsedExplanation.howItWorks || parsedExplanation.stepByStep || [],
      realWorldExample: parsedExplanation.example || parsedExplanation.realWorldExample || '',
      example: parsedExplanation.example || parsedExplanation.realWorldExample || '',
      keyPoints: parsedExplanation.keyPoints || parsedExplanation.learningObjectives || [],
      learningObjectives: parsedExplanation.keyPoints || parsedExplanation.learningObjectives || [],
      remember: parsedExplanation.remember || '',
      visualAnalogy: parsedExplanation.visualAnalogy || '',
      commonMistakes: parsedExplanation.commonMistakes || '',
      relatedConcepts: parsedExplanation.relatedConcepts || [],
      estimatedReadingTime: parsedExplanation.estimatedReadingTime || '2 minutes',
      generatedAt: new Date().toISOString(),
      version: '1.0',
      aiModel: aiProviderService.getModel()
    };

    logger.info(`[Explain] Response normalized`);

    // 5. Store explanation inside study session resources atomically
    resource.ai.explanations.push(newExplanation);

    await StudySession.findOneAndUpdate(
      { _id: studySessionId, user: userId },
      {
        $set: {
          [`resources.${resourceIndex}.ai.explanations`]: resource.ai.explanations
        }
      },
      { new: true }
    );

    logger.info(`[Explain] Explanation saved`);
    return { ...newExplanation, cached: false };
  }

  /**
   * Fetch all explanations stored for a resource
   */
  async getExplanations({ userId, resourceId, studySessionId }) {
    if (!resourceId || !studySessionId) {
      throw ApiError.badRequest('Missing resourceId or studySessionId');
    }

    const session = await StudySession.findOne({ _id: studySessionId, user: userId }).lean();
    if (!session) {
      throw ApiError.notFound('Study session not found');
    }

    const resource = session.resources.find(
      r => r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId
    );
    if (!resource) {
      return [];
    }

    return resource.ai?.explanations || [];
  }

  /**
   * Update feedback status of a stored explanation
   */
  async updateFeedback({ userId, explanationId, resourceId, studySessionId, feedback }) {
    if (!explanationId || !resourceId || !studySessionId || !feedback) {
      throw ApiError.badRequest('Missing explanationId, resourceId, studySessionId, or feedback');
    }

    const session = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found');
    }

    const resourceIndex = session.resources.findIndex(
      r => r._id?.toString() === resourceId || r.url === resourceId || r.title === resourceId
    );
    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in session');
    }

    const resource = session.resources[resourceIndex];
    if (!resource.ai?.explanations) {
      throw ApiError.notFound('No explanations found on resource');
    }

    const expIndex = resource.ai.explanations.findIndex(e => e.id === explanationId);
    if (expIndex === -1) {
      throw ApiError.notFound('Explanation not found');
    }

    // Set feedback tag
    resource.ai.explanations[expIndex].feedback = feedback;

    await StudySession.findOneAndUpdate(
      { _id: studySessionId, user: userId },
      {
        $set: {
          [`resources.${resourceIndex}.ai.explanations`]: resource.ai.explanations
        }
      },
      { new: true }
    );

    logger.info(`[Explain Service] Registered feedback "${feedback}" on explanation: ${explanationId}`);
    return resource.ai.explanations[expIndex];
  }
}

export default new ExplainService();
