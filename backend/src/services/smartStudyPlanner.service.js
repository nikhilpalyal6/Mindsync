import aiProviderService from './ai/aiProvider.service.js';
import StudySession from '../models/studySession.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

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

// Chunk PDF pages to prevent token overflows
function chunkPdfPages(pages, maxWords = 3500) {
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;
  
  for (const page of pages) {
    if (currentWordCount + page.wordCount > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentWordCount = 0;
    }
    currentChunk.push(page);
    currentWordCount += page.wordCount;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

// Chunk text (for YouTube transcripts)
function chunkText(text, maxWords = 3500) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

// Clean markdown tags from JSON responses
function parseCleanJson(text) {
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.substring(7);
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3);
  }
  return JSON.parse(clean.trim());
}

class SmartStudyPlannerService {
  async _getResourceContent(userId, resId) {
    const session = await StudySession.findOne({
      user: userId,
      $or: [
        { 'resources._id': resId },
        { 'resources.url': resId }
      ]
    });
    if (!session) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, `You do not own or have access to resource: ${resId}`);
    }
    const resource = session.resources.find(r => r._id.toString() === resId.toString() || r.url === resId);
    if (!resource) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, `Resource not found: ${resId}`);
    }

    let text = '';
    let type = resource.type; // 'pdf' or 'youtube'
    let title = resource.title || resId;

    if (type === 'pdf') {
      text = resource.data?.extractedText || session.metadata?.pdf?.extractedText || '';
    } else if (type === 'youtube') {
      text = resource.data?.transcript || session.metadata?.youtube?.transcript || '';
    }

    return { id: resId, type, title, text };
  }

  // Generate study plan preview using chunked resource extraction and plan scheduling
  async generatePlanPreview(userId, planParams) {
    const {
      title,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      priority,
      resourceIds
    } = planParams;

    if (!resourceIds || resourceIds.length === 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Please select at least one resource.');
    }

    logger.info(`[Study Planner] Extracting topics from ${resourceIds.length} resources for user: ${userId}`);

    // Load and chunk resources
    const allTopics = [];
    
    for (const resId of resourceIds) {
      const resource = await this._getResourceContent(userId, resId);
      if (!resource.text || !resource.text.trim()) {
        logger.warn(`[Study Planner] Resource ${resId} content is empty. Skipping.`);
        continue;
      }

      if (resource.type === 'pdf') {
        const pages = parsePagesFromExtractedText(resource.text);
        const pageChunks = chunkPdfPages(pages);
        
        logger.info(`[Study Planner] PDF ${resource.title} split into ${pageChunks.length} chunks.`);
        
        for (let i = 0; i < pageChunks.length; i++) {
          const chunk = pageChunks[i];
          const chunkTextContent = chunk.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');
          const pageStart = chunk[0].pageNumber;
          const pageEnd = chunk[chunk.length - 1].pageNumber;

          const systemInstruction = 
            "You are MindSync's academic study-planning engine.\n" +
            "Analyze the provided section of the learning resource and extract the core educational topics and concepts.\n" +
            "Return ONLY a valid JSON array of objects. Do not include markdown backticks or conversational explanations.\n" +
            "Match this exact JSON schema:\n" +
            "[\n" +
            "  {\n" +
            "    \"topicTitle\": \"string\",\n" +
            "    \"description\": \"string\",\n" +
            "    \"difficulty\": \"EASY\" | \"MEDIUM\" | \"HARD\"\n" +
            "  }\n" +
            "]";

          const userPrompt = `Resource Title: "${resource.title}"\nPages: ${pageStart}-${pageEnd}\nContent:\n${chunkTextContent}`;

          try {
            const aiResponse = await aiProviderService.generateAIResponse({
              messages: [{ role: 'user', content: userPrompt }],
              systemInstruction,
              jsonMode: true
            });
            const responseText = (aiResponse.text || aiResponse.toString() || '').trim();
            const parsed = parseCleanJson(responseText);
            
            if (Array.isArray(parsed)) {
              parsed.forEach(topic => {
                allTopics.push({
                  ...topic,
                  resourceId: resId,
                  resourceTitle: resource.title,
                  pageStart,
                  pageEnd
                });
              });
            }
          } catch (err) {
            logger.error(`[Study Planner] Failed to extract topics for chunk ${i} of resource ${resId}: ${err.message}`);
          }
        }
      } else {
        // YouTube
        const transcriptChunks = chunkText(resource.text);
        logger.info(`[Study Planner] YouTube transcript split into ${transcriptChunks.length} chunks.`);

        for (let i = 0; i < transcriptChunks.length; i++) {
          const chunk = transcriptChunks[i];
          const systemInstruction = 
            "You are MindSync's academic study-planning engine.\n" +
            "Analyze the provided section of the video transcript and extract the core educational topics and concepts.\n" +
            "Return ONLY a valid JSON array of objects. Do not include markdown backticks or conversational explanations.\n" +
            "Match this exact JSON schema:\n" +
            "[\n" +
            "  {\n" +
            "    \"topicTitle\": \"string\",\n" +
            "    \"description\": \"string\",\n" +
            "    \"difficulty\": \"EASY\" | \"MEDIUM\" | \"HARD\"\n" +
            "  }\n" +
            "]";

          const userPrompt = `Video Title: "${resource.title}"\nContent:\n${chunk}`;

          try {
            const aiResponse = await aiProviderService.generateAIResponse({
              messages: [{ role: 'user', content: userPrompt }],
              systemInstruction,
              jsonMode: true
            });
            const responseText = (aiResponse.text || aiResponse.toString() || '').trim();
            const parsed = parseCleanJson(responseText);
            
            if (Array.isArray(parsed)) {
              parsed.forEach(topic => {
                allTopics.push({
                  ...topic,
                  resourceId: resId,
                  resourceTitle: resource.title
                });
              });
            }
          } catch (err) {
            logger.error(`[Study Planner] Failed to extract topics for video chunk ${i}: ${err.message}`);
          }
        }
      }
    }

    if (allTopics.length === 0) {
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Unable to extract study topics from selected resources. Please verify that your resources contain valid readable text.');
    }

    // Determine calendar study dates matching preferred days
    const studyDates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Weekday names list
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const activeDays = preferredStudyDays && preferredStudyDays.length > 0 ? preferredStudyDays : WEEKDAYS;

    while (current <= end) {
      const dayName = dayNames[current.getUTCDay()];
      if (activeDays.includes(dayName)) {
        studyDates.push(current.toISOString().split('T')[0]);
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // If no preferred days fell in the range, fall back to all days in range
    if (studyDates.length === 0) {
      const fallbackCurrent = new Date(startDate);
      while (fallbackCurrent <= end) {
        studyDates.push(fallbackCurrent.toISOString().split('T')[0]);
        fallbackCurrent.setUTCDate(fallbackCurrent.getUTCDate() + 1);
      }
    }

    logger.info(`[Study Planner] Distributing ${allTopics.length} topics across ${studyDates.length} matching calendar dates.`);

    const scheduleInstruction = 
      "You are MindSync's academic study-planning engine.\n" +
      "Create a realistic, day-by-day study schedule based ONLY on the supplied learning topics and source resources.\n" +
      "You must assign tasks only on the specified available dates.\n" +
      "For each task, you must respect the daily study minutes limit. The sum of task durations on any single day must not exceed this limit.\n" +
      "Organize topics logically from foundational to advanced.\n" +
      "Integrate revision (REVIEW, FLASHCARDS, QUIZ) and practice (PRACTICE, EXPLAIN) sessions as the schedule progresses.\n" +
      "Return ONLY a valid JSON object matching the requested schema. Do not include any conversational text or markdown wrappers.\n" +
      "\n" +
      "Expected JSON Output Schema:\n" +
      "{\n" +
      "  \"tasks\": [\n" +
      "    {\n" +
      "      \"title\": \"string\",\n" +
      "      \"description\": \"string\",\n" +
      "      \"taskType\": \"READ\" | \"WATCH\" | \"REVIEW\" | \"FLASHCARDS\" | \"QUIZ\" | \"EXPLAIN\" | \"PRACTICE\" | \"CUSTOM\",\n" +
      "      \"scheduledDate\": \"YYYY-MM-DD (must match one of the available dates)\",\n" +
      "      \"estimatedMinutes\": number,\n" +
      "      \"priority\": \"LOW\" | \"MEDIUM\" | \"HIGH\",\n" +
      "      \"resourceId\": \"string or null\",\n" +
      "      \"pageStart\": number or null,\n" +
      "      \"pageEnd\": number or null\n" +
      "    }\n" +
      "  ]\n" +
      "}";

    const schedulePrompt = `
      Subject: "${subject}"
      Plan Priority: "${priority}"
      Daily Study Minutes Limit: ${dailyStudyMinutes} minutes
      Available Study Dates: ${JSON.stringify(studyDates)}
      Extracted Topics List: ${JSON.stringify(allTopics)}
      List of Available Resources: ${JSON.stringify(resourceIds)}
    `;

    const scheduleAiResponse = await aiProviderService.generateAIResponse({
      messages: [{ role: 'user', content: schedulePrompt }],
      systemInstruction: scheduleInstruction,
      jsonMode: true
    });

    const scheduleText = (scheduleAiResponse.text || scheduleAiResponse.toString() || '').trim();
    const parsedSchedule = parseCleanJson(scheduleText);

    if (!parsedSchedule || !Array.isArray(parsedSchedule.tasks)) {
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'AI did not return a valid task schedule format. Please retry.');
    }

    // Validate and clean up AI output
    const validatedTasks = [];
    const validTaskTypes = ['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM'];
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    
    const dailySums = {};

    for (const task of parsedSchedule.tasks) {
      if (!task.title || !task.title.trim()) continue;
      
      const type = (task.taskType || 'CUSTOM').toUpperCase();
      const taskType = validTaskTypes.includes(type) ? type : 'CUSTOM';
      
      const prio = (task.priority || 'MEDIUM').toUpperCase();
      const priority = validPriorities.includes(prio) ? prio : 'MEDIUM';

      if (!task.scheduledDate) continue;
      const tDate = new Date(task.scheduledDate);
      if (isNaN(tDate.getTime())) continue;

      const dateStr = tDate.toISOString().split('T')[0];
      
      // Ensure the scheduled date matches plan boundaries
      const startStr = new Date(startDate).toISOString().split('T')[0];
      const endStr = new Date(endDate).toISOString().split('T')[0];
      if (dateStr < startStr || dateStr > endStr) {
        continue;
      }

      const duration = parseInt(task.estimatedMinutes, 10);
      if (isNaN(duration) || duration <= 0) continue;

      let linkedResId = null;
      if (task.resourceId && resourceIds.includes(task.resourceId)) {
        linkedResId = task.resourceId;
      }

      let pageStart = null;
      let pageEnd = null;
      if (task.pageStart !== undefined && task.pageStart !== null) {
        pageStart = parseInt(task.pageStart, 10);
        if (isNaN(pageStart) || pageStart < 1) pageStart = null;
      }
      if (task.pageEnd !== undefined && task.pageEnd !== null) {
        pageEnd = parseInt(task.pageEnd, 10);
        if (isNaN(pageEnd) || pageEnd < 1) pageEnd = null;
      }
      if (pageStart && pageEnd && pageEnd < pageStart) {
        pageEnd = pageStart;
      }

      const validatedTask = {
        title: task.title.trim(),
        description: task.description ? task.description.trim() : '',
        taskType,
        scheduledDate: tDate,
        estimatedMinutes: Math.min(duration, dailyStudyMinutes),
        priority,
        resourceId: linkedResId,
        pageStart,
        pageEnd,
        status: 'PENDING'
      };

      dailySums[dateStr] = (dailySums[dateStr] || 0) + validatedTask.estimatedMinutes;
      validatedTasks.push(validatedTask);
    }

    // Scale task times to enforce strict daily study limits
    for (const [dateStr, sum] of Object.entries(dailySums)) {
      if (sum > dailyStudyMinutes + 15) {
        const scaleFactor = dailyStudyMinutes / sum;
        for (const task of validatedTasks) {
          const tStr = task.scheduledDate.toISOString().split('T')[0];
          if (tStr === dateStr) {
            task.estimatedMinutes = Math.max(1, Math.round(task.estimatedMinutes * scaleFactor));
          }
        }
      }
    }

    // Calculate total hours
    const totalMinutes = validatedTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const estimatedHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
      title,
      subject,
      startDate,
      endDate,
      dailyStudyMinutes,
      preferredStudyDays,
      priority,
      resourceIds,
      estimatedHours,
      tasksCount: validatedTasks.length,
      tasks: validatedTasks
    };
  }
}

export default new SmartStudyPlannerService();
