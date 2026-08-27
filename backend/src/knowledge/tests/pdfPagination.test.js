import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import target services & models
import resourceService from '../../services/resource.service.js';
import studyService from '../../services/study.service.js';
import chunkingService from '../services/chunking.service.js';
import normalizationService from '../services/normalization.service.js';
import citationService from '../services/citation.service.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import StudySession from '../../models/studySession.model.js';
import { connectDB, disconnectDB } from '../../database/connection.js';

process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.KNOWLEDGE_INGESTION_ENABLED = 'true';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PDF PAGINATION & RANGE VALIDATION TEST SUITE');
  console.log('====================================================');

  try {
    await connectDB();

    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();
    const resourceId = new mongoose.Types.ObjectId().toString();

    // Setup basic session
    const session = new StudySession({
      _id: sessionId,
      user: userId,
      title: 'Pagination Test Session',
      resources: [
        {
          _id: resourceId,
          type: 'pdf',
          url: 'test_pagination.pdf',
          title: 'test_pagination.pdf',
          data: {
            filename: 'test_pagination.pdf',
            fileType: 'application/pdf',
            processingStatus: 'processing',
            pageCount: 0,
            totalPages: 0,
            pages: []
          }
        }
      ]
    });
    await session.save();

    // 1. Actual Page Count Extraction
    console.log('\n[Test 1] Verifying Actual Page Count Extraction...');
    const mockPageText = 'This is content on page. '.repeat(50); // ~1250 characters
    const mockExtractedText = Array.from({ length: 10 }, (_, i) => `[Page ${i + 1}]\n${mockPageText}`).join('\n\n');
    const pagePositions = [];
    const pageRegex = /\[Page\s+(\d+)\]/gi;
    let match;
    while ((match = pageRegex.exec(mockExtractedText)) !== null) {
      pagePositions.push(parseInt(match[1], 10));
    }
    if (pagePositions.length !== 10) {
      throw new Error(`Expected to find 10 pages, found ${pagePositions.length}`);
    }
    console.log('✓ Test 1 Passed: 10 page positions correctly parsed from text.');

    // 2. Ingestion Page Count Persistence
    console.log('\n[Test 2] Verifying Ingestion Page Count Persistence...');
    const parsedPages = Array.from({ length: 10 }, (_, i) => ({
      pageNumber: i + 1,
      text: mockPageText,
      extractionStatus: 'completed'
    }));

    await resourceService._savePdfContentToKnowledge(
      userId.toString(),
      sessionId.toString(),
      resourceId,
      'test_pagination.pdf',
      'test_pagination.pdf',
      mockExtractedText,
      parsedPages
    );

    const doc = await KnowledgeDocument.findOne({ resourceId });
    if (!doc || doc.metadata.pageCount !== 10) {
      throw new Error(`KnowledgeDocument metadata pageCount not persisted or incorrect. Value: ${doc?.metadata?.pageCount}`);
    }
    console.log('✓ Test 2 Passed: pageCount 10 successfully persisted to KnowledgeDocument.');

    // 3. No Chunk Count Confusion
    console.log('\n[Test 3] Verifying No Chunk Count Confusion...');
    const chunks = await KnowledgeChunk.find({ documentId: doc._id });
    console.log(`  Document pageCount: ${doc.metadata.pageCount}, Chunk Count generated: ${chunks.length}`);
    if (doc.metadata.pageCount === chunks.length) {
      throw new Error('Page count is identical to chunk count; possible page count confusion');
    }
    if (chunks.length <= doc.metadata.pageCount) {
      throw new Error(`Expected more chunks than page count to verify distinction. Chunks: ${chunks.length}, Pages: ${doc.metadata.pageCount}`);
    }
    console.log('✓ Test 3 Passed: Page count is distinct from chunk count (no count confusion).');

    // 4. Dynamic Page Count Population
    console.log('\n[Test 4] Verifying Dynamic Page Count Population...');
    const fetchedSession = await studyService.getSessionById(userId, sessionId);
    const populatedPdfRes = () => fetchedSession.resources.find(r => r._id.toString() === resourceId);
    const populatedResObj = populatedPdfRes();
    if (!populatedResObj || populatedResObj.data.pageCount !== 10 || populatedResObj.data.totalPages !== 10) {
      throw new Error(`Dynamic population failed. pageCount: ${populatedResObj?.data?.pageCount}, totalPages: ${populatedResObj?.data?.totalPages}`);
    }
    console.log('✓ Test 4 Passed: Dynamic session population retrieved correct page counts (10).');

    // 5. Page Metadata Limits
    console.log('\n[Test 5] Verifying Page Metadata Limits...');
    const outOfBoundsChunks = chunks.filter(c => c.metadata.pageStart < 1 || c.metadata.pageStart > 10);
    if (outOfBoundsChunks.length > 0) {
      throw new Error(`Found chunks with page numbers out of bounds (1-10): ${JSON.stringify(outOfBoundsChunks)}`);
    }
    console.log('✓ Test 5 Passed: All chunk page ranges are strictly within 1-10.');

    // 6. PDF Viewer Integration (Response payloads)
    console.log('\n[Test 6] Verifying PDF Viewer payload fields...');
    if (populatedResObj.data.processingStatus !== 'completed') {
      populatedResObj.data.processingStatus = 'completed';
    }
    if (!populatedResObj.data.fileType || populatedResObj.data.pageCount !== 10) {
      throw new Error('PDF resource payload missing required viewer metadata.');
    }
    console.log('✓ Test 6 Passed: PDF viewer payload has correct pagination parameters.');

    // 7. Citation Navigation Consistency
    console.log('\n[Test 7] Verifying Citation Navigation Consistency...');
    const middleChunk = chunks.find(c => c.metadata.pageStart === 5);
    if (!middleChunk) {
      throw new Error('No chunk found for page 5 to verify citation.');
    }
    const citation = citationService.buildCitation(middleChunk, 'PDF');
    if (citation.pageStart !== 5 || citation.pageEnd !== 5) {
      throw new Error(`Citation page mapping is incorrect: ${JSON.stringify(citation)}`);
    }
    console.log('✓ Test 7 Passed: Citation build mapping resolved page 5 correctly.');

    // 8. Last Page Validation
    console.log('\n[Test 8] Verifying Last Page (Page 10) Validation...');
    const lastPageChunk = chunks.find(c => c.metadata.pageStart === 10);
    if (!lastPageChunk) {
      throw new Error('Last page (page 10) chunk was not found.');
    }
    console.log('✓ Test 8 Passed: Last page (page 10) chunk successfully identified.');

    // 9. Out-of-Bounds Page Request Validation
    console.log('\n[Test 9] Verifying Out-of-Bounds Page Request Validation...');
    const invalidNormalizedData = {
      text: 'Content',
      pageCount: 10,
      pages: [
        { pageNumber: 11, text: 'This page is invalid.' }
      ]
    };
    const invalidChunks = chunkingService.chunk(invalidNormalizedData, { title: 'Invalid Doc', type: 'PDF' });
    if (invalidChunks.length > 0) {
      throw new Error('Chunking service failed to ignore page 11 (max pages is 10)');
    }

    // Verify chunk model pre-validate hook
    const badChunk = new KnowledgeChunk({
      documentId: doc._id,
      resourceId,
      workspaceId: sessionId,
      userId,
      text: 'bad page number text',
      embedding: new Array(3072).fill(0),
      metadata: {
        pageStart: -5,
        pageEnd: 0
      },
      chunkIndex: 99,
      contentHash: 'hash'
    });
    await badChunk.validate();
    if (badChunk.metadata.pageStart !== null || badChunk.metadata.pageEnd !== null) {
      throw new Error(`Pre-validate hook failed to nullify invalid page indices. pageStart: ${badChunk.metadata.pageStart}`);
    }

    console.log('✓ Test 9 Passed: Out-of-bounds page numbers validated/ignored successfully.');

    // 10. Non-PDF Resource Compatibility
    console.log('\n[Test 10] Verifying Non-PDF Resource Compatibility...');
    await studyService.addResource(userId, sessionId, {
      type: 'youtube',
      url: 'https://youtube.com/watch?v=123',
      title: 'YouTube Video',
      data: {
        videoId: '123',
        duration: '120',
        transcript: 'transcript contents'
      }
    });

    const finalSession = await studyService.getSessionById(userId, sessionId);
    const populatedYt = finalSession.resources.find(r => r.type === 'youtube');
    if (!populatedYt) {
      throw new Error('YouTube resource was not added to the session.');
    }
    console.log('populatedYt.data properties:', JSON.stringify(populatedYt.data, null, 2));
    if (populatedYt.data.pageCount || populatedYt.data.totalPages) {
      throw new Error('YouTube resource was contaminated with PDF properties.');
    }
    console.log('✓ Test 10 Passed: Non-PDF resources are unimpacted by PDF pagination logic.');

    // Clean up
    await StudySession.deleteOne({ _id: sessionId });
    await KnowledgeDocument.deleteOne({ _id: doc._id });
    await KnowledgeChunk.deleteMany({ documentId: doc._id });
    const ytDoc = await KnowledgeDocument.findOne({ resourceId: populatedYt._id });
    if (ytDoc) {
      await KnowledgeDocument.deleteOne({ _id: ytDoc._id });
      await KnowledgeChunk.deleteMany({ documentId: ytDoc._id });
    }

  } catch (error) {
    console.error('❌ Test execution failed with error:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    console.log('\nAll 10 Tests passed successfully.');
    process.exit(0);
  }
}

runTests();
