import StudySession from '../models/studySession.model.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';
import mindMapService from './mindMap.service.js';

class ResourceService {
  /**
   * Find the most recent active study session (workspace) or create one if none exists
   */
  async findOrCreateActiveSession(userId, defaultTitle = 'My Study Session') {
    try {
      logger.info(`[Resource Service] Finding active session for user: ${userId}`);
      
      const UserPreferences = (await import('../models/userPreferences.model.js')).default;
      const prefs = await UserPreferences.findOne({ userId });
      const tz = prefs?.timezone || 'UTC';

      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });
      const todayStr = formatter.format(now);

      const sessions = await StudySession.find({ user: userId }).sort({ lastOpened: -1 });
      let session = sessions.find(s => {
        const sessionDateStr = formatter.format(s.createdAt);
        return sessionDateStr === todayStr;
      });
      
      if (!session) {
        session = new StudySession({
          user: userId,
          title: defaultTitle,
          description: 'Auto-created active study session'
        });
        await session.save();
        logger.info(`[Resource Service] Created new active session for user ${userId} for today's date`);
      } else {
        logger.info(`[Resource Service] Found existing active session for today: ${session._id}`);
      }
      return session;
    } catch (err) {
      logger.error(`[Resource Service] findOrCreateActiveSession error: ${err.stack}`);
      throw err;
    }
  }

  /**
   * Append a resource to the session's resources array and update statistics
   */
  /**
   * Helper to decode and save PDF base64 fileData to disk.
   */
  async _saveBase64PdfToDisk(fileData) {
    if (!fileData || typeof fileData !== 'string' || !fileData.startsWith('data:application/pdf;base64,')) {
      return null;
    }

    try {
      const matches = fileData.match(/^data:(.+);base64,(.+)$/);
      if (!matches) return null;

      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `file-${uniqueSuffix}.pdf`;

      const fs = await import('fs');
      const path = await import('path');
      const fileURLToPath = (await import('url')).fileURLToPath;
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const uploadsDir = path.resolve(__dirname, '../../uploads');

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      logger.info(`[Resource Service] PDF decoded and written to disk at: ${filePath}`);
      return `uploads/${filename}`;
    } catch (err) {
      logger.error(`[Resource Service] Failed to save base64 PDF to disk: ${err.message}`);
      return null;
    }
  }

  /**
   * Helper to save PDF extracted text and pages directly to KnowledgeDocument and KnowledgeChunks.
   */
  async _savePdfContentToKnowledge(userId, workspaceId, resourceId, title, url, extractedText, pages) {
    if (!extractedText) return;

    try {
      const KnowledgeDocument = mongoose.model('KnowledgeDocument');
      const KnowledgeChunk = mongoose.model('KnowledgeChunk');
      const hashUtil = (await import('../knowledge/utils/hash.util.js')).default;
      const contentHash = hashUtil.generateContentHash(extractedText);

      // 1. Upsert KnowledgeDocument (no raw content.text/content.pages fields!)
      const doc = await KnowledgeDocument.findOneAndUpdate(
        { userId, workspaceId, resourceId },
        {
          $set: {
            type: 'PDF',
            title,
            source: { url, filename: title, platform: 'Upload' },
            contentHash,
            metadata: {
              language: 'en',
              wordCount: extractedText.split(/\s+/).filter(Boolean).length,
              pageCount: pages ? pages.length : 0,
              extractedAt: new Date()
            },
            embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001',
            processingStatus: 'READY'
          }
        },
        { upsert: true, new: true }
      );

      // 2. Chunking
      const chunkingService = (await import('../knowledge/services/chunking.service.js')).default;
      const normalizedData = { text: extractedText, pages: pages || [], sections: [] };
      const rawChunks = chunkingService.chunk(normalizedData, { title, type: 'PDF' });

      // Delete existing chunks
      await KnowledgeChunk.deleteMany({ documentId: doc._id });

      // Prepare chunk models
      const chunkDocuments = rawChunks.map((chunk, idx) => ({
        documentId: doc._id,
        resourceId,
        workspaceId,
        userId,
        text: chunk.text,
        embedding: new Array(3072).fill(0), // Dummy embedding for Phase 3.3 foundation
        metadata: {
          pageStart: chunk.metadata?.pageStart || chunk.metadata?.pageNumber || null,
          pageEnd: chunk.metadata?.pageEnd || chunk.metadata?.pageNumber || null,
          section: chunk.metadata?.section || '',
          heading: chunk.metadata?.heading || ''
        },
        chunkIndex: chunk.chunkIndex,
        documentVersion: doc.documentVersion,
        contentHash: doc.contentHash
      }));

      if (chunkDocuments.length > 0) {
        await KnowledgeChunk.insertMany(chunkDocuments);
      }

      // Update chunk count on document
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { chunkCount: chunkDocuments.length } }
      );

      logger.info(`[Resource Service] PDF text saved to Knowledge base: Document=${doc._id}, Chunks=${chunkDocuments.length}`);
    } catch (err) {
      logger.error(`[Resource Service] Failed to save PDF to Knowledge base: ${err.message}`);
    }
  }

  /**
   * Helper to save YouTube transcript/translation data to KnowledgeDocument and KnowledgeChunks.
   */
  async _saveYoutubeContentToKnowledge(userId, workspaceId, resourceId, title, url, youtubeData) {
    const transcript = youtubeData.transcript || '';
    if (!transcript) return;

    try {
      const KnowledgeDocument = mongoose.model('KnowledgeDocument');
      const KnowledgeChunk = mongoose.model('KnowledgeChunk');
      const hashUtil = (await import('../knowledge/utils/hash.util.js')).default;
      const contentHash = hashUtil.generateContentHash(transcript);

      // 1. Upsert KnowledgeDocument (no raw transcript items!)
      const doc = await KnowledgeDocument.findOneAndUpdate(
        { userId, workspaceId, resourceId },
        {
          $set: {
            type: 'YOUTUBE',
            title,
            source: { url, filename: title, platform: 'YouTube' },
            youtubeData: {
              videoId: youtubeData.videoId,
              videoUrl: youtubeData.videoUrl || url,
              authorName: youtubeData.authorName,
              authorUrl: youtubeData.authorUrl,
              thumbnailUrl: youtubeData.thumbnailUrl,
              duration: youtubeData.duration,
              publishedDate: youtubeData.publishedDate,
              chapters: youtubeData.chapters || []
            },
            metadata: {
              language: youtubeData.transcriptLanguage || 'en',
              wordCount: transcript.split(/\s+/).filter(Boolean).length,
              duration: parseInt(youtubeData.duration, 10) || 0,
              extractedAt: new Date(),
              chapters: youtubeData.chapters || []
            },
            contentHash,
            embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001',
            processingStatus: 'READY'
          }
        },
        { upsert: true, new: true }
      );

      // 2. Chunking
      const chunkingService = (await import('../knowledge/services/chunking.service.js')).default;
      const normalizationService = (await import('../knowledge/services/normalization.service.js')).default;
      
      const mockResource = { type: 'youtube', title, url, data: youtubeData };
      const normalizedData = normalizationService.normalize(mockResource);
      const rawChunks = chunkingService.chunk(normalizedData, { title, type: 'YOUTUBE' });

      // Delete existing chunks
      await KnowledgeChunk.deleteMany({ documentId: doc._id });

      const items = youtubeData.transcriptItems || youtubeData.originalTranscriptItems || [];
      const englishItems = youtubeData.englishTranscriptItems || [];

      const chunkDocuments = rawChunks.map((chunk) => {
        const chunkTextLower = chunk.text.toLowerCase();
        const matchedItems = items.filter(item => item.text && chunkTextLower.includes(item.text.toLowerCase()));
        
        let tStart = null;
        let tEnd = null;
        if (matchedItems.length > 0) {
          const sortedMatched = [...matchedItems].sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
          tStart = sortedMatched[0].seconds;
          tEnd = sortedMatched[sortedMatched.length - 1].seconds;
        }

        const itemsMetadata = matchedItems.map(item => {
          const enCounterpart = englishItems.find(en => en.time === item.time || en.seconds === item.seconds);
          return {
            text: enCounterpart ? enCounterpart.text : item.text,
            originalText: item.text,
            time: item.time,
            seconds: item.seconds
          };
        });

        return {
          documentId: doc._id,
          resourceId,
          workspaceId,
          userId,
          text: chunk.text,
          embedding: new Array(3072).fill(0), // Dummy embedding
          metadata: {
            timestampStart: tStart,
            timestampEnd: tEnd,
            section: '',
            heading: '',
            transcriptItems: itemsMetadata
          },
          chunkIndex: chunk.chunkIndex,
          documentVersion: doc.documentVersion,
          contentHash: doc.contentHash
        };
      });

      if (chunkDocuments.length > 0) {
        await KnowledgeChunk.insertMany(chunkDocuments);
      }

      // Update chunk count on document
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { chunkCount: chunkDocuments.length } }
      );

      logger.info(`[Resource Service] YouTube transcript saved to Knowledge base: Document=${doc._id}, Chunks=${chunkDocuments.length}`);
    } catch (err) {
      logger.error(`[Resource Service] Failed to save YouTube to Knowledge base: ${err.message}`);
    }
  }

  /**
   * Append a resource to the session's resources array and update statistics
   */
  async linkResourceToSession(session, { type, url, title, data }) {
    try {
      if (!type || !url) {
        throw new Error('Resource type and URL/identifier are required.');
      }

      logger.info(`[Resource Service] Linking resource type: ${type}, URL: ${url} to session ${session._id}`);

      // Initialize resources array if missing
      if (!session.resources) {
        session.resources = [];
      }

      // Ensure all existing resources in the session have an _id
      session.resources = session.resources.map(r => {
        if (!r._id) {
          r._id = new mongoose.Types.ObjectId().toString();
        }
        return r;
      });

      // Check for duplicate resource
      const existingResourceIndex = session.resources.findIndex(
        r => r.type === type && r.url === url
      );

      const existingResource = existingResourceIndex > -1 ? session.resources[existingResourceIndex] : null;
      const resourceId = existingResource ? existingResource._id : new mongoose.Types.ObjectId().toString();
      const existingData = existingResource ? (existingResource.data || {}) : {};
      
      const mergedData = {
        ...existingData,
        ...(data || {})
      };

      // Handle base64 PDF content if present
      if (type === 'pdf') {
        const fileUrlDisk = await this._saveBase64PdfToDisk(mergedData.fileData);
        if (fileUrlDisk) {
          mergedData.storagePath = fileUrlDisk;
        }
      }

      // Save heavy PDF content to Knowledge base in the background
      if (type === 'pdf' && mergedData.extractedText) {
        await this._savePdfContentToKnowledge(
          session.user.toString(),
          session._id.toString(),
          resourceId,
          title || url,
          url,
          mergedData.extractedText,
          mergedData.pages
        );
      }

      // Save heavy YouTube transcript content to Knowledge base in the background
      if (type === 'youtube' && (mergedData.transcript || mergedData.transcriptItems)) {
        await this._saveYoutubeContentToKnowledge(
          session.user.toString(),
          session._id.toString(),
          resourceId,
          title || url,
          url,
          mergedData
        );
      }

      // Keep only lightweight info in mergedData
      const strippedData = {
        _id: resourceId,
        filename: mergedData.filename || url,
        pdfFilename: mergedData.pdfFilename || mergedData.filename || url,
        fileSize: mergedData.fileSize || existingData.fileSize,
        fileType: mergedData.fileType || existingData.fileType || 'application/pdf',
        storagePath: mergedData.storagePath || existingData.storagePath,
        pageNumber: mergedData.pageNumber !== undefined ? mergedData.pageNumber : existingData.pageNumber || 1,
        scale: mergedData.scale !== undefined ? mergedData.scale : existingData.scale || 1.0,
        fitMode: mergedData.fitMode || existingData.fitMode || 'page',
        lastOpened: mergedData.lastOpened || existingData.lastOpened || new Date().toISOString(),
        processingStatus: mergedData.processingStatus || existingData.processingStatus || 'completed',
        pageCount: mergedData.pageCount !== undefined ? mergedData.pageCount : existingData.pageCount,
        totalPages: mergedData.totalPages !== undefined ? mergedData.totalPages : existingData.totalPages,
        pages: mergedData.pages || [],
        
        // YouTube lightweight metadata
        videoId: mergedData.videoId || existingData.videoId,
        videoUrl: mergedData.videoUrl || url,
        title: mergedData.title || title || existingData.title,
        authorName: mergedData.authorName || existingData.authorName,
        authorUrl: mergedData.authorUrl || existingData.authorUrl,
        thumbnailUrl: mergedData.thumbnailUrl || existingData.thumbnailUrl,
        duration: mergedData.duration || existingData.duration,
        publishedDate: mergedData.publishedDate || existingData.publishedDate
      };

      const resourcePayload = {
        _id: resourceId,
        type,
        url,
        title: title || existingResource?.title || 'Untitled Resource',
        data: strippedData,
        updatedAt: new Date()
      };

      if (existingResourceIndex > -1) {
        logger.info(`[Resource Service] Found existing resource, updating details in-place`);
        session.resources[existingResourceIndex] = {
          ...existingResource,
          ...resourcePayload,
          addedAt: existingResource.addedAt || new Date()
        };
      } else {
        logger.info(`[Resource Service] Appending new resource to list`);
        session.resources.push({
          ...resourcePayload,
          addedAt: new Date()
        });
      }

      // Sync active metadata shortcuts for backward compatibility with frontend/context builder
      if (!session.metadata) {
        session.metadata = {};
      }

      session.metadata.activeResourceType = type;
      session.metadata.lastTab = type;
      session.metadata.lastOpened = new Date().toISOString();

      if (type === 'youtube') {
        session.metadata.youtube = strippedData;
      } else if (type === 'pdf') {
        session.metadata.pdf = strippedData;
      } else if (type === 'notes') {
        session.metadata.notes = strippedData;
      }

      session.markModified('resources');
      session.markModified('metadata');

      // Update statistics
      session.videoCount = session.resources.filter(r => r.type === 'youtube').length;
      session.youtubeCount = session.videoCount;
      session.pdfCount = session.resources.filter(r => r.type === 'pdf').length;
      session.notesCount = session.resources.filter(r => r.type === 'notes').length;
      session.resourceCount = session.resources.length;

      logger.info(`[Resource Service] Updated statistics: resourceCount=${session.resourceCount}, videoCount=${session.videoCount}, pdfCount=${session.pdfCount}, notesCount=${session.notesCount}`);
      
      // Trigger background Workspace Mind Map generation asynchronously if enabled
      if (session && session.user && session._id && process.env.AUTOMATIC_MIND_MAP_GENERATION === 'true') {
        const resourcesForMap = session.resources || [];
        mindMapService.generateWorkspaceMindMapBackground(
          session.user.toString(),
          session._id.toString(),
          session.title || 'Workspace Learning Map',
          resourcesForMap
        ).catch(err => logger.error(`[Workspace MindMap Hook] Automatic background generation failed: ${err.message}`));
      }

      return session;
    } catch (err) {
      logger.error(`[Resource Service] linkResourceToSession error: ${err.stack}`);
      throw err;
    }
  }
}

export default new ResourceService();
