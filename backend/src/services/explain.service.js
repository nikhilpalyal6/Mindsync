import StudySession from '../models/studySession.model.js';
import aiProviderService from './ai/aiProvider.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';
import pdfExtractorService from './pdf/pdfExtractor.service.js';

class ExplainService {
  /**
   * Explain a concept: AI Reuse First flow -> AI router query -> Cache save
   */
  async explainConcept({ userId, concept, resourceId, resourceType, studySessionId, difficulty = 'Medium', mode }) {
    if (!concept || !resourceId || !studySessionId) {
      throw ApiError.badRequest('Missing concept, resourceId, or studySessionId');
    }

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
      e => e.concept.toLowerCase() === concept.toLowerCase() && 
           e.difficulty.toLowerCase() === targetDifficulty.toLowerCase()
    );

    if (existingExplanation) {
      logger.info(`[Explain Service] Smart Cache Hit: Found existing explanation for concept "${concept}" (${targetDifficulty})`);
      return { ...existingExplanation, cached: true };
    }

    // --- AI REUSE FIRST: SEARCH RESOURCE DATA FOR GROUNDING CONTEXT ---
    let backgroundContext = '';

    // A. Search Quiz Questions
    if (resource.ai.quiz?.questions) {
      const matchedQuizQuestions = resource.ai.quiz.questions.filter(q => 
        (q.question && q.question.toLowerCase().includes(concept.toLowerCase())) ||
        (q.explanation && q.explanation.toLowerCase().includes(concept.toLowerCase()))
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
      
      if (summaryText && summaryText.toLowerCase().includes(concept.toLowerCase())) {
        backgroundContext += `[Summary context]: ${summaryText.substring(0, 1500)}...\n`;
      }
    }

    // C. Search Flashcards
    if (resource.ai.flashcards) {
      const matchedCards = resource.ai.flashcards.filter(c =>
        (c.front && c.front.toLowerCase().includes(concept.toLowerCase())) ||
        (c.back && c.back.toLowerCase().includes(concept.toLowerCase()))
      );
      if (matchedCards.length > 0) {
        backgroundContext += `[Flashcard context]: ${matchedCards.map(c => `Front: ${c.front} | Back: ${c.back}`).join('\n')}\n`;
      }
    }

    // D. Search Resource Metadata
    if (resource.data?.relatedConcepts) {
      const match = resource.data.relatedConcepts.find(c => c.toLowerCase() === concept.toLowerCase());
      if (match) {
        backgroundContext += `[Related concept matches]: ${concept} is explicitly flagged in list of resource concepts.\n`;
      }
    }
    if (resource.data?.learningObjectives) {
      const match = resource.data.learningObjectives.find(o => o.toLowerCase().includes(concept.toLowerCase()));
      if (match) {
        backgroundContext += `[Learning objective context]: ${match}\n`;
      }
    }

    // E. Ground with raw text content directly
    if (resource.type === 'pdf') {
      const pdfText = resource.data?.extractedText || session.metadata?.pdf?.extractedText || '';
      if (pdfText) {
        backgroundContext += `[Extracted PDF text content]:\n${pdfText.slice(0, 4000)}\n`;
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
    logger.info(`[Explain Service] Cache Miss. Querying AI Router for concept explanation: "${concept}" (${targetDifficulty})`);
    
    const systemInstruction = 
      `You are MindSync AI, an expert, encouraging, and clear AI teacher. ` +
      `Your role is to explain concepts clearly, simplify complex ideas, teach step-by-step, ` +
      `provide practical examples, and foster an active learning environment.\n` +
      `You must explain the requested concept inside the context of the student's resource: "${resource.title || 'Study Material'}".\n\n` +
      `When explaining, return strictly a structured JSON object with the following schema:\n` +
      `{\n` +
      `  "title": "Short descriptive title",\n` +
      `  "difficulty": "Easy" | "Medium" | "Hard",\n` +
      `  "simpleExplanation": "Clear beginner explanation. Avoid jargon.",\n` +
      `  "stepByStep": ["Step 1...", "Step 2..."],\n` +
      `  "realWorldExample": "An intuitive real-world example",\n` +
      `  "visualAnalogy": "A visual analogy showing the concept structure",\n` +
      `  "commonMistakes": "Common misconceptions or pitfalls",\n` +
      `  "relatedConcepts": ["Concept A", "Concept B"],\n` +
      `  "learningObjectives": ["Objective A", "Objective B"],\n` +
      `  "estimatedReadingTime": "e.g., 2 minutes"\n` +
      `}\n\n` +
      `Do not include markdown tags (\`\`\`json) outside the JSON output. Just output the raw JSON object.`;

    let promptContent = `Provide a concept explanation for: "${concept}". Target difficulty: ${targetDifficulty}.\n`;
    if (backgroundContext) {
      promptContent += `\nGround the explanation in the student's existing study resource details:\n${backgroundContext}`;
    }

    const aiResponse = await aiProviderService.generateAIResponse({
      messages: [{ role: 'user', content: promptContent }],
      systemInstruction,
      jsonMode: true
    });

    // Parse the response
    let parsedExplanation;
    try {
      const responseText = aiResponse.text || aiResponse.toString();
      parsedExplanation = JSON.parse(responseText.trim());
    } catch (parseErr) {
      logger.warn(`[Explain Service] JSON parse failed. Extracting JSON string...`);
      const responseText = aiResponse.text || aiResponse.toString();
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedExplanation = JSON.parse(match[0].trim());
      } else {
        throw new Error('AI provider failed to return structured explanation JSON.');
      }
    }

    // 4. Construct complete Explanation Object
    const newExplanation = {
      id: new mongoose.Types.ObjectId().toString(),
      concept,
      difficulty: parsedExplanation.difficulty || targetDifficulty,
      title: parsedExplanation.title || `${concept} Explained`,
      simpleExplanation: parsedExplanation.simpleExplanation || '',
      stepByStep: parsedExplanation.stepByStep || [],
      realWorldExample: parsedExplanation.realWorldExample || '',
      visualAnalogy: parsedExplanation.visualAnalogy || '',
      commonMistakes: parsedExplanation.commonMistakes || '',
      relatedConcepts: parsedExplanation.relatedConcepts || [],
      learningObjectives: parsedExplanation.learningObjectives || [],
      estimatedReadingTime: parsedExplanation.estimatedReadingTime || '2 minutes',
      generatedAt: new Date().toISOString(),
      version: '1.0',
      aiModel: aiProviderService.getModel()
    };

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

    logger.info(`[Explain Service] Saved explanation for concept "${concept}" to resource.`);
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
