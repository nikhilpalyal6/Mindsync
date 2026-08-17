import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import target services & models
import retrievalService from '../services/retrieval.service.js';
import citationService from '../services/citation.service.js';
import scoreFusion from '../utils/scoreFusion.util.js';
import rerankerProvider from '../providers/rerankerProvider.js';
import rerankingService from '../services/reranking.service.js';
import vectorStore from '../providers/vectorStore.js';
import embeddingProvider from '../providers/embeddingProvider.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

// Setup environment flags for tests
process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.KNOWLEDGE_RETRIEVAL_ENABLED = 'true';
process.env.KNOWLEDGE_RERANK_ENABLED = 'true';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3-B KNOWLEDGE RETRIEVAL & SECURITY TESTS');
  console.log('====================================================');

  try {
    await connectDB();

    // Setup Test Data (2 Users, 2 Workspaces)
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const workspaceA = new mongoose.Types.ObjectId();
    const workspaceB = new mongoose.Types.ObjectId();

    const resourceA_Id = new mongoose.Types.ObjectId().toString();
    const resourceB_Id = new mongoose.Types.ObjectId().toString();

    console.log('Populating isolation test records...');

    // Save Mock Sessions
    await new StudySession({
      _id: workspaceA,
      user: userA,
      title: 'Workspace A (User A)',
      resources: [{ _id: resourceA_Id, type: 'pdf', title: 'User A PDF', url: 'pdfA' }]
    }).save();

    await new StudySession({
      _id: workspaceB,
      user: userB,
      title: 'Workspace B (User B)',
      resources: [{ _id: resourceB_Id, type: 'pdf', title: 'User B PDF', url: 'pdfB' }]
    }).save();

    // Save Mock Documents (READY state)
    const docA = new KnowledgeDocument({
      resourceId: resourceA_Id,
      workspaceId: workspaceA,
      userId: userA,
      type: 'PDF',
      title: 'User A PDF',
      content: { text: 'Cell biology notes. Mitochondria is the powerhouse of the cell.', pages: [] },
      contentHash: 'hashA',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });
    await docA.save();

    const docB = new KnowledgeDocument({
      resourceId: resourceB_Id,
      workspaceId: workspaceB,
      userId: userB,
      type: 'PDF',
      title: 'User B PDF',
      content: { text: 'Quantum Physics notes. Schrödinger cat state.', pages: [] },
      contentHash: 'hashB',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });
    await docB.save();

    // Create 3 chunks for User A, 1 chunk for User B
    // Embeddings must be finite number array (e.g. 3072 dim, let's mock 3 dimensions for simple test)
    const chunkA1 = new KnowledgeChunk({
      documentId: docA._id,
      resourceId: resourceA_Id,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Mitochondria generates ATP cellular energy.',
      embedding: [1.0, 0.0, 0.0],
      metadata: { pageStart: 2, pageEnd: 2 },
      chunkIndex: 0,
      contentHash: 'hashA'
    });
    await chunkA1.save();

    const chunkA2 = new KnowledgeChunk({
      documentId: docA._id,
      resourceId: resourceA_Id,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Nucleus contains DNA genetic material.',
      embedding: [0.0, 1.0, 0.0],
      metadata: { pageStart: 5, pageEnd: 6 },
      chunkIndex: 1,
      contentHash: 'hashA'
    });
    await chunkA2.save();

    const chunkB1 = new KnowledgeChunk({
      documentId: docB._id,
      resourceId: resourceB_Id,
      workspaceId: workspaceB,
      userId: userB,
      text: 'Superposition describes quantum systems.',
      embedding: [0.0, 0.0, 1.0],
      metadata: { pageStart: 12, pageEnd: 12 },
      chunkIndex: 0,
      contentHash: 'hashB'
    });
    await chunkB1.save();

    // 1. Cosine Similarity verification
    console.log('\n[Test 1] Verifying Vector Store Cosine Similarity...');
    // Querying with vector [1, 0, 0] should match chunkA1 perfectly (score = 1.0)
    const searchRes = await vectorStore.search(userA, workspaceA, [1.0, 0.0, 0.0], 5);
    if (searchRes.length === 0 || searchRes[0].score < 0.99) {
      throw new Error(`Cosine similarity test failed. Expected score ~1.0, got ${searchRes[0]?.score}`);
    }
    console.log('✓ Vector Store Cosine Similarity verified.');

    // 2. Strict User Isolation verification
    console.log('\n[Test 2] Verifying Workspace & User Isolation...');
    // Query User A workspace with User B context
    const isolationRes = await vectorStore.search(userB, workspaceA, [1.0, 0.0, 0.0], 5);
    if (isolationRes.length > 0) {
      throw new Error('Security Breach: User B retrieved User A chunks from workspace A!');
    }
    console.log('✓ Isolation pre-filtering checks passed.');

    // 3. Keyword/Regex Sanitization and fallbacks
    console.log('\n[Test 3] Verifying Keyword Search & Sanitization...');
    // Query with regex characters
    const queryWithRegex = 'DNA?+*^$|';
    const keywordRes = await retrievalService.retrieve(userA, workspaceA, queryWithRegex, 5);
    // Should run safely without regex parse crash or Mongo error, matching nothing or text
    console.log('✓ Sanitization and regex escaping verified.');

    // 4. Score Fusion weighted calculations
    console.log('\n[Test 4] Verifying Score Fusion...');
    const mockSemantic = [{ _id: chunkA1._id, score: 0.8, text: chunkA1.text }];
    const mockKeyword = [{ _id: chunkA1._id, score: 0.5, text: chunkA1.text }];
    const fused = scoreFusion.fuseScores(mockSemantic, mockKeyword, { semanticWeight: 0.7, keywordWeight: 0.3 });
    const expectedScore = (0.8 * 0.7) + (0.5 * 0.3); // 0.56 + 0.15 = 0.71
    if (fused.length === 0 || Math.abs(fused[0].score - expectedScore) > 0.001) {
      throw new Error(`Score fusion mismatch. Expected ${expectedScore}, received ${fused[0]?.score}`);
    }
    console.log('✓ Score Fusion weighted sums verified.');

    // 5. Citation Metadata integrity
    console.log('\n[Test 5] Verifying Citation Service extraction...');
    const pdfCit = citationService.buildCitation(chunkA1, 'PDF');
    if (pdfCit.pageStart !== 2 || pdfCit.pageEnd !== 2) {
      throw new Error('Citation service failed to map PDF page coordinates');
    }
    console.log('✓ Citation formatting verified.');

    // 6. Ollama Reranker Fallbacks
    console.log('\n[Test 6] Verifying Ollama Reranker fallbacks...');
    // Case A: Ollama offline/timeout (provider throws error)
    const originalRerank = rerankerProvider.rerank;
    rerankerProvider.rerank = async () => {
      throw new Error('Ollama connection timeout (offline)');
    };

    const fallbackCandidates = [{ _id: chunkA1._id, text: chunkA1.text, score: 0.9 }];
    const rerankResult = await rerankingService.rerankCandidates('Query', fallbackCandidates);
    // Should fall back gracefully to the original candidates list instead of failing
    if (rerankResult.length !== 1 || rerankResult[0].score !== 0.9) {
      throw new Error('Reranking failed to fall back gracefully on Ollama timeout');
    }

    // Case B: Ollama returns success
    rerankerProvider.rerank = async (query, candidates) => {
      return candidates.map(c => ({ id: c.id, score: 0.98 }));
    };
    const rerankSuccess = await rerankingService.rerankCandidates('Query', fallbackCandidates);
    if (rerankSuccess[0].score !== 0.98) {
      throw new Error('Reranking failed to apply Ollama score on success');
    }
    
    // Restore provider
    rerankerProvider.rerank = originalRerank;
    console.log('✓ Reranker timeout and success fallbacks verified.');

    // 7. Request Deduplication & Retrieval Cache
    console.log('\n[Test 7] Verifying Request Deduplication & Retrieval Cache...');
    
    // Stub embeddingProvider to track calls
    const originalEmbed = embeddingProvider.generateEmbedding;
    let embedCalls = 0;
    embeddingProvider.generateEmbedding = async (txt) => {
      embedCalls++;
      return [1.0, 0.0, 0.0];
    };

    // Parallel calls should be deduplicated
    const [res1, res2] = await Promise.all([
      retrievalService.retrieve(userA, workspaceA, 'ATP energy', 5),
      retrievalService.retrieve(userA, workspaceA, 'ATP energy', 5)
    ]);

    if (embedCalls !== 1) {
      throw new Error(`Deduplication failed: embedding generated ${embedCalls} times instead of 1`);
    }
    console.log('✓ Request deduplication verified.');

    // Secondary sequential call should check cache and not invoke embedding provider again
    const resCached = await retrievalService.retrieve(userA, workspaceA, 'ATP energy', 5);
    if (embedCalls !== 1) {
      throw new Error(`Cache check failed: embedding generated ${embedCalls} times instead of checking cache`);
    }
    console.log('✓ Retrieval cache verified.');

    // Cache Invalidation
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resAfterInvalidate = await retrievalService.retrieve(userA, workspaceA, 'ATP energy', 5);
    if (embedCalls !== 2) {
      throw new Error('Cache invalidation failed: cache was not cleared after workspace invalidation');
    }
    console.log('✓ Cache invalidation verified.');

    // Restore provider
    embeddingProvider.generateEmbedding = originalEmbed;

    // Database Cleanup
    console.log('\nCleaning up isolation records...');
    await StudySession.deleteOne({ _id: workspaceA });
    await StudySession.deleteOne({ _id: workspaceB });
    await KnowledgeDocument.deleteMany({ userId: { $in: [userA, userB] } });
    await KnowledgeChunk.deleteMany({ userId: { $in: [userA, userB] } });

    await disconnectDB();
    console.log('\n====================================================');
    console.log('ALL PHASE 3.3-B RETRIEVAL & SECURITY TESTS PASSED SUCCESS');
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
