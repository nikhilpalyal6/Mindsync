import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import StudySession from '../../models/studySession.model.js';
import hashUtil from '../utils/hash.util.js';
import normalizationService from '../services/normalization.service.js';
import chunkingService from '../services/chunking.service.js';
import embeddingService from '../services/embedding.service.js';
import winstonLogger from '../../config/logger.js';
import crypto from 'crypto';

class KnowledgeWorker {
  constructor() {
    this.workerInstanceId = crypto.randomBytes(8).toString('hex');
    this.activeCount = 0;
    this.isCheckingStale = false;
  }

  /**
   * Triggers the worker to poll and process pending jobs.
   */
  async triggerWorker() {
    const concurrencyLimit = parseInt(process.env.KNOWLEDGE_PROCESSING_CONCURRENCY, 10) || 2;
    
    // Automatically trigger stale job recovery periodically
    this.recoverStaleJobs().catch(err => {
      winstonLogger.error(`[Knowledge Worker] Stale job recovery execution error: ${err.message}`);
    });

    while (this.activeCount < concurrencyLimit) {
      this.activeCount++;
      try {
        const processed = await this._processNextJob();
        if (!processed) {
          this.activeCount--;
          break; // No more jobs to claim
        }
      } catch (err) {
        winstonLogger.error(`[Knowledge Worker] Unhandled error during job loop: ${err.message}`);
      } finally {
        this.activeCount--;
      }
    }
  }

  /**
   * Claims and processes a pending or stale job atomically.
   * @returns {Promise<boolean>} True if a job was processed, false otherwise.
   */
  async _processNextJob() {
    const staleMs = parseInt(process.env.KNOWLEDGE_JOB_STALE_MS, 10) || 900000; // 15 mins

    // Claim a job atomically
    const job = await KnowledgeJob.findOneAndUpdate(
      {
        status: 'PENDING',
        $or: [
          { lockedAt: null },
          { lockedAt: { $lt: new Date(Date.now() - staleMs) } }
        ]
      },
      {
        $set: {
          status: 'NORMALIZING',
          lockedAt: new Date(),
          lockedBy: this.workerInstanceId,
          heartbeatAt: new Date(),
          startedAt: new Date()
        },
        $inc: { attempts: 1 }
      },
      { new: true }
    );

    if (!job) {
      return false; // No job claimed
    }

    winstonLogger.info(`[Knowledge Worker] Claimed job ${job._id} for resource ${job.resourceId} (Attempt: ${job.attempts})`);

    let heartbeatInterval;
    try {
      // Start heartbeat updater
      heartbeatInterval = setInterval(async () => {
        try {
          await KnowledgeJob.updateOne(
            { _id: job._id },
            { $set: { heartbeatAt: new Date() } }
          );
        } catch (err) {
          winstonLogger.warn(`[Knowledge Worker] Heartbeat update failed: ${err.message}`);
        }
      }, 30000); // Every 30 seconds

      await this._executeJobSteps(job);

      // Mark Job READY
      await KnowledgeJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'READY',
            progress: 100,
            lockedAt: null,
            lockedBy: null,
            completedAt: new Date()
          }
        }
      );
      winstonLogger.info(`[Knowledge Worker] Job ${job._id} finished successfully.`);

    } catch (err) {
      winstonLogger.error(`[Knowledge Worker] Job ${job._id} failed: ${err.message}`);
      
      const errorCode = err.code || 'UNKNOWN_ERROR';
      const errorMessage = err.message || 'An unexpected error occurred during processing.';

      await KnowledgeJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'FAILED',
            errorCode,
            errorMessage,
            lockedAt: null,
            lockedBy: null,
            completedAt: new Date()
          }
        }
      );

      // Also set the Document status to FAILED if it was created
      await KnowledgeDocument.updateOne(
        { userId: job.userId, workspaceId: job.workspaceId, resourceId: job.resourceId },
        { $set: { processingStatus: 'FAILED', errorMessage } }
      );
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    }

    return true;
  }

  async _executeJobSteps(job) {
    const startTime = Date.now();
    
    // 1. Fetch resource from workspace
    const session = await StudySession.findOne({ _id: job.workspaceId, user: job.userId });
    if (!session) {
      throw new Error('Workspace/StudySession not found or unauthorized');
    }

    const resource = session.resources?.find(
      r => (r._id && r._id.toString() === job.resourceId) || r.url === job.resourceId || r.title === job.resourceId
    );
    if (!resource) {
      throw new Error('Associated resource not found in workspace');
    }

    // 2. Self-healing for missing text extraction or fileData
    let healedExtractedText = null;
    let healedPages = [];

    if (resource.type === 'pdf') {
      const storagePath = resource.data?.storagePath;
      const fileData = resource.data?.fileData;
      if ((storagePath || fileData) && (!resource.data?.extractedText || !Array.isArray(resource.data?.pages) || resource.data.pages.length === 0)) {
        try {
          let dataUrl = fileData;
          if (storagePath && !dataUrl) {
            const path = await import('path');
            const fs = await import('fs');
            const fileURLToPath = (await import('url')).fileURLToPath;
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const backendDir = path.resolve(__dirname, '../../../');
            const absPath = path.resolve(backendDir, storagePath);

            if (fs.existsSync(absPath)) {
              const fileBuffer = fs.readFileSync(absPath);
              const base64Data = fileBuffer.toString('base64');
              dataUrl = `data:${resource.data.fileType || 'application/pdf'};base64,${base64Data}`;
            }
          }

          if (dataUrl) {
            const pdfExtractorService = (await import('../../services/pdf/pdfExtractor.service.js')).default;
            winstonLogger.info(`[Knowledge Worker] Re-extracting text from base64/file`);
            const text = await pdfExtractorService.extractTextFromBase64(dataUrl);
            
            if (text && text.trim()) {
              healedExtractedText = text;
              
              // Parse pages
              const pageRegex = /\[Page\s+(\d+)\]/gi;
              let match;
              const pagePositions = [];
              while ((match = pageRegex.exec(text)) !== null) {
                pagePositions.push({
                  pageNumber: parseInt(match[1], 10),
                  index: match.index,
                  headerLength: match[0].length
                });
              }
              if (pagePositions.length === 0) {
                healedPages.push({
                  pageNumber: 1,
                  text: text,
                  extractionStatus: 'completed',
                  wordCount: text.split(/\s+/).filter(Boolean).length
                });
              } else {
                for (let i = 0; i < pagePositions.length; i++) {
                  const current = pagePositions[i];
                  const next = pagePositions[i + 1];
                  const startIdx = current.index + current.headerLength;
                  const endIdx = next ? next.index : text.length;
                  const pageText = text.substring(startIdx, endIdx).trim();
                  healedPages.push({
                    pageNumber: current.pageNumber,
                    text: pageText,
                    extractionStatus: 'completed',
                    wordCount: pageText.split(/\s+/).filter(Boolean).length
                  });
                }
              }
            }
          }
        } catch (healErr) {
          winstonLogger.error(`[Knowledge Worker] Self-healing PDF extraction failed for ${job.resourceId}: ${healErr.message}`);
          throw healErr;
        }
      }
    }

    let sessionModified = false;
    if (healedExtractedText) {
      if (!resource.data) resource.data = {};
      resource.data.extractedText = healedExtractedText;
      resource.data.pages = healedPages;
      sessionModified = true;
    }

    // 3. YouTube self-healing / extraction
    if (resource.type === 'youtube' && (!resource.data?.transcript && !resource.data?.transcriptItems)) {
      winstonLogger.info(`[Knowledge Worker] Missing transcript in resource data. Fetching transcript for YouTube video: ${resource.url}`);
      try {
        const youtubeService = (await import('../../services/youtube/youtube.service.js')).default;
        const ytData = await youtubeService.processVideo(resource.url);
        if (ytData) {
          resource.data = {
            ...resource.data,
            ...ytData
          };
          sessionModified = true;
        }
      } catch (ytErr) {
        winstonLogger.error(`[Knowledge Worker] Failed to fetch transcript for youtube video during processing: ${ytErr.message}`);
      }
    }

    if (sessionModified) {
      winstonLogger.info(`[Knowledge Worker] Saving healed resource data in StudySession...`);
      session.markModified('resources');
      await session.save();
    }

    // 4. Normalization
    winstonLogger.info(`[Knowledge Worker] Normalizing resource ${job.resourceId}...`);
    const normalizedData = normalizationService.normalize(resource);

    if (!normalizedData.text || !normalizedData.text.trim()) {
      throw new Error('Normalization yielded empty content. Text extraction might have failed or the PDF contains no extractable text.');
    }

    const contentHash = hashUtil.generateContentHash(normalizedData.text);

    // Save metadata-only document (content field is removed from Schema, so it won't persist to DB)
    const docPayload = {
      resourceId: job.resourceId,
      workspaceId: job.workspaceId,
      userId: job.userId,
      type: resource.type.toUpperCase(),
      title: resource.title || 'Untitled Document',
      source: {
        url: resource.url || '',
        filename: resource.title || '',
        platform: resource.type === 'youtube' ? 'YouTube' : 'Upload'
      },
      youtubeData: resource.type === 'youtube' ? {
        videoId: resource.data?.videoId,
        videoUrl: resource.data?.videoUrl || resource.url,
        authorName: resource.data?.authorName,
        authorUrl: resource.data?.authorUrl,
        thumbnailUrl: resource.data?.thumbnailUrl,
        duration: resource.data?.duration,
        publishedDate: resource.data?.publishedDate,
        chapters: resource.data?.chapters || []
      } : undefined,
      metadata: {
        language: resource.type === 'youtube' ? resource.data?.transcriptLanguage || 'en' : 'en',
        wordCount: normalizedData.text.split(/\s+/).filter(Boolean).length,
        pageCount: resource.type === 'pdf' ? normalizedData.pages.length : 0,
        duration: resource.type === 'youtube' ? parseInt(resource.data?.duration, 10) || 0 : 0,
        extractedAt: new Date(),
        chapters: resource.type === 'youtube' ? resource.data?.chapters || [] : []
      },
      contentHash,
      embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001',
      processingStatus: 'NORMALIZING'
    };

    // Upsert KnowledgeDocument
    const doc = await KnowledgeDocument.findOneAndUpdate(
      { userId: job.userId, workspaceId: job.workspaceId, resourceId: job.resourceId },
      { $set: docPayload },
      { upsert: true, new: true }
    );

    await KnowledgeJob.updateOne({ _id: job._id }, { $set: { progress: 20 } });

    // 5. Chunking
    winstonLogger.info(`[Knowledge Worker] Chunking resource ${job.resourceId}...`);
    await KnowledgeDocument.updateOne({ _id: doc._id }, { $set: { processingStatus: 'CHUNKING' } });
    await KnowledgeJob.updateOne({ _id: job._id }, { $set: { status: 'CHUNKING', progress: 40 } });

    const rawChunks = chunkingService.chunk(normalizedData, { title: doc.title, type: doc.type });
    if (rawChunks.length === 0) {
      throw new Error('Chunking generated zero chunks. Content might be empty.');
    }

    // 6. Embedding
    winstonLogger.info(`[Knowledge Worker] Preparing embeddings for ${rawChunks.length} chunks...`);
    await KnowledgeDocument.updateOne({ _id: doc._id }, { $set: { processingStatus: 'EMBEDDING', embeddingStatus: 'PROCESSING' } });
    await KnowledgeJob.updateOne({ _id: job._id }, { $set: { status: 'EMBEDDING', progress: 60 } });

    // Build local embedding cache for this workspace to check for duplicates
    const existingChunks = await KnowledgeChunk.find({
      userId: job.userId,
      workspaceId: job.workspaceId
    }).select('text embedding').lean();

    const existingEmbeddingsMap = new Map();
    existingChunks.forEach(ec => {
      if (ec.text && Array.isArray(ec.embedding) && ec.embedding.length > 0) {
        const isDummy = ec.embedding.every(v => v === 0);
        if (!isDummy) {
          existingEmbeddingsMap.set(ec.text, ec.embedding);
        }
      }
    });

    const vectors = [];
    const textsToEmbed = [];
    const cacheMissIndices = [];

    rawChunks.forEach((chunk, idx) => {
      const cachedVector = existingEmbeddingsMap.get(chunk.text);
      if (cachedVector) {
        vectors[idx] = cachedVector;
      } else {
        textsToEmbed.push(chunk);
        cacheMissIndices.push(idx);
      }
    });

    if (textsToEmbed.length > 0) {
      winstonLogger.info(`[Knowledge Worker] Embedding cache missed for ${textsToEmbed.length}/${rawChunks.length} chunks. Generating embeddings via API...`);
      try {
        const newVectors = await embeddingService.generateEmbeddings(textsToEmbed);
        newVectors.forEach((vector, idx) => {
          const originalIdx = cacheMissIndices[idx];
          vectors[originalIdx] = vector;
        });

        await KnowledgeDocument.updateOne(
          { _id: doc._id },
          { $set: { embeddingStatus: 'SUCCESS', embeddingError: null } }
        );
      } catch (embErr) {
        winstonLogger.error(`[Knowledge Worker] Embedding generation failed: ${embErr.message}. Falling back to dummy vectors.`);
        
        const expectedDim = parseInt(process.env.KNOWLEDGE_EMBEDDING_DIMENSION, 10) || 3072;
        const dummyVector = new Array(expectedDim).fill(0);
        
        cacheMissIndices.forEach(originalIdx => {
          vectors[originalIdx] = dummyVector;
        });

        await KnowledgeDocument.updateOne(
          { _id: doc._id },
          { $set: { embeddingStatus: 'FAILED', embeddingError: embErr.message } }
        );
      }
    } else {
      winstonLogger.info(`[Knowledge Worker] 100% embedding cache hit. Skipping API requests.`);
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { embeddingStatus: 'SUCCESS', embeddingError: null } }
      );
    }

    // 7. Indexing
    winstonLogger.info(`[Knowledge Worker] Storing chunks and vector index for resource ${job.resourceId}...`);
    await KnowledgeDocument.updateOne({ _id: doc._id }, { $set: { processingStatus: 'INDEXING' } });
    await KnowledgeJob.updateOne({ _id: job._id }, { $set: { status: 'INDEXING', progress: 80 } });

    // Delete existing chunks if any to prevent duplicates on retries
    await KnowledgeChunk.deleteMany({ documentId: doc._id });

    // Prepare chunk models
    const chunkDocuments = rawChunks.map((chunk, idx) => {
      const items = resource.data?.transcriptItems || resource.data?.originalTranscriptItems || [];
      const englishItems = resource.data?.englishTranscriptItems || [];
      
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
        resourceId: job.resourceId,
        workspaceId: job.workspaceId,
        userId: job.userId,
        text: chunk.text,
        embedding: vectors[idx],
        metadata: {
          pageStart: chunk.metadata?.pageStart || chunk.metadata?.pageNumber || null,
          pageEnd: chunk.metadata?.pageEnd || chunk.metadata?.pageNumber || null,
          timestampStart: tStart,
          timestampEnd: tEnd,
          section: chunk.metadata?.section || '',
          heading: chunk.metadata?.heading || '',
          transcriptItems: itemsMetadata
        },
        chunkIndex: chunk.chunkIndex,
        documentVersion: doc.documentVersion,
        contentHash: doc.contentHash
      };
    });

    await KnowledgeChunk.insertMany(chunkDocuments);

    // Mark document READY
    await KnowledgeDocument.updateOne(
      { _id: doc._id },
      { $set: { processingStatus: 'READY', chunkCount: chunkDocuments.length } }
    );

    const duration = Date.now() - startTime;
    winstonLogger.info(`[Knowledge Worker] Job ${job._id} finished successfully. Chunks: ${chunkDocuments.length}. Time: ${duration}ms`);
  }

  /**
   * Scans for locked jobs that have timed out (stale) and resets them.
   */
  async recoverStaleJobs() {
    if (this.isCheckingStale) return;
    this.isCheckingStale = true;

    try {
      const staleMs = parseInt(process.env.KNOWLEDGE_JOB_STALE_MS, 10) || 900000;
      const staleTime = new Date(Date.now() - staleMs);

      // Find jobs stuck in intermediate states that have expired heartbeats or locks
      const staleJobs = await KnowledgeJob.find({
        status: { $in: ['NORMALIZING', 'CHUNKING', 'EMBEDDING', 'INDEXING'] },
        $or: [
          { heartbeatAt: { $lt: staleTime } },
          { lockedAt: { $lt: staleTime } }
        ]
      });

      for (const job of staleJobs) {
        if (job.attempts < job.maxAttempts) {
          winstonLogger.warn(`[Knowledge Worker] Recovering stale job ${job._id} (Resource: ${job.resourceId}). Resetting to PENDING.`);
          await KnowledgeJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'PENDING',
                lockedAt: null,
                lockedBy: null,
                heartbeatAt: null
              }
            }
          );
        } else {
          winstonLogger.error(`[Knowledge Worker] Stale job ${job._id} exceeded max retries. Marking FAILED.`);
          await KnowledgeJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'FAILED',
                errorCode: 'JOB_STALE_TIMEOUT',
                errorMessage: 'The knowledge processing job timed out and exceeded retry limits.',
                lockedAt: null,
                lockedBy: null
              }
            }
          );
        }
      }
    } finally {
      this.isCheckingStale = false;
    }
  }
}

export default new KnowledgeWorker();
