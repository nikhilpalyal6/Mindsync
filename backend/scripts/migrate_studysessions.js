import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mindsync';

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`[Migration] Starting migration script... Dry-run: ${isDryRun}`);

  // Connect to DB
  await mongoose.connect(MONGODB_URI);
  console.log('[Migration] Database connected.');

  // Import models dynamically
  const StudySession = (await import('../src/models/studySession.model.js')).default;
  const KnowledgeDocument = (await import('../src/models/knowledgeDocument.model.js')).default;
  const KnowledgeChunk = (await import('../src/models/knowledgeChunk.model.js')).default;
  const chunkingService = (await import('../src/knowledge/services/chunking.service.js')).default;
  const normalizationService = (await import('../src/knowledge/services/normalization.service.js')).default;
  const hashUtil = (await import('../src/knowledge/utils/hash.util.js')).default;

  const sessions = await StudySession.find({});
  console.log(`[Migration] Found ${sessions.length} study sessions in database.`);

  let backupCollectionName = '';
  if (!isDryRun) {
    // Create backup collection
    const timestamp = Date.now();
    backupCollectionName = `studysessions_backup_${timestamp}`;
    const db = mongoose.connection.db;
    
    console.log(`[Migration] Creating backup collection: ${backupCollectionName}...`);
    const cursor = db.collection('studysessions').find({});
    const allDocs = await cursor.toArray();
    if (allDocs.length > 0) {
      await db.collection(backupCollectionName).insertMany(allDocs);
      console.log(`[Migration] Backup of ${allDocs.length} sessions completed successfully.`);
    } else {
      console.log('[Migration] Collection is empty, skipping backup.');
    }
  }

  let totalResourcesProcessed = 0;
  let totalResourcesSkipped = 0;
  let totalResourcesFailed = 0;

  for (const session of sessions) {
    const sessionId = session._id.toString();
    const userId = session.user?.toString();
    if (!userId) {
      console.warn(`[Migration] Session ${sessionId} has no user ID. Skipping.`);
      continue;
    }

    let sessionModified = false;
    const resources = session.resources || [];

    for (let rIdx = 0; rIdx < resources.length; rIdx++) {
      const resource = resources[rIdx];
      const resourceId = resource._id?.toString() || new mongoose.Types.ObjectId().toString();
      
      if (!resource._id) {
        resource._id = resourceId;
        sessionModified = true;
      }

      const type = resource.type;
      const data = resource.data || {};
      const oldSize = Buffer.byteLength(JSON.stringify(resource));

      if (type === 'pdf') {
        const fileData = data.fileData;
        const extractedText = data.extractedText;
        const pages = data.pages || [];

        if (data.storagePath && !fileData && !extractedText) {
          totalResourcesSkipped++;
          continue;
        }

        console.log(`[Migration] Processing PDF Resource ID: ${resourceId} in Workspace: ${sessionId}`);
        console.log(`  - Old Document size: ${oldSize} bytes`);

        let storagePath = data.storagePath;

        if (fileData && fileData.startsWith('data:application/pdf;base64,')) {
          if (isDryRun) {
            console.log(`  - [Dry-Run] Would decode base64 fileData and save to disk.`);
            storagePath = `uploads/dry-run-file-${resourceId}.pdf`;
          } else {
            const matches = fileData.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const buffer = Buffer.from(matches[2], 'base64');
              const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
              const filename = `file-${uniqueSuffix}.pdf`;
              const uploadsDir = path.resolve(backendDir, 'uploads');
              
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              
              const filePath = path.join(uploadsDir, filename);
              fs.writeFileSync(filePath, buffer);
              storagePath = `uploads/${filename}`;
              console.log(`  - Decoded base64 fileData and saved to: ${filePath}`);
            }
          }
        }

        if (extractedText && extractedText.trim()) {
          const contentHash = hashUtil.generateContentHash(extractedText);
          
          if (isDryRun) {
            console.log(`  - [Dry-Run] Would upsert KnowledgeDocument & KnowledgeChunks.`);
          } else {
            const doc = await KnowledgeDocument.findOneAndUpdate(
              { userId, workspaceId: sessionId, resourceId },
              {
                $set: {
                  type: 'PDF',
                  title: resource.title || 'Untitled PDF',
                  source: { url: resource.url, filename: resource.title, platform: 'Upload' },
                  contentHash,
                  embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001',
                  processingStatus: 'READY'
                }
              },
              { upsert: true, new: true }
            );

            const normalizedData = { text: extractedText, pages, sections: [] };
            const rawChunks = chunkingService.chunk(normalizedData, { title: resource.title, type: 'PDF' });

            await KnowledgeChunk.deleteMany({ documentId: doc._id });

            const chunkDocs = rawChunks.map(chunk => ({
              documentId: doc._id,
              resourceId,
              workspaceId: sessionId,
              userId,
              text: chunk.text,
              embedding: new Array(3072).fill(0),
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

            if (chunkDocs.length > 0) {
              await KnowledgeChunk.insertMany(chunkDocs);
            }

            await KnowledgeDocument.updateOne(
              { _id: doc._id },
              { $set: { chunkCount: chunkDocs.length } }
            );
            console.log(`  - Saved ${chunkDocs.length} chunks to KnowledgeChunks.`);
          }
        }

        if (!isDryRun) {
          const strippedData = {
            _id: resourceId,
            filename: data.filename || resource.url,
            pdfFilename: data.pdfFilename || data.filename || resource.url,
            fileSize: data.fileSize,
            fileType: data.fileType || 'application/pdf',
            storagePath: storagePath,
            pageNumber: data.pageNumber || 1,
            scale: data.scale || 1.0,
            fitMode: data.fitMode || 'page',
            lastOpened: data.lastOpened || new Date().toISOString(),
            processingStatus: data.processingStatus || 'completed'
          };

          resource.data = strippedData;
          sessionModified = true;

          if (session.metadata?.pdf && (session.metadata.pdf.filename === resource.title || session.metadata.pdf._id?.toString() === resourceId)) {
            session.metadata.pdf = strippedData;
            session.markModified('metadata');
          }

          const newSize = Buffer.byteLength(JSON.stringify(resource));
          console.log(`  - [Success] Migrated PDF. New size: ${newSize} bytes (shrunk from ${oldSize} bytes)`);
          totalResourcesProcessed++;
        } else {
          totalResourcesProcessed++;
        }

      } else if (type === 'youtube') {
        const transcript = data.transcript;
        const transcriptItems = data.transcriptItems || data.originalTranscriptItems || [];

        if (!transcript && transcriptItems.length === 0) {
          totalResourcesSkipped++;
          continue;
        }

        console.log(`[Migration] Processing YouTube Resource ID: ${resourceId} in Workspace: ${sessionId}`);
        console.log(`  - Old Document size: ${oldSize} bytes`);

        if (transcript && transcript.trim()) {
          const contentHash = hashUtil.generateContentHash(transcript);

          if (isDryRun) {
            console.log(`  - [Dry-Run] Would upsert KnowledgeDocument & KnowledgeChunks for YouTube video.`);
          } else {
            const doc = await KnowledgeDocument.findOneAndUpdate(
              { userId, workspaceId: sessionId, resourceId },
              {
                $set: {
                  type: 'YOUTUBE',
                  title: resource.title || 'Untitled YouTube Video',
                  source: { url: resource.url, filename: resource.title, platform: 'YouTube' },
                  youtubeData: {
                    videoId: data.videoId,
                    videoUrl: data.videoUrl || resource.url,
                    authorName: data.authorName,
                    authorUrl: data.authorUrl,
                    thumbnailUrl: data.thumbnailUrl,
                    duration: data.duration,
                    publishedDate: data.publishedDate,
                    chapters: data.chapters || []
                  },
                  metadata: {
                    language: data.transcriptLanguage || 'en',
                    wordCount: transcript.split(/\s+/).filter(Boolean).length,
                    duration: parseInt(data.duration, 10) || 0,
                    extractedAt: new Date(),
                    chapters: data.chapters || []
                  },
                  contentHash,
                  embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001',
                  processingStatus: 'READY'
                }
              },
              { upsert: true, new: true }
            );

            const normalizedData = normalizationService.normalize(resource);
            const rawChunks = chunkingService.chunk(normalizedData, { title: resource.title, type: 'YOUTUBE' });

            await KnowledgeChunk.deleteMany({ documentId: doc._id });

            const items = data.transcriptItems || data.originalTranscriptItems || [];
            const englishItems = data.englishTranscriptItems || [];

            const chunkDocs = rawChunks.map(chunk => {
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
                workspaceId: sessionId,
                userId,
                text: chunk.text,
                embedding: new Array(3072).fill(0),
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

            if (chunkDocs.length > 0) {
              await KnowledgeChunk.insertMany(chunkDocs);
            }

            await KnowledgeDocument.updateOne(
              { _id: doc._id },
              { $set: { chunkCount: chunkDocs.length } }
            );
            console.log(`  - Saved ${chunkDocs.length} chunks to KnowledgeChunks.`);
          }
        }

        if (!isDryRun) {
          const strippedData = {
            _id: resourceId,
            videoId: data.videoId,
            videoUrl: data.videoUrl || resource.url,
            title: data.title || resource.title,
            authorName: data.authorName,
            authorUrl: data.authorUrl,
            thumbnailUrl: data.thumbnailUrl,
            duration: data.duration,
            publishedDate: data.publishedDate,
            processingStatus: data.processingStatus || 'completed'
          };

          resource.data = strippedData;
          sessionModified = true;

          if (session.metadata?.youtube && (session.metadata.youtube.videoUrl === resource.url || session.metadata.youtube._id?.toString() === resourceId)) {
            session.metadata.youtube = strippedData;
            session.markModified('metadata');
          }

          const newSize = Buffer.byteLength(JSON.stringify(resource));
          console.log(`  - [Success] Migrated YouTube. New size: ${newSize} bytes (shrunk from ${oldSize} bytes)`);
          totalResourcesProcessed++;
        } else {
          totalResourcesProcessed++;
        }
      }
    }

    if (sessionModified && !isDryRun) {
      session.markModified('resources');
      await session.save();
      console.log(`[Migration] Updated StudySession ${sessionId} in database.`);
    }
  }

  console.log('\n======================================');
  console.log('Migration Execution Summary');
  console.log('======================================');
  console.log(`Dry Run Mode       : ${isDryRun}`);
  if (!isDryRun) {
    console.log(`Backup Collection  : ${backupCollectionName}`);
  }
  console.log(`Resources Processed: ${totalResourcesProcessed}`);
  console.log(`Resources Skipped  : ${totalResourcesSkipped}`);
  console.log(`Resources Failed   : ${totalResourcesFailed}`);
  console.log('======================================\n');

  await mongoose.disconnect();
  console.log('[Migration] Database disconnected. Migration script finished.');
}

runMigration().catch(err => {
  console.error('[Migration Error] Migration failed with exception:', err);
  process.exit(1);
});
