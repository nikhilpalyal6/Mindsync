import StudySession from '../../models/studySession.model.js';
import aiProviderService from '../ai/aiProvider.service.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import pdfExtractorService from '../pdf/pdfExtractor.service.js';

const resolveCorrectAnswer = (correctAnswer, options, type) => {
  if (type === 'Fill in the Blank' || type === 'Short Answer') {
    return String(correctAnswer).trim();
  }

  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  const cleanAnswer = String(correctAnswer).trim();
  const cleanAnswerLower = cleanAnswer.toLowerCase();

  for (const opt of options) {
    if (opt.trim().toLowerCase() === cleanAnswerLower) {
      return opt;
    }
  }

  const parsedIndex = parseInt(cleanAnswer, 10);
  if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < options.length) {
    return options[parsedIndex];
  }

  const letterMatch = cleanAnswerLower.match(/^(?:option\s+)?([a-z])$/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    const charCodeIndex = letter.charCodeAt(0) - 65;
    if (charCodeIndex >= 0 && charCodeIndex < options.length) {
      return options[charCodeIndex];
    }
  }

  return null;
};

const repairAndValidateQuestion = (q) => {
  if (!q || !q.question || typeof q.question !== 'string' || !q.question.trim()) {
    return null;
  }
  
  const type = q.type && typeof q.type === 'string' ? q.type : 'Multiple Choice';
  const difficulty = q.difficulty && typeof q.difficulty === 'string' ? q.difficulty : 'Medium';
  const topic = q.topic && typeof q.topic === 'string' ? q.topic : 'General';
  const explanation = q.explanation && typeof q.explanation === 'string' ? q.explanation.trim() : 'No explanation provided.';
  const relatedConcepts = Array.isArray(q.relatedConcepts) ? q.relatedConcepts.filter(c => typeof c === 'string') : [];
  const learningObjectives = Array.isArray(q.learningObjectives) ? q.learningObjectives.filter(o => typeof o === 'string') : [];
  let options = Array.isArray(q.options) ? q.options.map(opt => String(opt).trim()) : [];
  
  if (type === 'True / False') {
    options = ['True', 'False'];
  } else if (type === 'Fill in the Blank' || type === 'Short Answer') {
    options = [];
  } else {
    options = [...new Set(options.filter(o => o.trim() !== ''))];
    
    if (options.length < 4) {
      const fillers = ['None of the above', 'All of the above', 'Not enough information', 'None of the options'];
      for (const filler of fillers) {
        if (options.length === 4) break;
        if (!options.map(o => o.toLowerCase()).includes(filler.toLowerCase())) {
          options.push(filler);
        }
      }
    }
    
    if (options.length !== 4) {
      return null;
    }
  }
  
  if (!q.correctAnswer) {
    return null;
  }
  
  const resolvedAnswer = resolveCorrectAnswer(q.correctAnswer, options, type);
  if (resolvedAnswer === null) {
    return null;
  }
  
  return {
    id: q.id && typeof q.id === 'string' ? q.id : crypto.randomUUID(),
    question: q.question.trim(),
    type,
    options,
    correctAnswer: resolvedAnswer,
    explanation,
    difficulty,
    topic: topic.trim(),
    points: Number(q.points) || (difficulty === 'Easy' ? 5 : difficulty === 'Hard' ? 15 : 10),
    relatedConcepts,
    learningObjectives,
    bookmarked: false,
    attempted: false,
    selectedAnswer: null,
    isCorrect: null,
    reviewCount: 0,
    lastReviewed: null,
    nextReview: null,
    createdAt: new Date().toISOString()
  };
};

const extractJSON = (text) => {
  if (!text) return '';
  
  const mdMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  let extracted = mdMatch ? mdMatch[1] : text;
  
  const firstBracket = extracted.indexOf('[');
  const firstBrace = extracted.indexOf('{');
  
  let startToken = -1;
  let endToken = -1;
  let braceType = '';
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startToken = firstBracket;
    braceType = 'bracket';
  } else if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startToken = firstBrace;
    braceType = 'brace';
  }
  
  if (startToken !== -1) {
    const openChar = braceType === 'bracket' ? '[' : '{';
    const closeChar = braceType === 'bracket' ? ']' : '}';
    
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = startToken; i < extracted.length; i++) {
      const char = extracted[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === openChar) depth++;
        if (char === closeChar) {
          depth--;
          if (depth === 0) {
            endToken = i;
            break;
          }
        }
      }
    }
  }
  
  if (startToken !== -1 && endToken !== -1) {
    return extracted.substring(startToken, endToken + 1);
  }
  
  if (startToken !== -1) {
    return extracted.substring(startToken);
  }
  
  return extracted.trim();
};

const parseJSONSafely = (text) => {
  const cleaned = text.trim();
  if (!cleaned) {
    return { success: false, error: 'Empty JSON text', isTruncated: false };
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    return { success: true, parsed };
  } catch (err) {
    try {
      let cleanText = cleaned;
      cleanText = cleanText.replace(/,\s*([\]}])/g, '$1');
      cleanText = cleanText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      cleanText = cleanText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      
      const parsed = JSON.parse(cleanText);
      return { success: true, parsed };
    } catch (innerErr) {
      const isTruncated = innerErr.message.includes('end of JSON input') || 
                          innerErr.message.includes('Unexpected end') ||
                          (!cleaned.endsWith(']') && !cleaned.endsWith('}'));
      return { success: false, error: innerErr.message, isTruncated };
    }
  }
};

class QuizService {
  /**
   * Extract content from the resource in the study session.
   */
  getResourceContent(session, resourceId, resourceType) {
    let content = '';
    let title = '';

    // 1. Find resource in resources array
    if (session.resources && Array.isArray(session.resources)) {
      const res = session.resources.find(
        r => r._id === resourceId || r.url === resourceId || r.title === resourceId || (r.type === resourceType && (r.url === resourceId || r._id === resourceId || r.title === resourceId))
      );
      if (res) {
        title = res.title || '';
        if (res.data) {
          if (res.type === 'pdf') {
            content = res.data.extractedText || '';
          } else if (res.type === 'youtube') {
            content = res.data.englishTranscript || res.data.transcript || res.data.originalTranscript || '';
          } else if (res.type === 'notes') {
            content = res.data.content || res.data.notesContent || res.data.noteContent || '';
          }
        }
      }
    }

    // 2. Fallback to session.metadata if resource content not found in resources array
    if (!content && session.metadata) {
      const meta = session.metadata;
      if (resourceType === 'pdf') {
        const pdf = meta.pdf || {};
        content = pdf.extractedText || meta.extractedText || '';
        title = pdf.filename || pdf.pdfFilename || '';
      } else if (resourceType === 'youtube') {
        const yt = meta.youtube || meta.video || {};
        if (yt.videoUrl === resourceId || yt.url === resourceId || meta.youtubeUrl === resourceId) {
          content = yt.englishTranscript || yt.transcript || yt.originalTranscript || '';
          title = yt.title || yt.videoTitle || '';
        }
      } else if (resourceType === 'notes') {
        const notes = meta.notes || {};
        if (notes.noteId === resourceId || notes.id === resourceId || resourceId === 'default_notes_id') {
          content = notes.content || notes.notesContent || notes.noteContent || meta.notesContent || meta.noteContent || '';
          title = notes.title || meta.noteTitle || 'Untitled Note';
        }
        if (!content && Array.isArray(meta.notesList)) {
          const note = meta.notesList.find(n => n.noteId === resourceId || n.title === resourceId);
          if (note) {
            content = note.content || '';
            title = note.title || '';
          }
        }
      }
    }

    return { content, title };
  }

  /**
   * Generate AI quiz or retrieve cached quiz.
   */
  async generateQuiz({ userId, studySessionId, resourceId, resourceType, forceRegenerate = false, quizType, difficulty, questionCount, topic, attemptMode, learningGoal }) {
    logger.info(`[Quiz Engine] Request: Session ${studySessionId}, Resource ${resourceId} (Type: ${resourceType}, Force: ${forceRegenerate})`);

    // 1. Fetch Study Session
    const session = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // Initialize resources array if missing
    if (!session.resources) {
      session.resources = [];
    }

    // 2. Locate Resource index in session.resources
    let resourceIndex = session.resources.findIndex(
      r => r._id === resourceId || r.url === resourceId || (r.type === resourceType && (r.url === resourceId || r._id === resourceId))
    );

    // If resource is not in array but metadata has it, link it
    if (resourceIndex === -1 && session.metadata) {
      let title = 'Resource';
      let data = {};
      if (resourceType === 'pdf' && session.metadata.pdf) {
        title = session.metadata.pdf.filename || 'PDF Document';
        data = session.metadata.pdf;
      } else if (resourceType === 'youtube' && session.metadata.youtube) {
        title = session.metadata.youtube.title || 'YouTube Video';
        data = session.metadata.youtube;
      } else if (resourceType === 'notes' && session.metadata.notes) {
        title = session.metadata.notes.title || 'Notes';
        data = session.metadata.notes;
      }

      session.resources.push({
        _id: new mongoose.Types.ObjectId().toString(),
        type: resourceType,
        url: resourceId,
        title,
        data,
        addedAt: new Date(),
        updatedAt: new Date()
      });
      resourceIndex = session.resources.length - 1;
    }

    if (resourceIndex === -1) {
      throw ApiError.notFound('Resource not found in study session');
    }

    const resource = session.resources[resourceIndex];

    // 3. Construct Cache Key based on configuration
    const qCount = questionCount || 'Auto';
    const qType = quizType || 'Mixed';
    const qDiff = difficulty || 'Mixed';
    const qTopic = topic ? topic.replace(/[^a-zA-Z0-9]/g, '_') : 'Entire_Resource';
    const qGoal = learningGoal ? learningGoal.replace(/[^a-zA-Z0-9]/g, '_') : 'Understand_Concepts';
    const cacheKey = `${qType}_${qDiff}_${qCount}_${qTopic}_${qGoal}`;

    if (!resource.ai) {
      resource.ai = {};
    }
    if (!resource.ai.quiz) {
      resource.ai.quiz = {};
    }
    if (!resource.ai.quiz.caches) {
      resource.ai.quiz.caches = {};
    }

    // 4. Check Config-based Cache
    if (!forceRegenerate && resource.ai.quiz.caches[cacheKey]) {
      logger.info(`[Quiz Engine] Configuration Cache Hit: Returning cached quiz for key: ${cacheKey}`);
      // Sync active fields for backward compatibility
      resource.ai.quiz = {
        ...resource.ai.quiz,
        ...resource.ai.quiz.caches[cacheKey]
      };

      await StudySession.findOneAndUpdate(
        { _id: studySessionId, user: userId },
        {
          $set: {
            [`resources.${resourceIndex}.ai.quiz`]: resource.ai.quiz
          }
        },
        { new: true }
      );

      return {
        success: true,
        cached: true,
        quiz: resource.ai.quiz,
        questions: resource.ai.quiz.questions
      };
    }

    // 5. Extract content
    let { content, title } = this.getResourceContent(session, resourceId, resourceType);
    if (resourceType === 'pdf' && (!content || !content.trim())) {
      const pdfMeta = session.metadata?.pdf || {};
      const fileData = pdfMeta.fileData || (session.resources?.find(r => r.type === 'pdf')?.data?.fileData);
      if (fileData) {
        logger.info(`[Quiz Engine] Auto-extracting empty PDF text...`);
        const extractedText = await pdfExtractorService.extractTextFromBase64(fileData);
        if (extractedText) {
          if (session.metadata?.pdf) {
            session.metadata.pdf.extractedText = extractedText;
            session.markModified('metadata');
          }
          if (session.resources) {
            session.resources.forEach(r => {
              if (r.type === 'pdf') {
                if (!r.data) r.data = {};
                r.data.extractedText = extractedText;
              }
            });
            session.markModified('resources');
          }
          await session.save();
          content = extractedText;
          title = pdfMeta.filename || 'PDF Document';
        }
      }
    }

    if (!content || !content.trim()) {
      throw ApiError.badRequest('No learning material found for this resource. Please make sure the content has been processed or transcript extracted.');
    }

    // 6. Build dynamic prompt instructions based on configuration
    let typeInstruction = '';
    if (quizType === 'Multiple Choice' || quizType === 'MCQ' || quizType === 'mcq') {
      typeInstruction = 'Generate ONLY "Multiple Choice" questions with exactly 4 options.';
    } else if (quizType === 'True / False' || quizType === 'true_false') {
      typeInstruction = 'Generate ONLY "True / False" questions with exactly 2 options: ["True", "False"].';
    } else if (quizType === 'Fill in the Blank' || quizType === 'fill_in_the_blank') {
      typeInstruction = 'Generate ONLY "Fill in the Blank" questions with an empty options array [].';
    } else if (quizType === 'Short Answer' || quizType === 'short_answer') {
      typeInstruction = 'Generate ONLY "Short Answer" questions with an empty options array [].';
    } else {
      typeInstruction = 'Generate a balanced mix of "Multiple Choice", "True / False", "Fill in the Blank", and "Short Answer" questions.';
    }

    let difficultyInstruction = '';
    if (difficulty && difficulty !== 'Mixed' && difficulty !== 'Default') {
      difficultyInstruction = `Generate ONLY "${difficulty}" difficulty questions.`;
    } else {
      difficultyInstruction = 'Generate questions with a balanced mix of "Easy", "Medium", and "Hard" difficulties.';
    }

    let countVal = 15;
    if (questionCount && questionCount !== 'Auto') {
      countVal = Number(questionCount) || 15;
    }
    const countInstruction = `Generate exactly ${countVal} questions.`;

    let topicInstruction = '';
    if (topic && topic !== 'Entire Resource') {
      topicInstruction = `All generated questions must focus specifically on the topic/concept: "${topic}".`;
    }

    let goalInstruction = '';
    if (learningGoal === 'Prepare for Exam') {
      goalInstruction = 'Design the quiz to prepare the student for university assessments. Questions must be balanced, time-efficient, and mirror professional exam styles.';
    } else if (learningGoal === 'Quick Revision') {
      goalInstruction = 'Optimize the quiz for quick revision. Prioritize high-yield concepts and keep questions/explanations very concise and fast to process.';
    } else if (learningGoal === 'Interview Preparation') {
      goalInstruction = 'Optimize the quiz for technical interview preparation. Prioritize hard conceptual questions, practical scenario-based problems, and logical thinking.';
    } else if (learningGoal === 'Master This Topic') {
      goalInstruction = 'Design the quiz for topic mastery. Questions should progress in trickiness, reinforcing weaker concepts and challenging logical edge cases.';
    } else {
      // Default: Understand Concepts
      goalInstruction = 'Design the quiz to build core concept understanding. Keep explanations beginner-friendly, educational, step-by-step, and simple to understand.';
    }

    // 7. Construct AI Prompt
    const systemInstruction = 
      `You are an expert AI Quiz Generator. Your task is to generate high-quality educational quizzes based on the provided learning material.
      
      Guidelines for generating the quiz:
      1. ${countInstruction}
      2. ${typeInstruction}
      3. ${difficultyInstruction}
      4. ${topicInstruction}
      5. ${goalInstruction}
      6. Generate questions to cover the important concepts in the provided text.
      7. Questions must be clear, concise, and academically rigorous.
      8. For each question, provide a detailed "explanation" resolving the concepts. The explanation must be educational, step-by-step, easy to understand, and suitable for beginners.
      9. Assign appropriate points to each question based on difficulty (e.g. Easy: 5, Medium: 10, Hard: 15).
      10. Identify key underlying concepts for the question (e.g. ["Recursion", "Call Stack", "DFS"]) and set them in the "relatedConcepts" array field.
      11. Identify specific learning objectives (e.g. ["Identify base cases", "Trace recursive calls"]) and set them in the "learningObjectives" array field.
      12. Output your response STRICTLY as a raw JSON object containing a "questions" array.
      13. Do NOT include markdown code block formatting (like \`\`\`json), no preamble, no explanations outside JSON, and no comments.
      
      JSON Schema format:
      {
        "questions": [
          {
            "question": "Question text...",
            "type": "Multiple Choice | True / False | Fill in the Blank | Short Answer",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "Exact correct answer option text",
            "difficulty": "Easy | Medium | Hard",
            "topic": "Concept Sub-topic",
            "points": 10,
            "explanation": "Step-by-step educational explanation suitable for beginners",
            "relatedConcepts": ["Concept A", "Concept B"],
            "learningObjectives": ["Objective A", "Objective B"]
          }
        ]
      }`;

    const userMessage = `Please generate an educational quiz covering the key concepts in the following content:\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 15000)}`;

    const messages = [{ role: 'user', content: userMessage }];

    // 8. Invoke AI Provider
    let rawResponse = '';
    const aiModel = aiProviderService.getModel();
    logger.info('[Quiz] Generation started');

    let formattedQuestions = [];
    let attempts = 0;
    const maxAttempts = 2; // Initial + 1 retry

    while (attempts < maxAttempts && formattedQuestions.length < countVal) {
      attempts++;
      let runMessages = [...messages];
      let runSystemInstruction = systemInstruction;

      if (attempts > 1) {
        logger.info('[Quiz] Retry started');
        runMessages.push({ role: 'assistant', content: rawResponse });
        runMessages.push({
          role: 'user',
          content: `The previous response was invalid, truncated, or had too few questions. ` +
            `You must return exactly ${countVal} questions matching the schema. ` +
            `Return ONLY valid JSON. Do not include markdown code block formatting (like \`\`\`json), no preamble, and no explanation. ` +
            `Ensure every question has options corresponding to its type (Multiple Choice must have exactly 4 non-empty options), and correctAnswer exactly matching one of the options.`
        });
      }

      try {
        rawResponse = await aiProviderService.generateAIResponse({
          messages: runMessages,
          systemInstruction: runSystemInstruction
        });
      } catch (err) {
        logger.error(`[Quiz Engine] AI Provider failed: ${err.message}`);
        if (attempts >= maxAttempts) {
          if (err.statusCode) throw err;
          throw ApiError.internal(`Failed to generate quiz via AI Service: ${err.message}`);
        }
        continue;
      }

      if (!rawResponse || !rawResponse.trim()) {
        logger.warn(`[Quiz Engine] Empty AI response received on attempt ${attempts}`);
        if (attempts >= maxAttempts) {
          logger.error('[Quiz] Generation failed');
        }
        continue;
      }

      logger.info('[Quiz] AI response received');
      
      const jsonText = extractJSON(rawResponse);
      const parseResult = parseJSONSafely(jsonText);

      if (!parseResult.success) {
        logger.warn('[Quiz] JSON parsing failed');
        if (attempts >= maxAttempts) {
          logger.error('[Quiz] Generation failed');
        }
        continue;
      }

      logger.info('[Quiz] JSON parsed');

      let questionsList = [];
      if (Array.isArray(parseResult.parsed)) {
        questionsList = parseResult.parsed;
      } else if (parseResult.parsed && typeof parseResult.parsed === 'object') {
        if (Array.isArray(parseResult.parsed.questions)) {
          questionsList = parseResult.parsed.questions;
        } else {
          const nestedArray = Object.values(parseResult.parsed).find(val => Array.isArray(val));
          if (nestedArray) {
            questionsList = nestedArray;
          } else {
            questionsList = [parseResult.parsed];
          }
        }
      }

      formattedQuestions = [];
      for (const q of questionsList) {
        const validated = repairAndValidateQuestion(q);
        if (validated) {
          formattedQuestions.push(validated);
        }
      }

      logger.info(`[Quiz] Questions validated: ${formattedQuestions.length}/${questionsList.length}`);

      if (formattedQuestions.length === 0) {
        logger.warn('[Quiz] Validation failed');
        if (attempts >= maxAttempts) {
          logger.error('[Quiz] Generation failed');
        }
      }
    }

    if (formattedQuestions.length === 0) {
      const err = ApiError.badRequest('Unable to generate quiz questions.');
      err.code = 'QUIZ_GENERATION_FAILED';
      throw err;
    }

    logger.info('[Quiz] Response normalized');
    const generatedAt = new Date().toISOString();
    const version = '1.0';

    // 11. Persist into session.resources under resource.ai.quiz
    const quizPayload = {
      questions: formattedQuestions,
      generatedAt,
      aiModel,
      version,
      estimatedTime: `${Math.ceil(formattedQuestions.length * 1.5)} minutes`,
      totalQuestions: formattedQuestions.length,
      totalPoints: formattedQuestions.reduce((acc, q) => acc + q.points, 0),
      lastAttempt: null,
      highestScore: null,
      averageScore: null,
      attemptCount: 0,
      adaptiveDifficulty: qDiff,
      learningGoal: learningGoal || 'Understand Concepts'
    };

    // Fetch fresh session to avoid stale data after slow AI generation call
    const freshSession = await StudySession.findOne({ _id: studySessionId, user: userId });
    if (!freshSession) {
      throw ApiError.notFound('Study session not found after generating quiz questions');
    }

    let freshResourceIndex = freshSession.resources.findIndex(
      r => r._id === resourceId || r.url === resourceId || (r.type === resourceType && (r.url === resourceId || r._id === resourceId))
    );
    if (freshResourceIndex === -1) {
      throw ApiError.notFound('Resource not found in session on final save');
    }

    const freshResource = freshSession.resources[freshResourceIndex];
    if (!freshResource.ai) freshResource.ai = {};
    if (!freshResource.ai.quiz) freshResource.ai.quiz = {};
    if (!freshResource.ai.quiz.caches) freshResource.ai.quiz.caches = {};

    // Store in configuration caches
    freshResource.ai.quiz.caches[cacheKey] = quizPayload;

    // Set active quiz for compatibility
    freshResource.ai.quiz = {
      ...freshResource.ai.quiz,
      ...quizPayload
    };

    // Calculate totalCount using fresh data
    let totalCount = 0;
    freshSession.resources.forEach((r, idx) => {
      const resToCount = idx === freshResourceIndex ? freshResource : r;
      if (resToCount.ai?.quiz?.questions) {
        totalCount += resToCount.ai.quiz.questions.length;
      }
    });

    let finalSession = null;
    try {
      finalSession = await StudySession.findOneAndUpdate(
        { _id: studySessionId, user: userId },
        {
          $set: {
            [`resources.${freshResourceIndex}.ai.quiz`]: freshResource.ai.quiz,
            quizCount: totalCount
          }
        },
        { new: true }
      );
    } catch (saveErr) {
      logger.warn(`[Quiz Engine] Primary atomic update failed: ${saveErr.message}. Retrying once with fresh document fetch...`);
      const retrySession = await StudySession.findOne({ _id: studySessionId, user: userId });
      if (!retrySession) {
        throw ApiError.notFound('Study session not found on retry');
      }
      let retryResourceIndex = retrySession.resources.findIndex(
        r => r._id === resourceId || r.url === resourceId || (r.type === resourceType && (r.url === resourceId || r._id === resourceId))
      );
      if (retryResourceIndex === -1) {
        throw ApiError.notFound('Resource not found in session on retry');
      }
      const retryResource = retrySession.resources[retryResourceIndex];
      if (!retryResource.ai) retryResource.ai = {};
      if (!retryResource.ai.quiz) retryResource.ai.quiz = {};
      if (!retryResource.ai.quiz.caches) retryResource.ai.quiz.caches = {};

      retryResource.ai.quiz.caches[cacheKey] = quizPayload;
      retryResource.ai.quiz = {
        ...retryResource.ai.quiz,
        ...quizPayload
      };

      let retryTotalCount = 0;
      retrySession.resources.forEach((r, idx) => {
        const resToCount = idx === retryResourceIndex ? retryResource : r;
        if (resToCount.ai?.quiz?.questions) {
          retryTotalCount += resToCount.ai.quiz.questions.length;
        }
      });

      finalSession = await StudySession.findOneAndUpdate(
        { _id: studySessionId, user: userId },
        {
          $set: {
            [`resources.${retryResourceIndex}.ai.quiz`]: retryResource.ai.quiz,
            quizCount: retryTotalCount
          }
        },
        { new: true }
      );
    }

    logger.info('[Quiz] Quiz generation completed');

    return {
      success: true,
      cached: false,
      quiz: resource.ai.quiz,
      questions: formattedQuestions
    };
  }

  /**
   * Retrieve cached quiz or return empty list.
   */
  async getQuiz({ userId, studySessionId, resourceId }) {
    logger.info(`[Quiz Engine] Get Request: Session ${studySessionId}, Resource ${resourceId}`);

    let session = null;
    if (studySessionId) {
      session = await StudySession.findOne({ _id: studySessionId, user: userId }).lean();
    } else {
      session = await StudySession.findOne({ user: userId, 'resources._id': resourceId }).lean();
      if (!session) {
        session = await StudySession.findOne({ user: userId, 'resources.url': resourceId }).lean();
      }
    }

    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    // Locate Resource
    const resource = session.resources?.find(r => r._id === resourceId || r.url === resourceId);
    const preferences = resource?.ai?.quiz?.preferences || null;

    if (resource?.ai?.quiz?.questions) {
      return {
        success: true,
        found: true,
        quiz: resource.ai.quiz,
        questions: resource.ai.quiz.questions,
        preferences
      };
    }

    return {
      success: true,
      found: false,
      quiz: null,
      questions: [],
      preferences
    };
  }

  /**
   * Update question attempt status or final attempt analytics.
   */
  async updateQuestionState({
    userId,
    studySessionId,
    resourceId,
    questionId,
    selectedAnswer,
    attempted,
    bookmarked,
    reviewCount,
    isCorrect,
    questions, // Full updated questions list for complete attempt submission
    timeTaken, // Time taken in seconds for complete attempt
    preferences
  }) {
    logger.info(`[Quiz Engine] Update Request: Question ${questionId} in Resource ${resourceId}`);

    let session = null;
    if (studySessionId) {
      session = await StudySession.findOne({ _id: studySessionId, user: userId });
    } else {
      session = await StudySession.findOne({ user: userId, 'resources._id': resourceId });
      if (!session) {
        session = await StudySession.findOne({ user: userId, 'resources.url': resourceId });
      }
    }

    if (!session) {
      throw ApiError.notFound('Study session not found or unauthorized');
    }

    const resourceIndex = session.resources?.findIndex(r => r._id === resourceId || r.url === resourceId);
    if (resourceIndex === -1 || resourceIndex === undefined) {
      throw ApiError.notFound('Resource not found in session');
    }

    const resource = session.resources[resourceIndex];

    // A.0. Handles Quiz Preference Persistence
    if (questionId === 'preferences') {
      if (!resource.ai) {
        resource.ai = {};
      }
      if (!resource.ai.quiz) {
        resource.ai.quiz = {};
      }
      resource.ai.quiz.preferences = {
        learningGoal: preferences?.learningGoal || 'Understand Concepts',
        quizType: preferences?.quizType || 'Mixed',
        difficulty: preferences?.difficulty || 'Mixed',
        questionCount: preferences?.questionCount || '10',
        attemptMode: preferences?.attemptMode || 'practice',
        lastUpdated: new Date().toISOString()
      };

      await StudySession.findOneAndUpdate(
        { _id: studySessionId || session._id, user: userId },
        {
          $set: {
            [`resources.${resourceIndex}.ai.quiz.preferences`]: resource.ai.quiz.preferences
          }
        },
        { new: true }
      );

      return {
        success: true,
        preferences: resource.ai.quiz.preferences
      };
    }

    if (!resource.ai?.quiz) {
      throw ApiError.badRequest('No active quiz found for this resource.');
    }

    // A. Handles Complete Attempt Submission
    if (questionId === 'complete') {
      const activeQuestions = Array.isArray(questions) ? questions : resource.ai.quiz.questions;
      
      const totalQuestions = activeQuestions.length;
      const attemptedQuestions = activeQuestions.filter(q => q.attempted);
      const correctQuestions = activeQuestions.filter(q => q.attempted && q.isCorrect);
      
      const attemptedCount = attemptedQuestions.length;
      const correctCount = correctQuestions.length;
      const wrongCount = attemptedCount - correctCount;

      // Accuracy: percentage of correct questions out of attempted ones
      const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
      const correctPercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      const wrongPercentage = totalQuestions > 0 ? Math.round((wrongCount / totalQuestions) * 100) : 0;
      const completionRate = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;

      // Calculated score is sum of points for correct questions
      const score = correctQuestions.reduce((acc, q) => acc + (q.points || 10), 0);

      // Spaced Repetition setup logic: Increment reviewCount, update lastReviewed and calculate nextReview date
      const updatedQuestions = activeQuestions.map(q => {
        if (q.attempted) {
          const nextReviewDays = q.isCorrect ? (q.reviewCount === 0 ? 1 : q.reviewCount * 3) : 1;
          const nextReviewDate = new Date();
          nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);

          return {
            ...q,
            reviewCount: (q.reviewCount || 0) + 1,
            lastReviewed: new Date().toISOString(),
            nextReview: nextReviewDate.toISOString()
          };
        }
        return q;
      });

      // Update quiz statistics
      const newAttemptCount = (resource.ai.quiz.attemptCount || 0) + 1;
      const currentHighest = resource.ai.quiz.highestScore || 0;
      const currentAverage = resource.ai.quiz.averageScore || 0;

      const newHighest = Math.max(currentHighest, score);
      const newAverage = Math.round(((currentAverage * (newAttemptCount - 1)) + score) / newAttemptCount);

      // Adaptive difficulty calculation: raise/lower quiz difficulty based on performance
      let adaptiveDifficulty = resource.ai.quiz.adaptiveDifficulty || 'Medium';
      if (accuracy >= 85) {
        adaptiveDifficulty = adaptiveDifficulty === 'Easy' ? 'Medium' : 'Hard';
      } else if (accuracy < 50) {
        adaptiveDifficulty = adaptiveDifficulty === 'Hard' ? 'Medium' : 'Easy';
      }

      // Save complete metrics
      resource.ai.quiz.questions = updatedQuestions;
      resource.ai.quiz.lastAttempt = new Date().toISOString();
      resource.ai.quiz.attemptCount = newAttemptCount;
      resource.ai.quiz.highestScore = newHighest;
      resource.ai.quiz.averageScore = newAverage;
      resource.ai.quiz.adaptiveDifficulty = adaptiveDifficulty;

      // Analytics payload to integrate with future dashboard
      resource.ai.quiz.analytics = {
        accuracy,
        correctPercentage,
        wrongPercentage,
        completionRate,
        timeTaken: timeTaken || 0,
        score,
        totalPoints: resource.ai.quiz.totalPoints,
        lastAttemptAt: new Date().toISOString(),
        correctCount,
        wrongCount,
        skippedCount: totalQuestions - attemptedCount
      };

      await StudySession.findOneAndUpdate(
        { _id: studySessionId || session._id, user: userId },
        {
          $set: {
            [`resources.${resourceIndex}.ai.quiz.questions`]: updatedQuestions,
            [`resources.${resourceIndex}.ai.quiz.lastAttempt`]: resource.ai.quiz.lastAttempt,
            [`resources.${resourceIndex}.ai.quiz.attemptCount`]: newAttemptCount,
            [`resources.${resourceIndex}.ai.quiz.highestScore`]: newHighest,
            [`resources.${resourceIndex}.ai.quiz.averageScore`]: newAverage,
            [`resources.${resourceIndex}.ai.quiz.adaptiveDifficulty`]: adaptiveDifficulty,
            [`resources.${resourceIndex}.ai.quiz.analytics`]: resource.ai.quiz.analytics
          }
        },
        { new: true }
      );

      return {
        success: true,
        quiz: resource.ai.quiz,
        questions: updatedQuestions
      };
    }

    // B. Handles Single Question State Modification
    const questionsList = resource.ai.quiz.questions || [];
    const questionIndex = questionsList.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
      throw ApiError.notFound('Question not found in quiz list');
    }

    const question = questionsList[questionIndex];

    if (selectedAnswer !== undefined) {
      question.selectedAnswer = selectedAnswer;
    }
    if (attempted !== undefined) {
      question.attempted = Boolean(attempted);
    }
    if (bookmarked !== undefined) {
      question.bookmarked = Boolean(bookmarked);
    }
    if (isCorrect !== undefined) {
      question.isCorrect = Boolean(isCorrect);
    }
    if (reviewCount !== undefined) {
      question.reviewCount = Number(reviewCount);
    }

    questionsList[questionIndex] = question;
    resource.ai.quiz.questions = questionsList;
    await StudySession.findOneAndUpdate(
      { _id: studySessionId || session._id, user: userId },
      {
        $set: {
          [`resources.${resourceIndex}.ai.quiz.questions`]: questionsList
        }
      },
      { new: true }
    );

    return {
      success: true,
      question
    };
  }
}

export default new QuizService();
