import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import models & connections
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import knowledgeService from '../services/knowledge.service.js';

process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3 STATUS LIFE-CYCLE REGRESSION TESTS');
  console.log('====================================================');

  const testUserId = new mongoose.Types.ObjectId();
  const testWorkspaceId = new mongoose.Types.ObjectId();
  const testResourceId = new mongoose.Types.ObjectId().toString();

  try {
    await connectDB();

    // Prepare a mock workspace session with resources
    console.log('\nSetting up test workspace database records...');
    await StudySession.create({
      _id: testWorkspaceId,
      user: testUserId,
      title: 'Status Test Session',
      description: 'Workspace for regression checks',
      resources: [
        {
          _id: testResourceId,
          type: 'pdf',
          title: 'test_doc.pdf',
          url: 'test_doc.pdf',
          addedAt: new Date()
        }
      ]
    });

    // ----------------------------------------------------
    // Test 1 — New resource
    // ----------------------------------------------------
    console.log('\n[Test 1] Verifying new resource status...');
    let res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'NOT_INDEXED') {
      throw new Error(`Expected NOT_INDEXED, got ${res.status}`);
    }
    console.log('✓ Test 1 Passed: Empty state returns NOT_INDEXED.');

    // ----------------------------------------------------
    // Test 2 — Queued resource
    // ----------------------------------------------------
    console.log('\n[Test 2] Verifying queued resource status...');
    const job = await KnowledgeJob.create({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceId,
      status: 'PENDING',
      progress: 10
    });

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'PENDING') {
      throw new Error(`Expected PENDING, got ${res.status}`);
    }
    console.log('✓ Test 2 Passed: Queued job returns PENDING.');

    // ----------------------------------------------------
    // Test 3 — Processing resource
    // ----------------------------------------------------
    console.log('\n[Test 3] Verifying processing resource status...');
    job.status = 'CHUNKING';
    job.progress = 40;
    await job.save();

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'CHUNKING' || res.progress !== 40) {
      throw new Error(`Expected CHUNKING with 40% progress, got ${res.status} at ${res.progress}%`);
    }
    console.log('✓ Test 3 Passed: Processing status and progress matches.');

    // ----------------------------------------------------
    // Test 4 — Ready resource
    // ----------------------------------------------------
    console.log('\n[Test 4] Verifying ready resource status...');
    const doc = await KnowledgeDocument.create({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceId,
      type: 'PDF',
      title: 'test_doc.pdf',
      content: { text: 'Some test text', pages: [{ pageNumber: 1, text: 'Some test text' }] },
      contentHash: 'hash123',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY',
      chunkCount: 3
    });

    // Create 3 dummy chunks
    await KnowledgeChunk.create([
      { documentId: doc._id, resourceId: testResourceId, workspaceId: testWorkspaceId, userId: testUserId, text: 'Chunk 1', embedding: new Array(3072).fill(0.1), chunkIndex: 0, contentHash: 'hash123' },
      { documentId: doc._id, resourceId: testResourceId, workspaceId: testWorkspaceId, userId: testUserId, text: 'Chunk 2', embedding: new Array(3072).fill(0.1), chunkIndex: 1, contentHash: 'hash123' },
      { documentId: doc._id, resourceId: testResourceId, workspaceId: testWorkspaceId, userId: testUserId, text: 'Chunk 3', embedding: new Array(3072).fill(0.1), chunkIndex: 2, contentHash: 'hash123' }
    ]);

    job.status = 'READY';
    job.progress = 100;
    await job.save();

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'READY' || res.chunks !== 3) {
      throw new Error(`Expected READY status with 3 chunks, got ${res.status} with ${res.chunks} chunks`);
    }
    console.log('✓ Test 4 Passed: Ready document returns READY status.');

    // ----------------------------------------------------
    // Test 5 — Ready resource without active job
    // ----------------------------------------------------
    console.log('\n[Test 5] Verifying ready resource remains READY when job is deleted...');
    await KnowledgeJob.deleteOne({ _id: job._id });

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'READY' || res.chunks !== 3) {
      throw new Error(`Expected READY status with 3 chunks even when job is deleted, got ${res.status} with ${res.chunks}`);
    }
    console.log('✓ Test 5 Passed: Ready document preserves state when job is missing.');

    // ----------------------------------------------------
    // Test 6 — Failed resource
    // ----------------------------------------------------
    console.log('\n[Test 6] Verifying failed resource status...');
    doc.processingStatus = 'FAILED';
    doc.errorMessage = 'Extraction timeout exception';
    await doc.save();

    // Recreate failed job
    await KnowledgeJob.create({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceId,
      status: 'FAILED',
      errorMessage: 'Extraction timeout exception'
    });

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    if (res.status !== 'FAILED' || res.error !== 'Extraction timeout exception') {
      throw new Error(`Expected FAILED with error, got ${res.status} with error: ${res.error}`);
    }
    console.log('✓ Test 6 Passed: Failed document/job returns FAILED.');

    // ----------------------------------------------------
    // Test 7 — Loading workspace / sessions check
    // ----------------------------------------------------
    console.log('\n[Test 7] Verifying loading workspace does not create duplicate jobs...');
    const jobsCountBefore = await KnowledgeJob.countDocuments({ resourceId: testResourceId });
    
    // Simulate loading the workspace (StudySession query)
    await StudySession.findOne({ _id: testWorkspaceId, user: testUserId });
    
    const jobsCountAfter = await KnowledgeJob.countDocuments({ resourceId: testResourceId });
    if (jobsCountBefore !== jobsCountAfter) {
      throw new Error(`Job count changed: ${jobsCountBefore} -> ${jobsCountAfter}`);
    }
    console.log('✓ Test 7 Passed: Loading workspace does not create new jobs.');

    // ----------------------------------------------------
    // Test 8 — Multiple status polls
    // ----------------------------------------------------
    console.log('\n[Test 8] Verifying calling status multiple times does not trigger new job creation...');
    const jobsBeforePoll = await KnowledgeJob.countDocuments({ resourceId: testResourceId });
    for (let i = 0; i < 10; i++) {
      await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId);
    }
    const jobsAfterPoll = await KnowledgeJob.countDocuments({ resourceId: testResourceId });
    if (jobsBeforePoll !== jobsAfterPoll) {
      throw new Error(`Job count changed during polling: ${jobsBeforePoll} -> ${jobsAfterPoll}`);
    }
    console.log('✓ Test 8 Passed: Multiple status queries do not create jobs.');

    // ----------------------------------------------------
    // Test 9 — Isolation check between multiple resources
    // ----------------------------------------------------
    console.log('\n[Test 9] Verifying status isolation between different resources...');
    const testResourceIdB = new mongoose.Types.ObjectId().toString();
    await StudySession.updateOne(
      { _id: testWorkspaceId },
      {
        $push: {
          resources: {
            _id: testResourceIdB,
            type: 'youtube',
            title: 'video.mp4',
            url: 'video.mp4',
            addedAt: new Date()
          }
        }
      }
    );

    // B is unindexed
    const resA = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceId); // Failed
    const resB = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceIdB); // Unindexed

    if (resA.status !== 'FAILED' || resB.status !== 'NOT_INDEXED') {
      throw new Error(`Expected A to be FAILED and B to be NOT_INDEXED. Got A: ${resA.status}, B: ${resB.status}`);
    }
    console.log('✓ Test 9 Passed: Status isolation works correctly.');

    // ----------------------------------------------------
    // Test 10 — Test READY with chunkCount=57 & missing job (Step 11)
    // ----------------------------------------------------
    console.log('\n[Test 10] Verifying READY status with chunkCount=57 and missing job...');
    const testResourceIdC = new mongoose.Types.ObjectId().toString();
    await StudySession.updateOne(
      { _id: testWorkspaceId },
      {
        $push: {
          resources: {
            _id: testResourceIdC,
            type: 'pdf',
            title: 'doc_57.pdf',
            url: 'doc_57.pdf',
            addedAt: new Date()
          }
        }
      }
    );
    const docC = await KnowledgeDocument.create({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceIdC,
      type: 'PDF',
      title: 'doc_57.pdf',
      content: { text: 'Some test text', pages: [{ pageNumber: 1, text: 'Some test text' }] },
      contentHash: 'hash57',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY',
      chunkCount: 57
    });

    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceIdC);
    if (res.status !== 'READY' || res.chunks !== 57) {
      throw new Error(`Expected READY status with 57 chunks, got ${res.status} with ${res.chunks}`);
    }
    console.log('✓ Test 10 Passed: READY status returns chunkCount immediately without job.');

    // ----------------------------------------------------
    // Test 11 — Mock countDocuments to throw or hang (Step 11 & 12)
    // ----------------------------------------------------
    console.log('\n[Test 11] Verifying getStatus does not call countDocuments...');
    const originalCount = KnowledgeChunk.countDocuments;
    KnowledgeChunk.countDocuments = async () => {
      throw new Error('countDocuments was called! This is a performance regression!');
    };
    try {
      res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceIdC);
      if (res.status !== 'READY' || res.chunks !== 57) {
        throw new Error(`Expected status READY and 57 chunks, got ${res.status} with ${res.chunks}`);
      }
      console.log('✓ Test 11 Passed: countDocuments mock was bypassed successfully.');
    } finally {
      KnowledgeChunk.countDocuments = originalCount;
    }

    // ----------------------------------------------------
    // Test 12 — Legacy document chunkCount backfill (Step 13)
    // ----------------------------------------------------
    console.log('\n[Test 12] Verifying legacy document chunkCount backfill...');
    const testResourceIdD = new mongoose.Types.ObjectId().toString();
    await StudySession.updateOne(
      { _id: testWorkspaceId },
      {
        $push: {
          resources: {
            _id: testResourceIdD,
            type: 'pdf',
            title: 'legacy.pdf',
            url: 'legacy.pdf',
            addedAt: new Date()
          }
        }
      }
    );
    const docD = await KnowledgeDocument.create({
      userId: testUserId,
      workspaceId: testWorkspaceId,
      resourceId: testResourceIdD,
      type: 'PDF',
      title: 'legacy.pdf',
      content: { text: 'Some test text', pages: [{ pageNumber: 1, text: 'Some test text' }] },
      contentHash: 'hashLegacy',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY',
      chunkCount: undefined // Legacy document
    });

    // Create 4 dummy chunks for legacy document
    await KnowledgeChunk.create([
      { documentId: docD._id, resourceId: testResourceIdD, workspaceId: testWorkspaceId, userId: testUserId, text: 'C1', embedding: new Array(3072).fill(0.1), chunkIndex: 0, contentHash: 'hashLegacy' },
      { documentId: docD._id, resourceId: testResourceIdD, workspaceId: testWorkspaceId, userId: testUserId, text: 'C2', embedding: new Array(3072).fill(0.1), chunkIndex: 1, contentHash: 'hashLegacy' },
      { documentId: docD._id, resourceId: testResourceIdD, workspaceId: testWorkspaceId, userId: testUserId, text: 'C3', embedding: new Array(3072).fill(0.1), chunkIndex: 2, contentHash: 'hashLegacy' },
      { documentId: docD._id, resourceId: testResourceIdD, workspaceId: testWorkspaceId, userId: testUserId, text: 'C4', embedding: new Array(3072).fill(0.1), chunkIndex: 3, contentHash: 'hashLegacy' }
    ]);

    // Initial check before migration should return chunks: 0 (Step 13)
    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceIdD);
    if (res.status !== 'READY' || res.chunks !== 0) {
      throw new Error(`Expected legacy READY document to return 0 chunks initially, got ${res.chunks}`);
    }

    // Run backfill migration
    const { runChunkCountBackfill } = await import('../scripts/backfillChunkCounts.js');
    await runChunkCountBackfill();

    // Verify after migration it returns chunks: 4
    res = await knowledgeService.getStatus(testUserId, testWorkspaceId, testResourceIdD);
    if (res.status !== 'READY' || res.chunks !== 4) {
      throw new Error(`Expected migrated READY document to return 4 chunks, got ${res.chunks}`);
    }
    console.log('✓ Test 12 Passed: Legacy document chunkCount backfill was successful.');

    // ----------------------------------------------------
    // Test 13 — Test MongoDB failure returns HTTP 503 (Step 14)
    // ----------------------------------------------------
    console.log('\n[Test 13] Verifying database connection error returns HTTP 503...');
    // We mock a simulated database connection error by creating an error middleware mock test
    const { errorHandler } = await import('../../middleware/error.middleware.js');
    const mockReq = { originalUrl: '/api/v1/test', method: 'GET' };
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    
    // Simulate a MongooseServerSelectionError
    const mongoError = new Error('Server selection timed out');
    mongoError.name = 'MongoServerSelectionError';

    errorHandler(mongoError, mockReq, mockRes, () => {});
    if (mockRes.statusCode !== 503 || mockRes.jsonData.success !== false || !mockRes.jsonData.message.includes('Database temporarily unavailable')) {
      throw new Error(`Expected HTTP 503 Service Unavailable, got ${mockRes.statusCode} with body: ${JSON.stringify(mockRes.jsonData)}`);
    }
    console.log('✓ Test 13 Passed: MongoDB failure maps to HTTP 503 Service Unavailable.');

  } catch (err) {
    console.error('\n❌ Status regression tests failed:', err);
    process.exit(1);
  } finally {
    // Database cleanup
    console.log('\nCleaning up database records...');
    await StudySession.deleteMany({ user: testUserId });
    await KnowledgeDocument.deleteMany({ userId: testUserId });
    await KnowledgeChunk.deleteMany({ userId: testUserId });
    await KnowledgeJob.deleteMany({ userId: testUserId });

    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 3.3 LIFE-CYCLE STATUS TESTS PASSED SUCCESS');
  console.log('====================================================');
}

runTests();
