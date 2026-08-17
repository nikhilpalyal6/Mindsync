import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import winstonLogger from '../../config/logger.js';

/**
 * Runs the chunkCount backfill migration in safe batches.
 * Idempotent, lightweight, and doesn't modify routing, status, or jobs.
 */
export async function runChunkCountBackfill() {
  winstonLogger.info('[Migration] Starting legacy chunkCount backfill...');
  
  try {
    // Find READY documents where chunkCount is missing, null, or 0
    const docs = await KnowledgeDocument.find({
      processingStatus: 'READY',
      $or: [
        { chunkCount: { $exists: false } },
        { chunkCount: null },
        { chunkCount: 0 }
      ]
    });

    if (docs.length === 0) {
      winstonLogger.info('[Migration] No legacy documents found requiring chunkCount backfill.');
      return;
    }

    winstonLogger.info(`[Migration] Found ${docs.length} documents to migrate.`);

    // Process in batches of 5 to limit database connection stress
    const batchSize = 5;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (doc) => {
          const calculatedCount = await KnowledgeChunk.countDocuments({ documentId: doc._id });
          const oldVal = doc.chunkCount;
          
          await KnowledgeDocument.updateOne(
            { _id: doc._id },
            { $set: { chunkCount: calculatedCount } }
          );

          winstonLogger.info(
            `[Migration] Backfilled chunkCount for documentId=${doc._id} resourceId=${doc.resourceId}: ` +
            `old=${oldVal}, new=${calculatedCount}`
          );
        })
      );
    }

    winstonLogger.info('[Migration] Legacy chunkCount backfill completed successfully.');
  } catch (err) {
    winstonLogger.error('[Migration] Failed during legacy chunkCount backfill:', err);
  }
}
