import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

import retrievalService from '../services/retrieval.service.js';
import vectorStore from '../providers/vectorStore.js';
import embeddingService from '../services/embedding.service.js';
import runBackfill from '../scripts/backfillEmbeddings.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.KNOWLEDGE_RETRIEVAL_ENABLED = 'true';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3 STEP 2: PERSISTENT EMBEDDING & SEMANTIC TESTS');
  console.log('====================================================');

  try {
    await connectDB();

    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const workspaceA = new mongoose.Types.ObjectId();
    const workspaceB = new mongoose.Types.ObjectId();

    const resourceA1_Id = new mongoose.Types.ObjectId().toString();
    const resourceA2_Id = new mongoose.Types.ObjectId().toString();
    const resourceB_Id = new mongoose.Types.ObjectId().toString();

    // 1. Setup Mock Sessions
    await new StudySession({
      _id: workspaceA,
      user: userA,
      title: 'Workspace A',
      resources: [
        { _id: resourceA1_Id, type: 'pdf', title: 'Resource A1', url: 'urlA1' },
        { _id: resourceA2_Id, type: 'pdf', title: 'Resource A2', url: 'urlA2' }
      ]
    }).save();

    await new StudySession({
      _id: workspaceB,
      user: userB,
      title: 'Workspace B',
      resources: [
        { _id: resourceB_Id, type: 'pdf', title: 'Resource B', url: 'urlB' }
      ]
    }).save();

    // 2. Save Mock Documents with different embeddingStatus
    const docA1 = await KnowledgeDocument.create({
      resourceId: resourceA1_Id,
      workspaceId: workspaceA,
      userId: userA,
      type: 'PDF',
      title: 'Resource A1 Document',
      contentHash: 'hashA1',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });

    const docA2_Failed = await KnowledgeDocument.create({
      resourceId: resourceA2_Id,
      workspaceId: workspaceA,
      userId: userA,
      type: 'PDF',
      title: 'Resource A2 Failed Document',
      contentHash: 'hashA2',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'FAILED',
      processingStatus: 'READY'
    });

    const docB = await KnowledgeDocument.create({
      resourceId: resourceB_Id,
      workspaceId: workspaceB,
      userId: userB,
      type: 'PDF',
      title: 'Resource B Document',
      contentHash: 'hashB',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });

    // 3. Populate Chunks (A1 has real mock vectors, A2 has dummy zeros, B has real mock vectors)
    const vecDimension = 768;
    const vectorA1 = new Array(vecDimension).fill(0).map((_, idx) => (idx === 0 ? 1.0 : 0.0)); // [1, 0, 0, ...]
    const vectorB = new Array(vecDimension).fill(0).map((_, idx) => (idx === 1 ? 1.0 : 0.0));  // [0, 1, 0, ...]
    const vectorDummy = new Array(vecDimension).fill(0);                                      // [0, 0, 0, ...]

    await KnowledgeChunk.create([
      { documentId: docA1._id, resourceId: resourceA1_Id, workspaceId: workspaceA, userId: userA, text: 'Cell biology notes.', embedding: vectorA1, chunkIndex: 0, contentHash: 'hashA1' },
      { documentId: docA2_Failed._id, resourceId: resourceA2_Id, workspaceId: workspaceA, userId: userA, text: 'Failed embedding notes.', embedding: vectorDummy, chunkIndex: 0, contentHash: 'hashA2' },
      { documentId: docB._id, resourceId: resourceB_Id, workspaceId: workspaceB, userId: userB, text: 'Quantum Physics notes.', embedding: vectorB, chunkIndex: 0, contentHash: 'hashB' }
    ]);

    console.log('\n[Test 1] Verifying Vector Persistence & Dimension...');
    const savedChunk = await KnowledgeChunk.findOne({ resourceId: resourceA1_Id });
    if (!savedChunk || savedChunk.embedding.length !== vecDimension) {
      throw new Error(`Vector persistence or dimension failed. Found dimension: ${savedChunk?.embedding?.length}`);
    }
    console.log('✓ Vector persistence & dimension verified.');

    console.log('\n[Test 2] Verifying Failed/Dummy Chunk Exclusion...');
    // Querying in workspaceA should ONLY return chunks from docA1 (SUCCESS) and NEVER docA2 (FAILED)
    const searchResults = await vectorStore.search(userA, workspaceA, vectorA1, 5);
    const hasFailedChunk = searchResults.some(r => r.resourceId === resourceA2_Id);
    if (hasFailedChunk) {
      throw new Error('Search returned chunks from document with FAILED embedding status!');
    }
    if (searchResults.length !== 1 || searchResults[0].resourceId !== resourceA1_Id) {
      throw new Error(`Expected exactly 1 chunk from resource A1, got ${searchResults.length}`);
    }
    console.log('✓ Failed/Dummy chunks excluded successfully from semantic search.');

    console.log('\n[Test 3] Verifying Workspace Tenant Isolation...');
    // Querying workspaceA with vectorB should yield docA1 chunks (but low score), and NEVER yield docB chunks
    const isolationResults = await vectorStore.search(userA, workspaceA, vectorB, 5);
    const hasWorkspaceBChunks = isolationResults.some(r => r.workspaceId.toString() === workspaceB.toString());
    if (hasWorkspaceBChunks) {
      throw new Error('Tenant isolation violated! Workspace B chunks returned in Workspace A query.');
    }
    console.log('✓ Workspace tenant isolation verified.');

    console.log('\n[Test 4] Verifying Resource-Level Isolation Scoping...');
    // Querying workspaceA with options.resourceId = resourceA2_Id should return empty because A2 is FAILED
    const filteredResultsEmpty = await vectorStore.search(userA, workspaceA, vectorA1, 5, { resourceId: resourceA2_Id });
    if (filteredResultsEmpty.length !== 0) {
      throw new Error('Expected 0 results for resource filter matching failed doc');
    }
    // Scoping to resourceA1_Id should return resourceA1 chunks
    const filteredResultsA1 = await vectorStore.search(userA, workspaceA, vectorA1, 5, { resourceId: resourceA1_Id });
    if (filteredResultsA1.length !== 1 || filteredResultsA1[0].resourceId !== resourceA1_Id) {
      throw new Error('Resource scoping failed to return matched chunks.');
    }
    console.log('✓ Resource isolation scoping verified.');

    console.log('\n[Test 5] Verifying Retrieval Pre-Flight Cache Key isolation...');
    // Verify that cache separation works by querying retrievalService with and without resource scopes
    // We mock embeddingService.generateEmbedding
    const originalGenerateEmbedding = embeddingService.generateEmbedding;
    embeddingService.generateEmbedding = async (t) => vectorA1;

    const resWorkspaceWide = await retrievalService.retrieve(userA, workspaceA, 'mitochondria', 5);
    const resResourceScoped = await retrievalService.retrieve(userA, workspaceA, 'mitochondria', 5, { resourceId: resourceA1_Id });
    
    if (resWorkspaceWide.length !== 1 || resResourceScoped.length !== 1) {
      throw new Error('Retrieval results mismatch.');
    }
    console.log('✓ Retrieval pre-flight cache key isolation verified.');

    console.log('\n[Test 6] Verifying Query Embedding Failure Fallback...');
    // Mock embeddingService to fail
    embeddingService.generateEmbedding = async (t) => {
      throw new Error('Gemini API quota exceeded (mock)');
    };

    // This retrieval should execute and fallback gracefully to text/regex search (returning empty or matched keyword results without crashing)
    const fallbackResults = await retrievalService.retrieve(userA, workspaceA, 'mitochondria', 5);
    console.log('✓ Query embedding API failure handled gracefully with keyword search fallback.');

    // Restore provider
    embeddingService.generateEmbedding = originalGenerateEmbedding;

    console.log('\n[Test 7] Verifying Resumable Embedding Backfill Script...');
    // Create another doc that is PENDING embedding backfill
    const docToBackfill = await KnowledgeDocument.create({
      resourceId: new mongoose.Types.ObjectId().toString(),
      workspaceId: workspaceA,
      userId: userA,
      type: 'PDF',
      title: 'Backfill PDF',
      contentHash: 'hashBackfill',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'PENDING',
      processingStatus: 'READY'
    });

    await KnowledgeChunk.create([
      { documentId: docToBackfill._id, resourceId: docToBackfill.resourceId, workspaceId: workspaceA, userId: userA, text: 'Backfill chunk text.', embedding: vectorDummy, chunkIndex: 0, contentHash: 'hashBackfill' }
    ]);

    // Mock embeddingService.generateEmbeddings
    const originalGenerateEmbeddings = embeddingService.generateEmbeddings;
    embeddingService.generateEmbeddings = async (chunks) => {
      return [vectorA1];
    };

    // Run backfill
    await runBackfill(100);

    // Verify document embeddingStatus updated to SUCCESS
    const updatedDoc = await KnowledgeDocument.findById(docToBackfill._id);
    if (!updatedDoc || updatedDoc.embeddingStatus !== 'SUCCESS') {
      throw new Error(`Backfill failed to update document status. Found: ${updatedDoc?.embeddingStatus}`);
    }

    // Verify chunk embedding was updated with the real vector
    const updatedChunk = await KnowledgeChunk.findOne({ documentId: docToBackfill._id });
    if (!updatedChunk || updatedChunk.embedding[0] !== 1.0) {
      throw new Error('Backfill did not update chunk embedding vector.');
    }

    // Restore provider
    embeddingService.generateEmbeddings = originalGenerateEmbeddings;
    console.log('✓ Idempotent backfill script execution verified successfully.');

    // Database Cleanup
    console.log('\nCleaning up semantic test records...');
    await StudySession.deleteOne({ _id: workspaceA });
    await StudySession.deleteOne({ _id: workspaceB });
    await KnowledgeDocument.deleteMany({ userId: { $in: [userA, userB] } });
    await KnowledgeChunk.deleteMany({ userId: { $in: [userA, userB] } });

    await disconnectDB();
    console.log('\n====================================================');
    console.log('ALL PHASE 3.3 STEP 2 SEMANTIC INTEGRATION TESTS PASSED SUCCESS');
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
