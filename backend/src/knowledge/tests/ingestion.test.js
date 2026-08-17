import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import target services
import hashUtil from '../utils/hash.util.js';
import normalizationService from '../services/normalization.service.js';
import chunkingService from '../services/chunking.service.js';
import embeddingService from '../services/embedding.service.js';
import worker from '../workers/knowledge.worker.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

// Enable feature flags explicitly for tests
process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.KNOWLEDGE_INGESTION_ENABLED = 'true';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3-A KNOWLEDGE INGESTION TEST SUITE');
  console.log('====================================================');

  try {
    await connectDB();

    // 1. Verify Hash Utility
    console.log('\n[Test 1] Verifying Hash Utility...');
    const content = 'Test content to hash';
    const hash1 = hashUtil.generateContentHash(content);
    const hash2 = hashUtil.generateContentHash(content);
    if (hash1 !== hash2 || !hash1) {
      throw new Error('Hash generation is not deterministic or empty');
    }
    console.log('✓ Deterministic hashing verified.');

    // 2. Verify Normalization
    console.log('\n[Test 2] Verifying Normalization...');
    const pdfResource = {
      type: 'pdf',
      title: 'biology.pdf',
      data: {
        extractedText: 'Page 1 text content. Page 2 text content.',
        pages: [
          { pageNumber: 1, text: 'Page 1 text content.' },
          { pageNumber: 2, text: 'Page 2 text content.' }
        ]
      }
    };

    const youtubeResource = {
      type: 'youtube',
      title: 'Educational Video',
      data: {
        transcript: 'Intro transcript. Core concepts.',
        transcriptItems: [
          { seconds: 0, text: 'Intro transcript.' },
          { seconds: 15, text: 'Core concepts.' }
        ]
      }
    };

    const normalizedPdf = normalizationService.normalize(pdfResource);
    const normalizedYt = normalizationService.normalize(youtubeResource);

    if (normalizedPdf.pages.length !== 2 || normalizedPdf.pages[1].text !== 'Page 2 text content.') {
      throw new Error('PDF normalization failed to preserve pages');
    }
    if (normalizedYt.pages.length !== 2 || normalizedYt.pages[1].timestampStart !== 15) {
      throw new Error('YouTube normalization failed to preserve timestamp bounds');
    }
    console.log('✓ Normalization mappings verified.');

    // 3. Verify Chunking
    console.log('\n[Test 3] Verifying Chunking boundaries and context enrichment...');
    const chunksPdf = chunkingService.chunk(normalizedPdf, { title: 'biology.pdf', type: 'PDF' });
    const chunksYt = chunkingService.chunk(normalizedYt, { title: 'Educational Video', type: 'YOUTUBE' });

    if (chunksPdf.length === 0 || !chunksPdf[0].enrichedText.includes('Page: 1')) {
      throw new Error('PDF chunking or enrichment validation failed');
    }
    if (chunksYt.length === 0 || !chunksYt[0].enrichedText.includes('Timestamp:')) {
      throw new Error('YouTube chunking or enrichment validation failed');
    }
    console.log('✓ Chunking and context enrichment verified.');

    // Prepare mock session and job
    console.log('\nPreparing test DB records...');
    const testUserId = new mongoose.Types.ObjectId();
    const testWorkspaceId = new mongoose.Types.ObjectId();
    const testResourceId = new mongoose.Types.ObjectId().toString();

    const mockSession = new StudySession({
      _id: testWorkspaceId,
      user: testUserId,
      title: 'Test Workspace',
      resources: [
        {
          _id: testResourceId,
          type: 'pdf',
          title: 'biology.pdf',
          url: 'biology.pdf',
          data: pdfResource.data
        }
      ]
    });
    await mockSession.save();

    const mockJob = new KnowledgeJob({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceId,
      status: 'PENDING'
    });
    await mockJob.save();

    // 4. Verify Job execution
    console.log('\n[Test 4] Verifying Job Claiming & Worker Execution...');
    console.log('Triggering worker execution on claimed pending job...');
    
    // Run worker logic directly to verify
    await worker.triggerWorker();

    const completedJob = await KnowledgeJob.findOne({ resourceId: testResourceId });
    if (!completedJob || completedJob.status !== 'READY') {
      throw new Error(`Worker failed to set job to READY. Current status: ${completedJob?.status}`);
    }

    const createdDoc = await KnowledgeDocument.findOne({ resourceId: testResourceId });
    if (!createdDoc || createdDoc.processingStatus !== 'READY') {
      throw new Error('KnowledgeDocument was not saved or marked READY');
    }

    const createdChunksCount = await KnowledgeChunk.countDocuments({ resourceId: testResourceId });
    if (createdChunksCount === 0) {
      throw new Error('No KnowledgeChunks were indexed in the database');
    }
    console.log(`✓ Job processed successfully. Generated ${createdChunksCount} chunks.`);

    // 5. Verify Idempotency
    console.log('\n[Test 5] Verifying Ingestion Idempotency...');
    // We queue the exact same resource again
    // It should check contentHash, see it's READY, and finish immediately
    const startCount = await KnowledgeChunk.countDocuments({ resourceId: testResourceId });
    
    // Simulate re-trigger
    await KnowledgeJob.updateOne({ resourceId: testResourceId }, { $set: { status: 'PENDING' } });
    await worker.triggerWorker();

    const finalCount = await KnowledgeChunk.countDocuments({ resourceId: testResourceId });
    if (startCount !== finalCount) {
      throw new Error('Idempotency check failed: duplicate chunks were generated for same hash');
    }
    console.log('✓ Idempotency validations passed.');

    // 5.5. Verify Empty/Invalid Ingestion Failure
    console.log('\n[Test 5.5] Verifying Empty/Invalid Ingestion Failure...');
    const emptyResourceId = new mongoose.Types.ObjectId().toString();
    
    // Append empty resource to existing mock session
    await StudySession.updateOne(
      { _id: testWorkspaceId },
      {
        $push: {
          resources: {
            _id: emptyResourceId,
            type: 'pdf',
            title: 'empty.pdf',
            url: 'empty.pdf',
            data: {
              extractedText: '',
              pages: [],
              processingStatus: 'completed'
            }
          }
        }
      }
    );

    // Register job
    const emptyJob = new KnowledgeJob({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: emptyResourceId,
      status: 'PENDING'
    });
    await emptyJob.save();

    // Trigger worker
    await worker.triggerWorker();

    // Check results
    const failedJob = await KnowledgeJob.findOne({ resourceId: emptyResourceId });
    if (!failedJob || failedJob.status !== 'FAILED' || !failedJob.errorMessage.includes('empty content')) {
      throw new Error(`Empty ingestion validation failed. Status: ${failedJob?.status}, Error: ${failedJob?.errorMessage}`);
    }
    console.log('✓ Empty extraction job failure verified.');

    // 5.7. Verify Self-Healing Ingestion
    console.log('\n[Test 5.7] Verifying Self-Healing Ingestion...');
    const staleResourceId = new mongoose.Types.ObjectId().toString();
    
    // Append stale resource with fileData but no extractedText
    await StudySession.updateOne(
      { _id: testWorkspaceId },
      {
        $push: {
          resources: {
            _id: staleResourceId,
            type: 'pdf',
            title: 'stale.pdf',
            url: 'stale.pdf',
            data: {
              extractedText: '',
              pages: [],
              fileData: 'data:application/pdf;base64,JVBERi0xLjQKJdPr6eEKMSAwIG9iago='
            }
          }
        }
      }
    );

    // Mock pdfExtractorService extractTextFromBase64
    const pdfExtractorService = (await import('../../services/pdf/pdfExtractor.service.js')).default;
    const originalExtract = pdfExtractorService.extractTextFromBase64;
    pdfExtractorService.extractTextFromBase64 = async (base64) => {
      console.log('      [Test Mock] Mocked text extraction called.');
      return '[Page 1] Healed text content for testing.';
    };

    // Register job
    const staleJob = new KnowledgeJob({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: staleResourceId,
      status: 'PENDING'
    });
    await staleJob.save();

    // Trigger worker
    await worker.triggerWorker();

    // Restore original function
    pdfExtractorService.extractTextFromBase64 = originalExtract;

    // Check results
    const healedJob = await KnowledgeJob.findOne({ resourceId: staleResourceId });
    if (!healedJob || healedJob.status !== 'READY') {
      throw new Error(`Self-healing ingestion failed. Status: ${healedJob?.status}, Error: ${healedJob?.errorMessage}`);
    }

    const healedSession = await StudySession.findById(testWorkspaceId);
    const healedRes = healedSession.resources.find(r => r._id?.toString() === staleResourceId);
    if (!healedRes || healedRes.data.extractedText !== '[Page 1] Healed text content for testing.') {
      throw new Error('Self-healing did not save extracted text to database');
    }
    console.log('✓ Self-healing ingestion verified successfully.');

    // 6. Verify Cascading Cleanup
    console.log('\n[Test 6] Verifying Cascading Cleanup...');
    const studyService = (await import('../../services/study.service.js')).default;
    
    // We execute deleteResource
    await studyService.deleteResource(testUserId, testWorkspaceId, testResourceId);

    const docAfterDel = await KnowledgeDocument.findOne({ resourceId: testResourceId });
    const chunksAfterDel = await KnowledgeChunk.countDocuments({ resourceId: testResourceId });
    const jobAfterDel = await KnowledgeJob.findOne({ resourceId: testResourceId });

    if (docAfterDel || chunksAfterDel > 0 || jobAfterDel) {
      throw new Error('Cascading cleanup failed to wipe knowledge records on resource delete');
    }
    console.log('✓ Cascading cleanups verified.');

    // Cleanup session
    await StudySession.deleteOne({ _id: testWorkspaceId });
    console.log('\nCleaning up database records...');

    await disconnectDB();
    console.log('\n====================================================');
    console.log('ALL PHASE 3.3-A INGESTION PIPELINE TESTS PASSED SUCCESS');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
}

runTests();
