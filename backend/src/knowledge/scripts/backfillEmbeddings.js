import dotenv from 'dotenv';
import mongoose from 'mongoose';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import embeddingService from '../services/embedding.service.js';
import winstonLogger from '../../config/logger.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

dotenv.config();

/**
 * Runs the backfill migration for all READY documents that do not have successful embeddings.
 */
export async function runBackfill(batchSize = 5) {
  winstonLogger.info('[Backfill Script] Starting embedding backfill process...');
  const targetModel = process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001';

  // Find READY documents that have not successfully completed embedding
  const docsToBackfill = await KnowledgeDocument.find({
    processingStatus: 'READY',
    embeddingStatus: { $ne: 'SUCCESS' }
  }).limit(batchSize);

  winstonLogger.info(`[Backfill Script] Found ${docsToBackfill.length} documents requiring backfill.`);

  for (const doc of docsToBackfill) {
    winstonLogger.info(`[Backfill Script] Processing document ${doc._id} (Resource: ${doc.resourceId})...`);

    try {
      // Find all chunks associated with this document
      const chunks = await KnowledgeChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });
      if (chunks.length === 0) {
        winstonLogger.warn(`[Backfill Script] No chunks found for document ${doc._id}. Marking embedding as SUCCESS.`);
        await KnowledgeDocument.updateOne(
          { _id: doc._id },
          { $set: { embeddingStatus: 'SUCCESS', embeddingModel: targetModel, embeddingError: null } }
        );
        continue;
      }

      winstonLogger.info(`[Backfill Script] Generating embeddings for ${chunks.length} chunks...`);
      
      // Update status to PROCESSING
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { embeddingStatus: 'PROCESSING', embeddingError: null } }
      );

      // Generate embeddings
      const vectors = await embeddingService.generateEmbeddings(chunks);

      // Bulk update chunk embeddings
      const bulkOps = chunks.map((chunk, idx) => ({
        updateOne: {
          filter: { _id: chunk._id },
          update: { $set: { embedding: vectors[idx] } }
        }
      }));

      await KnowledgeChunk.bulkWrite(bulkOps);

      // Update document to SUCCESS
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { embeddingStatus: 'SUCCESS', embeddingModel: targetModel, embeddingError: null } }
      );

      winstonLogger.info(`[Backfill Script] Successfully backfilled document ${doc._id}.`);

    } catch (err) {
      winstonLogger.error(`[Backfill Script] Failed to backfill document ${doc._id}: ${err.message}`);
      
      // Mark document embedding status as FAILED but keep processingStatus as READY
      await KnowledgeDocument.updateOne(
        { _id: doc._id },
        { $set: { embeddingStatus: 'FAILED', embeddingError: err.message } }
      );
    }
  }

  winstonLogger.info('[Backfill Script] Backfill batch finished.');
}

// Auto-run if executed directly
const isDirectRun = import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('backfillEmbeddings.js');
if (isDirectRun) {
  (async () => {
    try {
      await connectDB();
      await runBackfill();
    } catch (err) {
      winstonLogger.error(`[Backfill Script] Error during execution: ${err.message}`);
    } finally {
      await disconnectDB();
    }
  })();
}

export default runBackfill;
