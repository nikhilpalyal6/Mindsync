import dotenv from 'dotenv';
import mongoose from 'mongoose';
import retrievalService from '../services/retrieval.service.js';
import embeddingService from '../services/embedding.service.js';
import vectorStore from '../providers/vectorStore.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

dotenv.config();

process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.KNOWLEDGE_RETRIEVAL_ENABLED = 'true';
// Set multipliers
process.env.KNOWLEDGE_SEMANTIC_CANDIDATE_MULTIPLIER = '3';
process.env.KNOWLEDGE_KEYWORD_CANDIDATE_MULTIPLIER = '3';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3: HYBRID SEARCH INTEGRATION TESTS');
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

    // Setup StudySessions
    await new StudySession({
      _id: workspaceA,
      user: userA,
      title: 'Workspace A',
      resources: [
        { _id: resourceA1_Id, type: 'pdf', title: 'Resource A1 PDF', url: 'pdfA1' },
        { _id: resourceA2_Id, type: 'youtube', title: 'Resource A2 YouTube', url: 'ytA2' }
      ]
    }).save();

    await new StudySession({
      _id: workspaceB,
      user: userB,
      title: 'Workspace B',
      resources: [
        { _id: resourceB_Id, type: 'pdf', title: 'Resource B PDF', url: 'pdfB' }
      ]
    }).save();

    // Create KnowledgeDocuments
    const docA1 = await KnowledgeDocument.create({
      resourceId: resourceA1_Id,
      workspaceId: workspaceA,
      userId: userA,
      type: 'PDF',
      title: 'Resource A1 PDF',
      contentHash: 'hashA1',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });

    const docA2 = await KnowledgeDocument.create({
      resourceId: resourceA2_Id,
      workspaceId: workspaceA,
      userId: userA,
      type: 'YOUTUBE',
      title: 'Resource A2 YouTube',
      contentHash: 'hashA2',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });

    const docB = await KnowledgeDocument.create({
      resourceId: resourceB_Id,
      workspaceId: workspaceB,
      userId: userB,
      type: 'PDF',
      title: 'Resource B PDF',
      contentHash: 'hashB',
      embeddingModel: 'gemini-embedding-001',
      embeddingStatus: 'SUCCESS',
      processingStatus: 'READY'
    });

    // Setup embeddings and chunks
    const vecDimension = 768;
    const vecMitochondria = new Array(vecDimension).fill(0).map((_, idx) => (idx === 0 ? 1.0 : 0.0)); // vector for semantic search match
    const vecPhotosynthesis = new Array(vecDimension).fill(0).map((_, idx) => (idx === 1 ? 1.0 : 0.0)); // different vector
    const vecSchrodinger = new Array(vecDimension).fill(0).map((_, idx) => (idx === 2 ? 1.0 : 0.0)); // workspace B vector

    const chunkA1 = await KnowledgeChunk.create({
      documentId: docA1._id,
      resourceId: resourceA1_Id,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Mitochondria is the powerhouse of the cell.',
      embedding: vecMitochondria,
      chunkIndex: 0,
      contentHash: 'hashA1',
      metadata: { pageStart: 5, pageEnd: 5, section: 'Cell Biology', heading: 'Mitochondria' }
    });

    const chunkA2 = await KnowledgeChunk.create({
      documentId: docA2._id,
      resourceId: resourceA2_Id,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Photosynthesis converts sunlight into chemical energy.',
      embedding: vecPhotosynthesis,
      chunkIndex: 0,
      contentHash: 'hashA2',
      metadata: { timestampStart: 120, timestampEnd: 180, section: 'Plant Biology' }
    });

    const chunkB = await KnowledgeChunk.create({
      documentId: docB._id,
      resourceId: resourceB_Id,
      workspaceId: workspaceB,
      userId: userB,
      text: 'Schrodinger cat is alive and dead simultaneously.',
      embedding: vecSchrodinger,
      chunkIndex: 0,
      contentHash: 'hashB',
      metadata: { pageStart: 12, pageEnd: 13, section: 'Quantum Physics' }
    });

    // Mock Embedding service generateEmbedding
    const originalGenerateEmbedding = embeddingService.generateEmbedding;
    embeddingService.generateEmbedding = async (queryText) => {
      if (queryText.includes('mitochondria') || queryText.includes('energy-station')) {
        return vecMitochondria;
      }
      if (queryText.includes('photosynthesis')) {
        return vecPhotosynthesis;
      }
      return new Array(vecDimension).fill(0);
    };

    console.log('\n[Test 1] Verifying Hybrid Deduplication & Fusion Scoring...');
    // Query triggers BOTH semantic and keyword match on chunkA1 ('mitochondria' matches keyword AND vector)
    const resultsHybrid = await retrievalService.retrieve(userA, workspaceA, 'mitochondria is powerhouse', 5);
    
    const match = resultsHybrid.find(r => r.chunkId === chunkA1._id.toString());
    if (!match) {
      throw new Error('Expected chunkA1 to be returned in hybrid search.');
    }
    if (resultsHybrid[0].chunkId !== chunkA1._id.toString()) {
      throw new Error('Expected chunkA1 to be the top ranked result.');
    }
    // Check score fusion (semantic weight is 0.7, keyword is 0.3)
    // Both semantic and keyword matched chunkA1, so scores should be merged.
    if (match.semanticScore === 0 || match.keywordScore === 0) {
      throw new Error(`Expected positive scores for both pathways. Semantic: ${match.semanticScore}, Keyword: ${match.keywordScore}`);
    }
    const expectedScore = (match.semanticScore * 0.7) + (match.keywordScore * 0.3);
    if (Math.abs(match.score - expectedScore) > 0.0001) {
      throw new Error(`Merged score mismatch: got ${match.score}, expected ${expectedScore}`);
    }
    console.log('✓ Combined Hybrid Fusion, Deduplication, and Fusion Scoring verified.');

    console.log('\n[Test 2] Verifying Semantic-Only Search (Keyword mismatch)...');
    // Searching for text that doesn't exist but has similar vector (using our vecMitochondria mock)
    // Querying 'energy-station' will trigger semantic match (using vecMitochondria) but 0 keyword matches
    const resultsSemanticOnly = await retrievalService.retrieve(userA, workspaceA, 'energy-station', 5);
    const semanticMatch = resultsSemanticOnly.find(r => r.chunkId === chunkA1._id.toString());
    if (!semanticMatch || semanticMatch.semanticScore === 0 || semanticMatch.keywordScore !== 0) {
      throw new Error(`Semantic-only query failed to isolate semantic score. Semantic: ${semanticMatch?.semanticScore}, Keyword: ${semanticMatch?.keywordScore}`);
    }
    console.log('✓ Semantic-only search retrieval verified.');

    console.log('\n[Test 3] Verifying Keyword-Only Search (Semantic mismatch)...');
    // Searching for a word that exists in the text ('powerhouse') but querying with a zero-vector
    // We mock query embedding to return all zeros
    embeddingService.generateEmbedding = async (t) => new Array(vecDimension).fill(0);
    
    // Invalidate workspace cache to force DB execution
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resultsKeywordOnly = await retrievalService.retrieve(userA, workspaceA, 'powerhouse', 5);
    const keywordMatch = resultsKeywordOnly.find(r => r.chunkId === chunkA1._id.toString());
    if (!keywordMatch || keywordMatch.keywordScore === 0 || keywordMatch.semanticScore !== 0) {
      throw new Error(`Keyword-only query failed to isolate keyword score. Semantic: ${keywordMatch?.semanticScore}, Keyword: ${keywordMatch?.keywordScore}`);
    }
    console.log('✓ Keyword-only search retrieval verified.');

    console.log('\n[Test 4] Verifying Workspace Tenant Isolation...');
    // Querying workspaceA with a term that exists in Workspace B ('Schrodinger')
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resultsIsolation = await retrievalService.retrieve(userA, workspaceA, 'Schrodinger', 5);
    const hasWorkspaceBItem = resultsIsolation.some(r => r.workspaceId === workspaceB.toString());
    if (hasWorkspaceBItem) {
      throw new Error('Isolation breached! Workspace B chunk returned in Workspace A retrieval.');
    }
    console.log('✓ Workspace tenant isolation verified.');

    console.log('\n[Test 5] Verifying Resource isolation scoping...');
    // Retrieve scoped ONLY to resourceA2 (YouTube video about photosynthesis)
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resultsResourceScoped = await retrievalService.retrieve(userA, workspaceA, 'powerhouse photosynthesis', 5, { resourceId: resourceA2_Id });
    // Should NOT contain chunkA1 (since chunkA1 is resourceA1)
    const hasA1 = resultsResourceScoped.some(r => r.resourceId === resourceA1_Id);
    if (hasA1) {
      throw new Error('Resource scoping isolation violated! Found Resource A1 chunk in scoped Resource A2 query.');
    }
    console.log('✓ Resource isolation scoping verified.');

    console.log('\n[Test 6] Verifying Graceful Failure Fallbacks...');
    // Case A: Query embedding API throws error
    embeddingService.generateEmbedding = async (t) => {
      throw new Error('API Rate Limit Exceeded (mock)');
    };
    retrievalService.invalidateWorkspaceCache(workspaceA);
    // Retrieval should continue and fall back to keyword search cleanly without crashing
    const resultsFallback = await retrievalService.retrieve(userA, workspaceA, 'powerhouse', 5);
    if (resultsFallback.length === 0 || resultsFallback[0].keywordScore === 0) {
      throw new Error('Fallback failed to execute keyword search on semantic provider error.');
    }
    console.log('✓ Graceful failure fallbacks verified.');

    console.log('\n[Test 7] Verifying Source Metadata and Citation Fields...');
    // Invalidate cache and retrieve chunkA1
    embeddingService.generateEmbedding = async (t) => vecMitochondria;
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resultsMetadata = await retrievalService.retrieve(userA, workspaceA, 'mitochondria', 5);
    const itemA1 = resultsMetadata.find(r => r.chunkId === chunkA1._id.toString());
    
    if (!itemA1 || !itemA1.sourceMetadata) {
      throw new Error('Source metadata is missing.');
    }
    // Verify PDF fields
    if (itemA1.sourceMetadata.pageStart !== 5 || itemA1.sourceMetadata.resourceType !== 'PDF') {
      throw new Error('PDF citation metadata mismatched or corrupted.');
    }

    // Retrieve chunkA2 (YouTube transcript)
    retrievalService.invalidateWorkspaceCache(workspaceA);
    const resultsMetadataYT = await retrievalService.retrieve(userA, workspaceA, 'photosynthesis', 5);
    const itemA2 = resultsMetadataYT.find(r => r.chunkId === chunkA2._id.toString());
    
    if (!itemA2 || !itemA2.sourceMetadata) {
      throw new Error('YouTube source metadata is missing.');
    }
    // Verify YouTube fields
    if (itemA2.sourceMetadata.timestampStart !== 120 || itemA2.sourceMetadata.resourceType !== 'YOUTUBE') {
      throw new Error('YouTube timestamp citation metadata mismatched or corrupted.');
    }
    console.log('✓ Source metadata fields verified successfully.');

    // Database Cleanup
    console.log('\nCleaning up hybrid test records...');
    await StudySession.deleteOne({ _id: workspaceA });
    await StudySession.deleteOne({ _id: workspaceB });
    await KnowledgeDocument.deleteMany({ userId: { $in: [userA, userB] } });
    await KnowledgeChunk.deleteMany({ userId: { $in: [userA, userB] } });

    // Restore provider
    embeddingService.generateEmbedding = originalGenerateEmbedding;

    await disconnectDB();
    console.log('\n====================================================');
    console.log('ALL PHASE 3.3 HYBRID SEARCH INTEGRATION TESTS PASSED SUCCESS');
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
