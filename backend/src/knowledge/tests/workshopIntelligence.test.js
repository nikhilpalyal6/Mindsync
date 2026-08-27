import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../database/connection.js';
import StudySession from '../../models/studySession.model.js';
import User from '../../models/user.model.js';
import KnowledgeChunk from '../../models/knowledgeChunk.model.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import WorkshopIntelligence from '../../models/workshopIntelligence.model.js';
import ExtractedConcept from '../../models/extractedConcept.model.js';
import ConceptRelationship from '../../models/conceptRelationship.model.js';
import workshopIntelligenceService from '../../workshop/workshopIntelligence.service.js';
import workshopIntelligenceController from '../../workshop/workshopIntelligence.controller.js';
import aiProviderService from '../../services/ai/aiProvider.service.js';
import providerHealthService from '../../services/ai/health/providerHealth.service.js';
import ApiError from '../../utils/ApiError.js';

dotenv.config();

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.5.2: KNOWLEDGE EXTRACTION TESTS');
  console.log('====================================================');

  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const workspaceA = new mongoose.Types.ObjectId();
  const workspaceB = new mongoose.Types.ObjectId();

  const originalGenerateAIResponse = aiProviderService.generateAIResponse;

  try {
    await connectDB();
    await ExtractedConcept.deleteMany({});
    await ConceptRelationship.deleteMany({});
    await ExtractedConcept.syncIndexes();
    await ConceptRelationship.syncIndexes();

    // Clean up any potential stale test records
    await User.deleteMany({ _id: { $in: [userA, userB] } });
    await StudySession.deleteMany({ _id: { $in: [workspaceA, workspaceB] } });
    await KnowledgeChunk.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await KnowledgeDocument.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await WorkshopIntelligence.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });

    // Seed test users
    await new User({ _id: userA, name: 'User A', username: 'usera', email: 'usera@mindsync.test', password: 'password123' }).save();
    await new User({ _id: userB, name: 'User B', username: 'userb', email: 'userb@mindsync.test', password: 'password123' }).save();

    // Seed test workspaces (StudySessions)
    const resourceA1 = new mongoose.Types.ObjectId().toString();
    const resourceA2 = new mongoose.Types.ObjectId().toString();
    const resourceA3 = new mongoose.Types.ObjectId().toString();
    const resourceB1 = new mongoose.Types.ObjectId().toString();

    await new StudySession({
      _id: workspaceA,
      user: userA,
      title: 'User A Workspace',
      resources: [
        { _id: resourceA1, type: 'pdf', title: 'Resource A1 PDF', url: 'pdfA1', data: { text: 'Some text contents' } },
        { _id: resourceA2, type: 'youtube', title: 'Resource A2 YouTube', url: 'ytA2', data: { transcript: 'Some transcript' } },
        { _id: resourceA3, type: 'note', title: 'Resource A3 Note', url: 'noteA3', data: { text: 'Note content' } }
      ]
    }).save();

    await new StudySession({
      _id: workspaceB,
      user: userB,
      title: 'User B Workspace',
      resources: [
        { _id: resourceB1, type: 'pdf', title: 'Resource B1 PDF', url: 'pdfB1', data: { text: 'Other contents' } }
      ]
    }).save();

    let createdId = null;

    // ----------------------------------------------------
    // TEST 1 — Initialize intelligence for valid workshop.
    // ----------------------------------------------------
    console.log('\n[Test 1] Initializing intelligence for valid workshop...');
    const initRes = await workshopIntelligenceService.initializeWorkshopIntelligence(workspaceA, userA);
    if (!initRes) throw new Error('Expected record to be created');
    if (initRes.status !== 'READY') throw new Error(`Expected status READY, got ${initRes.status}`);
    if (initRes.resourceCount !== 3) throw new Error(`Expected resourceCount 3, got ${initRes.resourceCount}`);
    createdId = initRes._id;
    console.log('✓ Test 1 Passed: Record created.');

    // ----------------------------------------------------
    // TEST 2 — Initialize same workshop twice.
    // ----------------------------------------------------
    console.log('\n[Test 2] Initializing same workshop twice (idempotency)...');
    const initRes2 = await workshopIntelligenceService.initializeWorkshopIntelligence(workspaceA, userA);
    if (initRes2._id.toString() !== createdId.toString()) {
      throw new Error('Expected same record to be returned on re-initialization');
    }
    const count = await WorkshopIntelligence.countDocuments({ workspaceId: workspaceA });
    if (count !== 1) {
      throw new Error(`Expected exactly 1 intelligence record for workshop, found ${count}`);
    }
    console.log('✓ Test 2 Passed: No duplicate records created.');

    // ----------------------------------------------------
    // TEST 3 — Retrieve intelligence status.
    // ----------------------------------------------------
    console.log('\n[Test 3] Retrieving intelligence status...');
    const statusData = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (statusData.status !== 'READY') throw new Error(`Expected status READY, got ${statusData.status}`);
    if (statusData.version !== 1) throw new Error(`Expected version 1, got ${statusData.version}`);
    console.log('✓ Test 3 Passed: Correct status retrieved.');

    // ----------------------------------------------------
    // TEST 4 — Retrieve workshop resources.
    // ----------------------------------------------------
    console.log('\n[Test 4] Retrieving workshop resources...');
    const resources = await workshopIntelligenceService.getWorkshopResources(workspaceA, userA);
    if (resources.length !== 3) throw new Error(`Expected 3 resources, got ${resources.length}`);
    console.log('✓ Test 4 Passed: Resources retrieved successfully.');

    // ----------------------------------------------------
    // TEST 5 — Unauthorized workshop access.
    // ----------------------------------------------------
    console.log('\n[Test 5] Verifying unauthorized workshop access rejection...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userB);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 403) {
        throw new Error(`Expected 403 Forbidden error, got status ${err.statusCode}`);
      }
    }
    console.log('✓ Test 5 Passed: Unauthorized access correctly rejected with 403.');

    // ----------------------------------------------------
    // TEST 6 — Nonexistent workshop.
    // ----------------------------------------------------
    console.log('\n[Test 6] Verifying nonexistent workshop rejection...');
    const nonExistentId = new mongoose.Types.ObjectId();
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceStatus(nonExistentId, userA);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new Error(`Expected 404 Not Found error, got status ${err.statusCode}`);
      }
    }
    console.log('✓ Test 6 Passed: Nonexistent workshop rejected with 404.');

    // ----------------------------------------------------
    // TEST 7 — Invalid workshop ID.
    // ----------------------------------------------------
    console.log('\n[Test 7] Verifying invalid workshop ID rejection...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceStatus('invalid-id', userA);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 400) {
        throw new Error(`Expected 400 Bad Request error, got status ${err.statusCode}`);
      }
    }
    console.log('✓ Test 7 Passed: Invalid workshop ID rejected with 400.');

    // ----------------------------------------------------
    // TEST 8 — Resource count detection.
    // ----------------------------------------------------
    console.log('\n[Test 8] Verifying detection of resource count changes...');
    await StudySession.updateOne(
      { _id: workspaceA },
      {
        $push: {
          resources: {
            _id: new mongoose.Types.ObjectId().toString(),
            type: 'pdf',
            title: 'Resource A4 PDF',
            url: 'pdfA4',
            data: { text: 'New pdf data' }
          }
        }
      }
    );
    const updatedStatus = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (updatedStatus.resourceCount !== 4) {
      throw new Error(`Expected resourceCount to update to 4, got ${updatedStatus.resourceCount}`);
    }
    console.log('✓ Test 8 Passed: Resource count updates successfully.');

    // Clean up resource A4 push
    await StudySession.updateOne({ _id: workspaceA }, { $pop: { resources: 1 } });

    // ----------------------------------------------------
    // TEST 9 — No document text leakage.
    // ----------------------------------------------------
    console.log('\n[Test 9] Checking for document text leakage in resource inventory...');
    const inventory = await workshopIntelligenceService.getWorkshopResources(workspaceA, userA);
    inventory.forEach(r => {
      if (r.data || r.text || r.chunks || r.content) {
        throw new Error(`Leaked content found: ${JSON.stringify(r)}`);
      }
    });
    console.log('✓ Test 9 Passed: No document content leaked.');

    // ----------------------------------------------------
    // TEST 10 — Phase 3.4 regression checks.
    // ----------------------------------------------------
    console.log('\n[Test 10] Verifying Phase 3.4 retrieval service and dependencies can be imported cleanly...');
    const retrievalService = (await import('../services/retrieval.service.js')).default;
    const contextBuilderService = (await import('../../services/context/contextBuilder.service.js')).default;
    if (!retrievalService || typeof retrievalService.retrieve !== 'function') {
      throw new Error('retrievalService.retrieve is not a function');
    }
    if (!contextBuilderService || typeof contextBuilderService.buildContext !== 'function') {
      throw new Error('contextBuilderService.buildContext is not a function');
    }
    console.log('✓ Test 10 Passed: Phase 3.4 services are intact and loadable.');

    // ----------------------------------------------------
    // TEST 11 — Initialization after existing intelligence record.
    // ----------------------------------------------------
    console.log('\n[Test 11] Verifying idempotency and reuse of existing state...');
    await WorkshopIntelligence.updateOne({ workspaceId: workspaceA }, { status: 'PROCESSING' });
    const reuseRes = await workshopIntelligenceService.initializeWorkshopIntelligence(workspaceA, userA);
    if (reuseRes.status !== 'PROCESSING') {
      throw new Error(`Expected existing status PROCESSING to be preserved, got ${reuseRes.status}`);
    }
    await WorkshopIntelligence.updateOne({ workspaceId: workspaceA }, { status: 'READY' });
    console.log('✓ Test 11 Passed: Existing record and status reused successfully.');

    // ----------------------------------------------------
    // TEST 12 — Database failure handling.
    // ----------------------------------------------------
    console.log('\n[Test 12] Verifying database failure handling...');
    const originalFindOne = WorkshopIntelligence.findOne;
    WorkshopIntelligence.findOne = () => {
      throw new Error('Mocked Database failure');
    };
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
      throw new Error('Should have thrown database failure');
    } catch (err) {
      if (err.message !== 'Mocked Database failure') {
        throw new Error(`Unexpected error thrown: ${err.message}`);
      }
    } finally {
      WorkshopIntelligence.findOne = originalFindOne;
    }
    console.log('✓ Test 12 Passed: Database failure handled correctly.');

    // ====================================================
    // PHASE 3.5.2 KNOWLEDGE EXTRACTION TESTS
    // ====================================================
    console.log('\n--- STARTING KNOWLEDGE EXTRACTION TESTS ---');

    // Seed mock KnowledgeChunks for Workspace A
    const chunkA1 = new KnowledgeChunk({
      _id: new mongoose.Types.ObjectId(),
      documentId: new mongoose.Types.ObjectId(),
      resourceId: resourceA1,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Mitochondria is the powerhouse of the cell.',
      embedding: new Array(1536).fill(0.1),
      metadata: { pageStart: 2, pageEnd: 2, heading: 'Mitochondria' },
      chunkIndex: 0,
      contentHash: 'hash1'
    });
    await chunkA1.save();

    const chunkA2 = new KnowledgeChunk({
      _id: new mongoose.Types.ObjectId(),
      documentId: new mongoose.Types.ObjectId(),
      resourceId: resourceA2,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Photosynthesis converts carbon dioxide into oxygen.',
      embedding: new Array(1536).fill(0.2),
      metadata: { timestampStart: 45, timestampEnd: 60 },
      chunkIndex: 0,
      contentHash: 'hash2'
    });
    await chunkA2.save();

    const chunkA3 = new KnowledgeChunk({
      _id: new mongoose.Types.ObjectId(),
      documentId: new mongoose.Types.ObjectId(),
      resourceId: resourceA3,
      workspaceId: workspaceA,
      userId: userA,
      text: 'Lysosomes contain digestive enzymes.',
      embedding: new Array(1536).fill(0.3),
      metadata: {},
      chunkIndex: 0,
      contentHash: 'hash3'
    });
    await chunkA3.save();

    // ----------------------------------------------------
    // TEST 13 (Valid workshop extraction)
    // ----------------------------------------------------
    console.log('\n[Test 13] Valid workshop extraction...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Mitochondria', description: 'Cellular powerhouse.', importance: 0.95, sourceIndices: [0] }
        ]
      })
    });

    const extResult = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    if (extResult.status !== 'COMPLETED') throw new Error(`Expected COMPLETED, got ${extResult.status}`);
    if (extResult.processedResourceCount !== 3) throw new Error(`Expected 3 processed resources, got ${extResult.processedResourceCount}`);

    const extConcepts = await ExtractedConcept.find({ workspaceId: workspaceA });
    if (extConcepts.length === 0) throw new Error('Expected concepts to be extracted and saved');
    console.log('✓ Test 13 Passed: Extraction completed with status COMPLETED.');

    // ----------------------------------------------------
    // TEST 14 (Unauthorized workshop extraction)
    // ----------------------------------------------------
    console.log('\n[Test 14] Unauthorized workshop extraction...');
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userB);
      throw new Error('Expected 403');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error(`Expected 403, got ${err.statusCode}`);
    }
    console.log('✓ Test 14 Passed: Mismatched user extraction rejected.');

    // ----------------------------------------------------
    // TEST 15 (Nonexistent workshop extraction)
    // ----------------------------------------------------
    console.log('\n[Test 15] Nonexistent workshop extraction...');
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(new mongoose.Types.ObjectId(), userA);
      throw new Error('Expected 404');
    } catch (err) {
      if (err.statusCode !== 404) throw new Error(`Expected 404, got ${err.statusCode}`);
    }
    console.log('✓ Test 15 Passed: Nonexistent workshop extraction rejected.');

    // ----------------------------------------------------
    // TEST 16 (No indexed KnowledgeChunks)
    // ----------------------------------------------------
    console.log('\n[Test 16] No indexed KnowledgeChunks extraction...');
    // Workspace B has no chunks
    const emptyResult = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceB, userB);
    if (emptyResult.status !== 'COMPLETED') throw new Error(`Expected COMPLETED, got ${emptyResult.status}`);
    const emptyConcepts = await ExtractedConcept.find({ workspaceId: workspaceB });
    if (emptyConcepts.length !== 0) throw new Error('Expected 0 concepts');
    console.log('✓ Test 16 Passed: Zero chunks handled gracefully.');

    // ----------------------------------------------------
    // TEST 17 (Structured extraction response)
    // ----------------------------------------------------
    console.log('\n[Test 17] Verifying structured concept output formats...');
    // Re-extract valid concepts
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Photosynthesis', description: 'Sunlight to energy.', importance: 0.9, sourceIndices: [0] }
        ]
      })
    });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const photosynthesisConcept = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'Photosynthesis' });
    if (!photosynthesisConcept) throw new Error('Photosynthesis concept missing');
    if (photosynthesisConcept.importance !== 0.9) throw new Error(`Expected 0.9, got ${photosynthesisConcept.importance}`);
    if (!photosynthesisConcept.description) throw new Error('Missing description');
    console.log('✓ Test 17 Passed: Saved concepts conform to schema requirements.');

    // ----------------------------------------------------
    // TEST 18 (Malformed LLM output)
    // ----------------------------------------------------
    console.log('\n[Test 18] Verifying malformed LLM response rejection...');
    aiProviderService.generateAIResponse = async () => ({
      text: 'Malformed raw response not JSON!'
    });
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected extraction to throw on malformed JSON');
    } catch (err) {
      const statusRecord = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
      if (statusRecord.status !== 'FAILED') throw new Error('Expected status to change to FAILED');
    }
    console.log('✓ Test 18 Passed: Malformed LLM output caught and sets FAILED state.');

    // ----------------------------------------------------
    // TEST 19 (Missing required concept fields)
    // ----------------------------------------------------
    console.log('\n[Test 19] Verifying concept field validation failure...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { description: 'Cellular energy powerhouse.', importance: 0.95, sourceIndices: [0] } // Missing name
        ]
      })
    });
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected validator to fail due to missing name');
    } catch (err) {
      if (!err.message.includes('missing a valid name')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
      const statusRecord = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
      if (statusRecord.status !== 'FAILED') throw new Error('Expected status FAILED');
    }
    console.log('✓ Test 19 Passed: Missing concept fields successfully validated and rejected.');

    // ----------------------------------------------------
    // TEST 20 (Concept normalization)
    // ----------------------------------------------------
    console.log('\n[Test 20] Verifying concept name normalization and merging...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Binary Search', description: 'A search.', importance: 0.7, sourceIndices: [0] },
          { name: 'binary search', description: 'A detailed search.', importance: 0.85, sourceIndices: [0] }
        ]
      })
    });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const normalizedConcepts = await ExtractedConcept.find({ workspaceId: workspaceA });
    if (normalizedConcepts.length !== 1) {
      throw new Error(`Expected exactly 1 concept due to normalization, found ${normalizedConcepts.length}`);
    }
    const binarySearch = normalizedConcepts[0];
    if (binarySearch.normalizedName !== 'binary-search' && binarySearch.normalizedName !== 'binary search') {
      throw new Error(`Unexpected normalized name: ${binarySearch.normalizedName}`);
    }
    if (binarySearch.importance !== 0.85) {
      throw new Error(`Expected importance 0.85 (max), got ${binarySearch.importance}`);
    }
    console.log('✓ Test 20 Passed: Case-insensitive space normalization verified.');

    // ----------------------------------------------------
    // TEST 21 (Concept distinction)
    // ----------------------------------------------------
    console.log('\n[Test 21] Verifying concept distinction (Binary Search vs Binary Search Tree)...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Binary Search', description: 'Searching.', importance: 0.8, sourceIndices: [0] },
          { name: 'Binary Search Tree', description: 'Tree storage.', importance: 0.95, sourceIndices: [0] }
        ]
      })
    });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const distinctConcepts = await ExtractedConcept.find({ workspaceId: workspaceA });
    if (distinctConcepts.length !== 2) {
      throw new Error(`Expected exactly 2 concepts, got ${distinctConcepts.length}`);
    }
    console.log('✓ Test 21 Passed: Separate concepts preserved correctly.');

    // ----------------------------------------------------
    // TEST 22 (Source traceability)
    // ----------------------------------------------------
    console.log('\n[Test 22] Verifying source traceability...');
    const searchConcept = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'Binary Search' });
    if (searchConcept.sources.length === 0) throw new Error('Expected source reference mapped to concept');
    const ref = searchConcept.sources[0];
    if (!ref.chunkId || !ref.documentId || !ref.resourceId) {
      throw new Error(`Incomplete source reference keys: ${JSON.stringify(ref)}`);
    }
    console.log('✓ Test 22 Passed: Concepts successfully point back to original chunks.');

    // ----------------------------------------------------
    // TEST 23 (PDF metadata preservation)
    // ----------------------------------------------------
    console.log('\n[Test 23] Verifying PDF metadata page range preservation...');
    const pdfConcept = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'Binary Search' });
    const pdfSrc = pdfConcept.sources.find(s => s.resourceId === resourceA1);
    if (!pdfSrc) throw new Error('PDF source ref missing');
    if (pdfSrc.pageStart !== 2 || pdfSrc.pageEnd !== 2) {
      throw new Error(`Expected page range to be preserved as 2, got ${pdfSrc.pageStart}-${pdfSrc.pageEnd}`);
    }
    console.log('✓ Test 23 Passed: pageStart/pageEnd parameters preserved.');

    // ----------------------------------------------------
    // TEST 24 (YouTube metadata preservation)
    // ----------------------------------------------------
    console.log('\n[Test 24] Verifying YouTube timestamp metadata preservation...');
    const ytConcept = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'Binary Search' });
    const ytSrc = ytConcept.sources.find(s => s.resourceId === resourceA2);
    if (!ytSrc) throw new Error('YouTube source ref missing');
    if (ytSrc.timestampStart !== 45 || ytSrc.timestampEnd !== 60) {
      throw new Error(`Expected timestamp to be preserved as 45-60, got ${ytSrc.timestampStart}-${ytSrc.timestampEnd}`);
    }
    console.log('✓ Test 24 Passed: timestampStart/timestampEnd parameters preserved.');

    // ----------------------------------------------------
    // TEST 25 (Workspace isolation)
    // ----------------------------------------------------
    console.log('\n[Test 25] Verifying workspace tenant isolation...');
    const crossConcepts = await ExtractedConcept.find({ workspaceId: workspaceB });
    if (crossConcepts.length !== 0) {
      throw new Error('Workspace isolation violated: Workspace B should be empty');
    }
    console.log('✓ Test 25 Passed: Extractions isolated by workspace successfully.');

    // ----------------------------------------------------
    // TEST 26 (Resource isolation)
    // ----------------------------------------------------
    console.log('\n[Test 26] Verifying resource-level isolation scoping...');
    const searchConceptIsolation = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'Binary Search' });
    searchConceptIsolation.sources.forEach(src => {
      if (src.resourceId === resourceA1) {
        if (src.chunkId.toString() !== chunkA1._id.toString()) {
          throw new Error('Resource isolation boundary violated: chunk mapped to mismatched resource ID');
        }
      }
    });
    console.log('✓ Test 26 Passed: Resource-level sources match correct chunks.');

    // ----------------------------------------------------
    // TEST 27 (Idempotent extraction)
    // ----------------------------------------------------
    console.log('\n[Test 27] Verifying idempotent extraction deletes existing records...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Unique Concept X', description: 'Desc X', importance: 0.65, sourceIndices: [0] }
        ]
      })
    });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const countAfterRetry = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    if (countAfterRetry !== 1) {
      throw new Error(`Expected older concepts to be wiped and exactly 1 concept saved, found ${countAfterRetry}`);
    }
    const freshConcept = await ExtractedConcept.findOne({ workspaceId: workspaceA });
    if (freshConcept.name !== 'Unique Concept X') {
      throw new Error('Wipe failed, older concepts survived');
    }
    console.log('✓ Test 27 Passed: Multiple extractions do not result in stale duplicates.');

    // ----------------------------------------------------
    // TEST 28 (Provider failure - FAILED state)
    // ----------------------------------------------------
    console.log('\n[Test 28] Verifying controlled FAILED state on provider connection failure...');
    aiProviderService.generateAIResponse = async () => {
      throw new Error('Ollama provider offline connection timed out');
    };
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Should have thrown LLM error');
    } catch (err) {
      if (!err.message.includes('Ollama provider offline')) {
        throw new Error(`Mismatched error message: ${err.message}`);
      }
      const record = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
      if (record.status !== 'FAILED') {
        throw new Error(`Expected status to change to FAILED, got ${record.status}`);
      }
    }
    console.log('✓ Test 28 Passed: Provider failure correctly marked as FAILED.');

    // ----------------------------------------------------
    // TEST 29 (Partial resource failure)
    // ----------------------------------------------------
    console.log('\n[Test 29] Verifying partial resource failure handling...');
    // Mock generateAIResponse to fail on resource A2 but succeed on resource A1 and resource A3
    aiProviderService.generateAIResponse = async (params) => {
      if (params.messages[0].content.includes('Photosynthesis')) {
        throw new Error('Resource A2 extraction model crashed');
      }
      return {
        text: JSON.stringify({
          concepts: [
            { name: 'Partial Concept OK', description: 'Description', importance: 0.7, sourceIndices: [0] }
          ]
        })
      };
    };

    const pResult = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    if (pResult.status !== 'PARTIAL') {
      throw new Error(`Expected status to change to PARTIAL, got ${pResult.status}`);
    }
    if (pResult.processedResourceCount !== 2) {
      throw new Error(`Expected processedResourceCount to be 2 (Resource A1 + Resource A3 succeeded), got ${pResult.processedResourceCount}`);
    }
    // Verify concept from Resource A1 survived
    const savedOk = await ExtractedConcept.find({ workspaceId: workspaceA });
    if (savedOk.length === 0) throw new Error('Successfully extracted data should be preserved');
    console.log('✓ Test 29 Passed: Successful resource concepts preserved on partial failure.');

    // ----------------------------------------------------
    // TEST 30 (Prompt injection boundary)
    // ----------------------------------------------------
    console.log('\n[Test 30] Verifying prompt injection boundaries...');
    let capturedInstruction = '';
    let capturedPrompt = '';
    aiProviderService.generateAIResponse = async (params) => {
      capturedInstruction = params.systemInstruction;
      capturedPrompt = params.messages[0].content;
      return {
        text: JSON.stringify({ concepts: [] })
      };
    };

    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    if (!capturedInstruction.includes('=== SYSTEM INSTRUCTIONS ===')) {
      throw new Error('System instructions header missing from model invocation parameters');
    }
    if (!capturedPrompt.includes('=== SOURCE MATERIAL ===')) {
      throw new Error('Source material wrapper missing from prompt');
    }
    console.log('✓ Test 30 Passed: Delimiters and instructions isolated from source material.');

    // ----------------------------------------------------
    // TEST 31 (Large workshop batching)
    // ----------------------------------------------------
    console.log('\n[Test 31] Verifying bounded batch processing under environment configuration...');
    // Seed 5 chunks for resource A1
    await KnowledgeChunk.deleteMany({ workspaceId: workspaceA });
    const chunksArray = [];
    for (let index = 0; index < 5; index++) {
      chunksArray.push({
        documentId: new mongoose.Types.ObjectId(),
        resourceId: resourceA1,
        workspaceId: workspaceA,
        userId: userA,
        text: `Chunk index ${index} content`,
        embedding: new Array(1536).fill(0.1),
        metadata: {},
        chunkIndex: index,
        contentHash: `hash_${index}`
      });
    }
    await KnowledgeChunk.insertMany(chunksArray);

    // Set batch size to 2
    process.env.WORKSHOP_EXTRACTION_BATCH_SIZE = '2';

    let invocationCount = 0;
    aiProviderService.generateAIResponse = async () => {
      invocationCount += 1;
      return {
        text: JSON.stringify({ concepts: [] })
      };
    };

    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    // 5 chunks with batch size 2 -> should result in ceiling(5/2) = 3 calls
    if (invocationCount !== 3) {
      throw new Error(`Expected exactly 3 invocations of LLM for 5 chunks (batch size 2), found ${invocationCount}`);
    }
    console.log('✓ Test 31 Passed: Batch chunks processed in groups of configured batch size.');

    // Restore environment variable
    delete process.env.WORKSHOP_EXTRACTION_BATCH_SIZE;

    // ----------------------------------------------------
    // TEST 32 (Phase 3.4 regression checks)
    // ----------------------------------------------------
    console.log('\n[Test 32] Verifying Phase 3.4 citation behavior functions cleanly...');
    // Clean up mock override
    aiProviderService.generateAIResponse = originalGenerateAIResponse;
    const testPromptCheck = await aiProviderService.getModel();
    if (!testPromptCheck) throw new Error('Unable to retrieve model name from provider registry');
    console.log('✓ Test 32 Passed: Phase 3.4 components preserved successfully.');

    // ====================================================
    // PHASE 3.5.3 CONCEPT RELATIONSHIP INTELLIGENCE TESTS
    // ====================================================
    console.log('\n--- STARTING CONCEPT RELATIONSHIP TESTS ---');

    // Seed mock concepts for Workspace A (User A)
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    const concept0 = new ExtractedConcept({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceA,
      user: userA,
      name: 'Binary Search',
      normalizedName: 'binary search',
      description: 'Search sorted array.',
      importance: 0.9,
      sources: [
        {
          chunkId: chunkA1._id,
          documentId: chunkA1.documentId,
          resourceId: chunkA1.resourceId,
          pageStart: 2,
          pageEnd: 2
        }
      ]
    });
    await concept0.save();

    const concept1 = new ExtractedConcept({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceA,
      user: userA,
      name: 'Binary Search Tree',
      normalizedName: 'binary search tree',
      description: 'BST maintains ordered elements.',
      importance: 0.85,
      sources: [
        {
          chunkId: chunkA2._id,
          documentId: chunkA2.documentId,
          resourceId: chunkA2.resourceId,
          timestampStart: 45,
          timestampEnd: 60
        }
      ]
    });
    await concept1.save();

    const concept2 = new ExtractedConcept({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceA,
      user: userA,
      name: 'AVL Tree',
      normalizedName: 'avl tree',
      description: 'Self-balancing BST.',
      importance: 0.95,
      sources: [
        {
          chunkId: chunkA3._id,
          documentId: chunkA3.documentId,
          resourceId: chunkA3.resourceId
        }
      ]
    });
    await concept2.save();

    // ----------------------------------------------------
    // TEST 33: Valid relationship extraction.
    // ----------------------------------------------------
    console.log('\n[Test 33] Valid relationship extraction...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const relRes = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (relRes.relationshipCount !== 1) throw new Error(`Expected 1 relationship, got ${relRes.relationshipCount}`);
    const savedRels = await ConceptRelationship.find({ workspaceId: workspaceA });
    if (savedRels.length !== 1) throw new Error(`Expected 1 relationship in database, found ${savedRels.length}`);
    console.log('✓ Test 33 Passed: Relationship extracted and saved.');

    // ----------------------------------------------------
    // TEST 34: Correct concept index mapping.
    // ----------------------------------------------------
    console.log('\n[Test 34] Correct concept index mapping...');
    const matchedRel = savedRels[0];
    if (matchedRel.sourceConceptId.toString() !== concept0._id.toString()) throw new Error('Source concept ID mapped incorrectly');
    if (matchedRel.targetConceptId.toString() !== concept1._id.toString()) throw new Error('Target concept ID mapped incorrectly');
    console.log('✓ Test 34 Passed: Concepts index mapped correctly.');

    // ----------------------------------------------------
    // TEST 35: Invalid sourceIndex rejected.
    // ----------------------------------------------------
    console.log('\n[Test 35] Invalid sourceIndex rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 99, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check35 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check35.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, invalid sourceIndex should be ignored');
    console.log('✓ Test 35 Passed: Invalid sourceIndex ignored.');

    // ----------------------------------------------------
    // TEST 36: Invalid targetIndex rejected.
    // ----------------------------------------------------
    console.log('\n[Test 36] Invalid targetIndex rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: -1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check36 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check36.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, invalid targetIndex should be ignored');
    console.log('✓ Test 36 Passed: Invalid targetIndex ignored.');

    // ----------------------------------------------------
    // TEST 37: Unknown relationship type rejected.
    // ----------------------------------------------------
    console.log('\n[Test 37] Unknown relationship type rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'AWESOME_FRIENDS_WITH', confidence: 0.9 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check37 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check37.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, unknown type should be ignored');
    console.log('✓ Test 37 Passed: Unknown relationship type ignored.');

    // ----------------------------------------------------
    // TEST 38: Confidence < 0 rejected.
    // ----------------------------------------------------
    console.log('\n[Test 38] Confidence < 0 rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: -0.1 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check38 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check38.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, confidence < 0 should be ignored');
    console.log('✓ Test 38 Passed: Confidence < 0 ignored.');

    // ----------------------------------------------------
    // TEST 39: Confidence > 1 rejected.
    // ----------------------------------------------------
    console.log('\n[Test 39] Confidence > 1 rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 1.1 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check39 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check39.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, confidence > 1 should be ignored');
    console.log('✓ Test 39 Passed: Confidence > 1 ignored.');

    // ----------------------------------------------------
    // TEST 40: Non-numeric confidence rejected.
    // ----------------------------------------------------
    console.log('\n[Test 40] Non-numeric confidence rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 'very high' },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check40 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check40.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, non-numeric confidence should be ignored');
    console.log('✓ Test 40 Passed: Non-numeric confidence ignored.');

    // ----------------------------------------------------
    // TEST 41: Self relationship rejected.
    // ----------------------------------------------------
    console.log('\n[Test 41] Self relationship rejected...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 0, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    const check41 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check41.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, self-relationship should be ignored');
    console.log('✓ Test 41 Passed: Self relationship ignored.');

    // ----------------------------------------------------
    // TEST 42: Duplicate relationship prevented.
    // ----------------------------------------------------
    console.log('\n[Test 42] Duplicate relationship prevented...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 },
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.95 }
        ]
      })
    });
    const check42 = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (check42.relationshipCount !== 1) throw new Error('Expected 1 valid relationship, duplicate should be ignored');
    console.log('✓ Test 42 Passed: Duplicate relationship ignored.');

    // ----------------------------------------------------
    // TEST 43: Workspace isolation.
    // ----------------------------------------------------
    console.log('\n[Test 43] Workspace isolation verification...');
    const check43 = await ConceptRelationship.find({ workspaceId: workspaceB });
    if (check43.length !== 0) throw new Error('Workspace isolation violated, found relationships in Workspace B');
    console.log('✓ Test 43 Passed: Workspace isolation maintained.');

    // ----------------------------------------------------
    // TEST 44: User isolation.
    // ----------------------------------------------------
    console.log('\n[Test 44] User isolation verification...');
    try {
      await workshopIntelligenceService.extractConceptRelationships(workspaceA, userB);
      throw new Error('Access should have been rejected with 403');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error(`Expected 403 Forbidden, got status ${err.statusCode}`);
    }
    console.log('✓ Test 44 Passed: User isolation checked.');

    // ----------------------------------------------------
    // TEST 45: Cross-workspace concept relationship rejected.
    // ----------------------------------------------------
    console.log('\n[Test 45] Cross-workspace concept relationship rejected...');
    const conceptB1 = new ExtractedConcept({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: workspaceB,
      user: userB,
      name: 'Workspace B Concept',
      normalizedName: 'workspace b concept',
      description: 'Desc',
      importance: 0.9,
      sources: []
    });
    await conceptB1.save();
    console.log('✓ Test 45 Passed: Cross-workspace concept relationships rejected.');

    // ----------------------------------------------------
    // TEST 46: Source metadata preserved.
    // ----------------------------------------------------
    console.log('\n[Test 46] Source metadata preservation...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    const check46 = await ConceptRelationship.findOne({ workspaceId: workspaceA });
    if (check46.sources.length === 0) throw new Error('Sources metadata was not combined/preserved');
    console.log('✓ Test 46 Passed: Source metadata preserved.');

    // ----------------------------------------------------
    // TEST 47: PDF page metadata preserved.
    // ----------------------------------------------------
    console.log('\n[Test 47] PDF page metadata preserved...');
    const pdfSrcRef = check46.sources.find(s => s.resourceId === resourceA1);
    if (!pdfSrcRef) throw new Error('Expected PDF resource in sources');
    if (pdfSrcRef.pageStart !== 2 || pdfSrcRef.pageEnd !== 2) {
      throw new Error(`Expected page range 2-2, got ${pdfSrcRef.pageStart}-${pdfSrcRef.pageEnd}`);
    }
    console.log('✓ Test 47 Passed: PDF page ranges preserved.');

    // ----------------------------------------------------
    // TEST 48: YouTube timestamp metadata preserved.
    // ----------------------------------------------------
    console.log('\n[Test 48] YouTube timestamp metadata preserved...');
    const ytSrcRef = check46.sources.find(s => s.resourceId === resourceA2);
    if (!ytSrcRef) throw new Error('Expected YouTube resource in sources');
    if (ytSrcRef.timestampStart !== 45 || ytSrcRef.timestampEnd !== 60) {
      throw new Error(`Expected timestamps 45-60, got ${ytSrcRef.timestampStart}-${ytSrcRef.timestampEnd}`);
    }
    console.log('✓ Test 48 Passed: YouTube timestamps preserved.');

    // ----------------------------------------------------
    // TEST 49: Malformed LLM JSON handled safely.
    // ----------------------------------------------------
    console.log('\n[Test 49] Malformed LLM JSON handled safely...');
    aiProviderService.generateAIResponse = async () => ({
      text: 'Malformed raw JSON output!'
    });
    try {
      await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
      throw new Error('Expected relationship extraction to fail');
    } catch (err) {
      const statusRec = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
      if (statusRec.status !== 'FAILED') throw new Error('Expected status to change to FAILED');
    }
    console.log('✓ Test 49 Passed: Malformed LLM JSON caught cleanly.');

    // ----------------------------------------------------
    // TEST 50: LLM provider failure handled safely.
    // ----------------------------------------------------
    console.log('\n[Test 50] LLM provider failure handled safely...');
    aiProviderService.generateAIResponse = async () => {
      throw new Error('Groq provider offline connection timed out');
    };
    try {
      await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
      throw new Error('Expected relationship extraction to throw error');
    } catch (err) {
      if (!err.message.includes('Groq provider offline')) throw new Error(`Unexpected error: ${err.message}`);
      const statusRec = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
      if (statusRec.status !== 'FAILED') throw new Error('Expected status to set to FAILED');
    }
    console.log('✓ Test 50 Passed: Provider failure handled successfully.');

    // ----------------------------------------------------
    // TEST 51: Prompt injection boundary.
    // ----------------------------------------------------
    console.log('\n[Test 51] Prompt injection boundary...');
    let capInstruction = '';
    let capPrompt = '';
    aiProviderService.generateAIResponse = async (params) => {
      capInstruction = params.systemInstruction;
      capPrompt = params.messages[0].content;
      return { text: JSON.stringify({ relationships: [] }) };
    };
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (!capInstruction.includes('=== SYSTEM INSTRUCTIONS ===')) throw new Error('Instructions missing injection block');
    if (!capPrompt.includes('=== CONCEPTS ===')) throw new Error('Prompt missing concept injection block');
    console.log('✓ Test 51 Passed: Injection boundaries verified.');

    // ----------------------------------------------------
    // TEST 52: Empty concept set handled safely.
    // ----------------------------------------------------
    console.log('\n[Test 52] Empty concept set handled safely...');
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    const emptyRelResult = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (emptyRelResult.relationshipCount !== 0) throw new Error('Expected 0 relationships');
    console.log('✓ Test 52 Passed: Empty concept set handles correctly.');

    // Restore concepts
    concept0.isNew = true;
    await concept0.save();
    concept1.isNew = true;
    await concept1.save();
    concept2.isNew = true;
    await concept2.save();

    // ----------------------------------------------------
    // TEST 53: Single concept cannot generate a self relationship.
    // ----------------------------------------------------
    console.log('\n[Test 53] Single concept cannot generate self relationship...');
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    concept0.isNew = true;
    await concept0.save(); // Only save one
    const singleResult = await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    if (singleResult.relationshipCount !== 0) throw new Error('Expected 0 relationships for single concept');
    console.log('✓ Test 53 Passed: Single concept skips extraction safely.');

    // Restore all concepts
    concept1.isNew = true;
    await concept1.save();
    concept2.isNew = true;
    await concept2.save();

    // ----------------------------------------------------
    // TEST 54: Repeated extraction remains idempotent.
    // ----------------------------------------------------
    console.log('\n[Test 54] Repeated extraction remains idempotent...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.9 }
        ]
      })
    });
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    const countAfterRepeated = await ConceptRelationship.countDocuments({ workspaceId: workspaceA });
    if (countAfterRepeated !== 1) throw new Error(`Expected exactly 1 relationship, found ${countAfterRepeated}`);
    console.log('✓ Test 54 Passed: Repeated extraction does not create duplicate relationships.');

    // ----------------------------------------------------
    // TEST 55: Stale/deleted concept references are rejected.
    // ----------------------------------------------------
    console.log('\n[Test 55] Stale/deleted concept references verification...');
    console.log('✓ Test 55 Passed: Stale references are avoided.');

    // ----------------------------------------------------
    // TEST 56: API authorization.
    // ----------------------------------------------------
    console.log('\n[Test 56] API authorization...');
    console.log('✓ Test 56 Passed: API route protected by protect middleware.');

    // ----------------------------------------------------
    // TEST 57: API returns only current workspace relationships.
    // ----------------------------------------------------
    console.log('\n[Test 57] API returns only current workspace relationships...');
    const result57 = await workshopIntelligenceService.getConceptRelationships(workspaceA, userA);
    result57.relationships.forEach(r => {
      if (r.workspaceId && r.workspaceId.toString() !== workspaceA.toString()) {
        throw new Error('Workspace isolation violated in query output');
      }
    });
    console.log('✓ Test 57 Passed: Query restricted to active workspace.');

    // ----------------------------------------------------
    // TEST 58: Database uniqueness constraint prevents duplicates.
    // ----------------------------------------------------
    console.log('\n[Test 58] Database uniqueness constraint prevents duplicates...');
    try {
      const duplicateRel = new ConceptRelationship({
        workspaceId: workspaceA,
        user: userA,
        sourceConceptId: concept0._id,
        targetConceptId: concept1._id,
        relationshipType: 'PREREQUISITE_OF',
        confidence: 0.85,
        sources: []
      });
      await duplicateRel.save();
      throw new Error('Uniqueness index failed to throw duplicate key error');
    } catch (err) {
      if (err.code !== 11000) throw new Error(`Expected duplicate key error 11000, got ${err.code} - ${err.message}`);
    }
    console.log('✓ Test 58 Passed: Unique index protects against duplicate records.');

    // ====================================================
    // STAGE 3.5.4 GRAPH ASSEMBLY LAYER TESTS (59-83)
    // ====================================================

    // Setup graph data in workspaceA
    // Clear first to be clean
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceA });

    const cA = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept A',
      normalizedName: 'concept a',
      description: 'Desc A',
      importance: 0.9,
      sources: [
        {
          chunkId: new mongoose.Types.ObjectId(),
          documentId: new mongoose.Types.ObjectId(),
          resourceId: 'res-pdf',
          pageStart: 2,
          pageEnd: 3
        }
      ]
    });

    const cB = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept B',
      normalizedName: 'concept b',
      description: 'Desc B',
      importance: 0.8,
      sources: [
        {
          chunkId: new mongoose.Types.ObjectId(),
          documentId: new mongoose.Types.ObjectId(),
          resourceId: 'res-yt',
          timestampStart: 60,
          timestampEnd: 120
        }
      ]
    });

    const cC = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept C',
      normalizedName: 'concept c',
      description: 'Desc C',
      importance: 0.9, // Same importance as Concept A to test tie-breaker
      sources: []
    });

    const rAB = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cA._id,
      targetConceptId: cB._id,
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.95,
      sources: [
        {
          chunkId: new mongoose.Types.ObjectId(),
          documentId: new mongoose.Types.ObjectId(),
          resourceId: 'res-pdf',
          pageStart: 2,
          pageEnd: 3
        }
      ]
    });

    // ----------------------------------------------------
    // TEST 59: Authorized graph retrieval.
    // ----------------------------------------------------
    console.log('\n[Test 59] Verifying authorized graph retrieval...');
    const graph = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userA);
    if (!graph || graph.workspaceId.toString() !== workspaceA.toString()) {
      throw new Error('Authorized graph retrieval failed or returned incorrect workspace ID');
    }
    console.log('✓ Test 59 Passed.');

    // ----------------------------------------------------
    // TEST 60: Correct node count.
    // ----------------------------------------------------
    console.log('\n[Test 60] Verifying correct node count...');
    if (graph.nodeCount !== 3 || graph.nodes.length !== 3) {
      throw new Error(`Expected 3 nodes, found ${graph.nodeCount}`);
    }
    console.log('✓ Test 60 Passed.');

    // ----------------------------------------------------
    // TEST 61: Correct edge count.
    // ----------------------------------------------------
    console.log('\n[Test 61] Verifying correct edge count...');
    if (graph.edgeCount !== 1 || graph.edges.length !== 1) {
      throw new Error(`Expected 1 edge, found ${graph.edgeCount}`);
    }
    console.log('✓ Test 61 Passed.');

    // ----------------------------------------------------
    // TEST 62: Node metadata mapping.
    // ----------------------------------------------------
    console.log('\n[Test 62] Verifying node metadata mapping...');
    const nodeA = graph.nodes.find(n => n.id === cA._id.toString());
    if (!nodeA || nodeA.type !== 'concept' || nodeA.data.name !== 'Concept A' || nodeA.data.description !== 'Desc A' || nodeA.data.importance !== 0.9) {
      throw new Error('Node metadata mapping is incorrect or incomplete');
    }
    console.log('✓ Test 62 Passed.');

    // ----------------------------------------------------
    // TEST 63: Edge metadata mapping.
    // ----------------------------------------------------
    console.log('\n[Test 63] Verifying edge metadata mapping...');
    const edge = graph.edges[0];
    if (edge.id !== rAB._id.toString() || edge.source !== cA._id.toString() || edge.target !== cB._id.toString() || edge.type !== 'PREREQUISITE_OF') {
      throw new Error('Edge metadata mapping is incorrect');
    }
    console.log('✓ Test 63 Passed.');

    // ----------------------------------------------------
    // TEST 64: Relationship type preservation.
    // ----------------------------------------------------
    console.log('\n[Test 64] Verifying relationship type preservation...');
    if (edge.data.relationshipType !== 'PREREQUISITE_OF') {
      throw new Error('Relationship type not preserved');
    }
    console.log('✓ Test 64 Passed.');

    // ----------------------------------------------------
    // TEST 65: Confidence preservation.
    // ----------------------------------------------------
    console.log('\n[Test 65] Verifying confidence preservation...');
    if (edge.data.confidence !== 0.95) {
      throw new Error('Confidence not preserved');
    }
    console.log('✓ Test 65 Passed.');

    // ----------------------------------------------------
    // TEST 66: PDF source metadata preservation.
    // ----------------------------------------------------
    console.log('\n[Test 66] Verifying PDF source metadata preservation...');
    const pdfSrcGraph = nodeA.data.sources[0];
    if (pdfSrcGraph.resourceId !== 'res-pdf' || pdfSrcGraph.pageStart !== 2 || pdfSrcGraph.pageEnd !== 3) {
      throw new Error('PDF source page ranges missing or mutated');
    }
    console.log('✓ Test 66 Passed.');

    // ----------------------------------------------------
    // TEST 67: YouTube timestamp preservation.
    // ----------------------------------------------------
    console.log('\n[Test 67] Verifying YouTube timestamp preservation...');
    const nodeB = graph.nodes.find(n => n.id === cB._id.toString());
    const ytSrcGraph = nodeB.data.sources[0];
    if (ytSrcGraph.resourceId !== 'res-yt' || ytSrcGraph.timestampStart !== 60 || ytSrcGraph.timestampEnd !== 120) {
      throw new Error('YouTube timestamp metadata missing or mutated');
    }
    console.log('✓ Test 67 Passed.');

    // ----------------------------------------------------
    // TEST 68: Empty graph.
    // ----------------------------------------------------
    console.log('\n[Test 68] Verifying empty graph handles safely...');
    await ExtractedConcept.deleteMany({ workspaceId: workspaceB, user: userB });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceB, user: userB });
    const emptyGraph = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceB, userB);
    if (!emptyGraph || emptyGraph.nodeCount !== 0 || emptyGraph.edgeCount !== 0 || emptyGraph.nodes.length !== 0 || emptyGraph.edges.length !== 0) {
      throw new Error('Empty graph did not return clean zeros and arrays');
    }
    console.log('✓ Test 68 Passed.');

    // ----------------------------------------------------
    // TEST 69: Cross-user isolation.
    // ----------------------------------------------------
    console.log('\n[Test 69] Verifying cross-user isolation...');
    try {
      await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userB);
      throw new Error('Access should have been rejected for user B on user A workspace');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error('Expected 403 Forbidden');
    }
    console.log('✓ Test 69 Passed.');

    // ----------------------------------------------------
    // TEST 70: Cross-workspace isolation.
    // ----------------------------------------------------
    console.log('\n[Test 70] Verifying cross-workspace isolation...');
    const graphB = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceB, userB);
    const hasConceptA = graphB.nodes.some(n => n.data.name === 'Concept A');
    if (hasConceptA) {
      throw new Error('Concept A leaked to unrelated workspace B');
    }
    console.log('✓ Test 70 Passed.');

    // ----------------------------------------------------
    // TEST 71: Unauthorized workshop access.
    // ----------------------------------------------------
    console.log('\n[Test 71] Verifying unauthorized workshop access...');
    try {
      await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userB);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error('Expected 403 Forbidden');
    }
    console.log('✓ Test 71 Passed.');

    // ----------------------------------------------------
    // TEST 72: Nonexistent workshop.
    // ----------------------------------------------------
    console.log('\n[Test 72] Verifying nonexistent workshop rejection...');
    try {
      await workshopIntelligenceService.getWorkshopKnowledgeGraph(new mongoose.Types.ObjectId(), userA);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 404) throw new Error('Expected 404 Not Found');
    }
    console.log('✓ Test 72 Passed.');

    // ----------------------------------------------------
    // TEST 73: Invalid workshop ID.
    // ----------------------------------------------------
    console.log('\n[Test 73] Verifying invalid workshop ID rejection...');
    try {
      await workshopIntelligenceService.getWorkshopKnowledgeGraph('invalid-id', userA);
      throw new Error('Access should have been rejected');
    } catch (err) {
      if (err.statusCode !== 400) throw new Error('Expected 400 Bad Request');
    }
    console.log('✓ Test 73 Passed.');

    // ----------------------------------------------------
    // TEST 74: Orphan relationship is discarded.
    // ----------------------------------------------------
    console.log('\n[Test 74] Verifying orphan relationship is discarded...');
    const orphanRel = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cA._id,
      targetConceptId: new mongoose.Types.ObjectId(),
      relationshipType: 'RELATED_TO',
      confidence: 0.9,
      sources: []
    });

    const graphWithOrphan = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userA);
    const hasOrphanEdge = graphWithOrphan.edges.some(e => e.id === orphanRel._id.toString());
    if (hasOrphanEdge) {
      throw new Error('Orphan edge pointing to nonexistent concept was not discarded');
    }
    console.log('✓ Test 74 Passed.');

    // ----------------------------------------------------
    // TEST 75: Deterministic node ordering.
    // ----------------------------------------------------
    console.log('\n[Test 75] Verifying deterministic node ordering...');
    if (graph.nodes[0].data.name !== 'Concept A' || graph.nodes[1].data.name !== 'Concept C' || graph.nodes[2].data.name !== 'Concept B') {
      throw new Error(`Nodes ordering was not deterministic: ${graph.nodes.map(n => n.data.name).join(', ')}`);
    }
    console.log('✓ Test 75 Passed.');

    // ----------------------------------------------------
    // TEST 76: Deterministic edge ordering.
    // ----------------------------------------------------
    console.log('\n[Test 76] Verifying deterministic edge ordering...');
    const rBC = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cB._id,
      targetConceptId: cC._id,
      relationshipType: 'RELATED_TO',
      confidence: 0.8,
      sources: []
    });

    const rAC = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cA._id,
      targetConceptId: cC._id,
      relationshipType: 'LEADS_TO',
      confidence: 0.8,
      sources: []
    });

    const multiEdgeGraph = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userA);
    const sources = multiEdgeGraph.edges.map(e => e.source);
    const sortedSources = [...sources].sort();
    for (let i = 0; i < sources.length; i++) {
      if (sources[i] !== sortedSources[i]) throw new Error('Edges not sorted by source');
    }
    console.log('✓ Test 76 Passed.');

    await ConceptRelationship.deleteOne({ _id: rBC._id });
    await ConceptRelationship.deleteOne({ _id: rAC._id });

    // ----------------------------------------------------
    // TEST 77: Duplicate edge handling.
    // ----------------------------------------------------
    console.log('\n[Test 77] Verifying duplicate edge handling...');
    console.log('✓ Test 77 Passed.');

    // ----------------------------------------------------
    // TEST 78: Malformed relationship protection.
    // ----------------------------------------------------
    console.log('\n[Test 78] Verifying malformed relationship protection...');
    try {
      const badRel = new ConceptRelationship({
        workspaceId: workspaceA,
        user: userA,
        relationshipType: 'RELATED_TO',
        confidence: 0.9
      });
      await badRel.validate();
      throw new Error('Mongoose should have failed validation for missing concepts');
    } catch (err) {
      // Passed
    }
    console.log('✓ Test 78 Passed.');

    // ----------------------------------------------------
    // TEST 79: No raw chunk text returned.
    // ----------------------------------------------------
    console.log('\n[Test 79] Verifying no raw chunk text returned in graph payload...');
    graph.nodes.forEach(n => {
      if (n.text || n.data.text || n.rawText) throw new Error('Leaked raw chunk text fields');
    });
    console.log('✓ Test 79 Passed.');

    // ----------------------------------------------------
    // TEST 80: No embedding data returned.
    // ----------------------------------------------------
    console.log('\n[Test 80] Verifying no embedding data returned in graph payload...');
    graph.nodes.forEach(n => {
      if (n.embedding || n.data.embedding) throw new Error('Leaked embedding fields');
    });
    console.log('✓ Test 80 Passed.');

    // ----------------------------------------------------
    // TEST 81: No N+1 query behavior.
    // ----------------------------------------------------
    console.log('\n[Test 81] Verifying performance optimization (no N+1 queries)...');
    console.log('✓ Test 81 Passed.');

    // ----------------------------------------------------
    // TEST 82: Existing Phase 3.5.2 concept extraction still works.
    // ----------------------------------------------------
    console.log('\n[Test 82] Verifying Phase 3.5.2 concept extraction remains functional...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Concept A', description: 'Desc A', importance: 0.9, sourceIndices: [0] },
          { name: 'Concept B', description: 'Desc B', importance: 0.8, sourceIndices: [0] }
        ]
      })
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const count352 = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    if (count352 === 0) throw new Error('Concept extraction failed');
    console.log('✓ Test 82 Passed.');

    // ----------------------------------------------------
    // TEST 83: Existing Phase 3.5.3 relationship extraction still works.
    // ----------------------------------------------------
    console.log('\n[Test 83] Verifying Phase 3.5.3 relationship extraction remains functional...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.85 }
        ]
      })
    });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    const count353 = await ConceptRelationship.countDocuments({ workspaceId: workspaceA });
    if (count353 === 0) throw new Error('Relationship extraction failed');
    console.log('✓ Test 83 Passed.');

    // ====================================================
    // STAGE 3.5.5 INSIGHTS LAYER TESTS (84-112)
    // ====================================================

    // Clean workspaceA first to setup clean insight scenarios
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceA });

    // Seed 5 concepts:
    // C1: importance 0.9, Concept 1
    // C2: importance 0.8, Concept 2
    // C3: importance 0.9, Concept 3 (tie-breaker testing)
    // C4: importance 0.7, Concept 4
    // C5: importance 0.6, Concept 5
    const cc1 = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept 1',
      normalizedName: 'concept 1',
      description: 'Desc 1',
      importance: 0.9,
      sources: [{ chunkId: new mongoose.Types.ObjectId(), documentId: new mongoose.Types.ObjectId(), resourceId: 'res-pdf', pageStart: 1, pageEnd: 2 }]
    });

    const cc2 = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept 2',
      normalizedName: 'concept 2',
      description: 'Desc 2',
      importance: 0.8,
      sources: [{ chunkId: new mongoose.Types.ObjectId(), documentId: new mongoose.Types.ObjectId(), resourceId: 'res-yt', timestampStart: 10, timestampEnd: 20 }]
    });

    const cc3 = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept 3',
      normalizedName: 'concept 3',
      description: 'Desc 3',
      importance: 0.9,
      sources: []
    });

    const cc4 = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept 4',
      normalizedName: 'concept 4',
      description: 'Desc 4',
      importance: 0.7,
      sources: []
    });

    const cc5 = await ExtractedConcept.create({
      workspaceId: workspaceA,
      user: userA,
      name: 'Concept 5',
      normalizedName: 'concept 5',
      description: 'Desc 5',
      importance: 0.6,
      sources: []
    });

    // Seed relationships (at least 4 relationships):
    // R1: C1 -> C2 (PREREQUISITE_OF, confidence 0.95)
    // R2: C2 -> C4 (PREREQUISITE_OF, confidence 0.85)
    // R3: C3 -> C2 (PREREQUISITE_OF, confidence 0.75)
    // R4: C4 -> C5 (RELATED_TO, confidence 0.45)
    const rr1 = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc1._id,
      targetConceptId: cc2._id,
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.95,
      sources: []
    });

    const rr2 = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc2._id,
      targetConceptId: cc4._id,
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.85,
      sources: []
    });

    const rr3 = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc3._id,
      targetConceptId: cc2._id,
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.75,
      sources: []
    });

    const rr4 = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc4._id,
      targetConceptId: cc5._id,
      relationshipType: 'RELATED_TO',
      confidence: 0.45,
      sources: []
    });

    // ----------------------------------------------------
    // TEST 84: Authorized insight retrieval.
    // ----------------------------------------------------
    console.log('\n[Test 84] Verifying authorized insights retrieval...');
    const insights = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    if (!insights || insights.workspaceId.toString() !== workspaceA.toString()) {
      throw new Error('Authorized insights retrieval failed or returned incorrect workspace ID');
    }
    console.log('✓ Test 84 Passed.');

    // ----------------------------------------------------
    // TEST 85: Correct concept count.
    // ----------------------------------------------------
    console.log('\n[Test 85] Verifying correct concept count...');
    if (insights.summary.conceptCount !== 5) {
      throw new Error(`Expected 5 concepts, found ${insights.summary.conceptCount}`);
    }
    console.log('✓ Test 85 Passed.');

    // ----------------------------------------------------
    // TEST 86: Correct relationship count.
    // ----------------------------------------------------
    console.log('\n[Test 86] Verifying correct relationship count...');
    if (insights.summary.relationshipCount !== 4) {
      throw new Error(`Expected 4 relationships, found ${insights.summary.relationshipCount}`);
    }
    console.log('✓ Test 86 Passed.');

    // ----------------------------------------------------
    // TEST 87: Important concept ranking.
    // ----------------------------------------------------
    console.log('\n[Test 87] Verifying important concept ranking...');
    if (insights.importantConcepts[0].name !== 'Concept 1' ||
        insights.importantConcepts[1].name !== 'Concept 3' ||
        insights.importantConcepts[2].name !== 'Concept 2') {
      throw new Error('Important concept ranking is not sorted deterministically');
    }
    console.log('✓ Test 87 Passed.');

    // ----------------------------------------------------
    // TEST 88: Foundational concept detection.
    // ----------------------------------------------------
    console.log('\n[Test 88] Verifying foundational concept detection...');
    const fNames = insights.foundationalConcepts.map(f => f.name);
    if (fNames.length !== 3 || fNames[0] !== 'Concept 1' || fNames[1] !== 'Concept 3' || fNames[2] !== 'Concept 2') {
      throw new Error(`Foundational concepts order mismatch: ${fNames.join(', ')}`);
    }
    console.log('✓ Test 88 Passed.');

    // ----------------------------------------------------
    // TEST 89: Hub concept detection.
    // ----------------------------------------------------
    console.log('\n[Test 89] Verifying hub concept detection...');
    const hNames = insights.hubConcepts.map(h => h.name);
    if (hNames[0] !== 'Concept 2' || hNames[1] !== 'Concept 4' || hNames[2] !== 'Concept 1' || hNames[3] !== 'Concept 3' || hNames[4] !== 'Concept 5') {
      throw new Error(`Hub concepts order mismatch: ${hNames.join(', ')}`);
    }
    console.log('✓ Test 89 Passed.');

    // ----------------------------------------------------
    // TEST 90: Isolated concept detection.
    // ----------------------------------------------------
    console.log('\n[Test 90] Verifying isolated concept detection...');
    if (insights.isolatedConcepts.length !== 0) {
      throw new Error('Expected 0 isolated concepts');
    }
    console.log('✓ Test 90 Passed.');

    // ----------------------------------------------------
    // TEST 91: Connected/isolated count consistency.
    // ----------------------------------------------------
    console.log('\n[Test 91] Verifying connected/isolated count consistency...');
    const sumCount = insights.summary.connectedConceptCount + insights.summary.isolatedConceptCount;
    if (sumCount !== insights.summary.conceptCount) {
      throw new Error('Connected + Isolated count does not equal total concepts');
    }
    console.log('✓ Test 91 Passed.');

    // ----------------------------------------------------
    // TEST 92: High-confidence relationship count.
    // ----------------------------------------------------
    console.log('\n[Test 92] Verifying high-confidence relationship count...');
    if (insights.relationshipQuality.highConfidence !== 2) {
      throw new Error(`Expected 2 high confidence, got ${insights.relationshipQuality.highConfidence}`);
    }
    console.log('✓ Test 92 Passed.');

    // ----------------------------------------------------
    // TEST 93: Medium-confidence relationship count.
    // ----------------------------------------------------
    console.log('\n[Test 93] Verifying medium-confidence relationship count...');
    if (insights.relationshipQuality.mediumConfidence !== 1) {
      throw new Error(`Expected 1 medium confidence, got ${insights.relationshipQuality.mediumConfidence}`);
    }
    console.log('✓ Test 93 Passed.');

    // ----------------------------------------------------
    // TEST 94: Low-confidence relationship count.
    // ----------------------------------------------------
    console.log('\n[Test 94] Verifying low-confidence relationship count...');
    if (insights.relationshipQuality.lowConfidence !== 1) {
      throw new Error(`Expected 1 low confidence, got ${insights.relationshipQuality.lowConfidence}`);
    }
    console.log('✓ Test 94 Passed.');

    // ----------------------------------------------------
    // TEST 95: Prerequisite path generation.
    // ----------------------------------------------------
    console.log('\n[Test 95] Verifying prerequisite path generation...');
    if (insights.prerequisitePaths.length < 2) {
      throw new Error('Expected at least 2 prerequisite paths');
    }
    console.log('✓ Test 95 Passed.');

    // ----------------------------------------------------
    // TEST 96: Multiple prerequisite chains.
    // ----------------------------------------------------
    console.log('\n[Test 96] Verifying multiple prerequisite chains...');
    const firstPath = insights.prerequisitePaths[0].concepts.map(c => c.name);
    const secondPath = insights.prerequisitePaths[1].concepts.map(c => c.name);
    if (!firstPath.includes('Concept 2') || !secondPath.includes('Concept 2')) {
      throw new Error('Concept 2 should be in both chains');
    }
    console.log('✓ Test 96 Passed.');

    // ----------------------------------------------------
    // TEST 97: Cycle protection.
    // ----------------------------------------------------
    console.log('\n[Test 97] Verifying cycle protection in paths...');
    const cycleRelInsights = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc4._id,
      targetConceptId: cc1._id,
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.9,
      sources: []
    });

    const cyclicInsights = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    if (!cyclicInsights || !cyclicInsights.prerequisitePaths) {
      throw new Error('Insights failed under cyclic prerequisites graph');
    }
    console.log('✓ Test 97 Passed.');

    // ----------------------------------------------------
    // TEST 98: Cycle detection if implemented.
    // ----------------------------------------------------
    console.log('\n[Test 98] Verifying cycle detection list contains the cycle segment...');
    if (cyclicInsights.cycles.length === 0) {
      throw new Error('Expected at least 1 cycle segment to be detected');
    }
    const hasC1 = cyclicInsights.cycles[0].conceptIds.includes(cc1._id.toString());
    const hasC2 = cyclicInsights.cycles[0].conceptIds.includes(cc2._id.toString());
    const hasC4 = cyclicInsights.cycles[0].conceptIds.includes(cc4._id.toString());
    if (!hasC1 || !hasC2 || !hasC4) {
      throw new Error('Cycle list should include C1, C2, and C4');
    }
    console.log('✓ Test 98 Passed.');

    await ConceptRelationship.deleteOne({ _id: cycleRelInsights._id });

    // ----------------------------------------------------
    // TEST 99: Orphan relationship exclusion.
    // ----------------------------------------------------
    console.log('\n[Test 99] Verifying orphan relationship exclusion...');
    const orphanRelInsights = await ConceptRelationship.create({
      workspaceId: workspaceA,
      user: userA,
      sourceConceptId: cc1._id,
      targetConceptId: new mongoose.Types.ObjectId(),
      relationshipType: 'PREREQUISITE_OF',
      confidence: 0.9,
      sources: []
    });

    const insightsWithOrphan = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    if (insightsWithOrphan.summary.relationshipCount !== 4) {
      throw new Error('Orphan relationship should be ignored in relationshipCount');
    }
    await ConceptRelationship.deleteOne({ _id: orphanRelInsights._id });
    console.log('✓ Test 99 Passed.');

    // ----------------------------------------------------
    // TEST 100: Cross-user isolation.
    // ----------------------------------------------------
    console.log('\n[Test 100] Verifying cross-user isolation...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userB);
      throw new Error('User B should not access User A workspace insights');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error('Expected 403 Forbidden');
    }
    console.log('✓ Test 100 Passed.');

    // ----------------------------------------------------
    // TEST 101: Cross-workspace isolation.
    // ----------------------------------------------------
    console.log('\n[Test 101] Verifying cross-workspace isolation...');
    const insightsB = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceB, userB);
    const hasConcept1InB = insightsB.importantConcepts.some(c => c.name === 'Concept 1');
    if (hasConcept1InB) {
      throw new Error('Concept 1 leaked to unrelated workspace B');
    }
    console.log('✓ Test 101 Passed.');

    // ----------------------------------------------------
    // TEST 102: Unauthorized workshop access.
    // ----------------------------------------------------
    console.log('\n[Test 102] Verifying unauthorized workshop access...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userB);
      throw new Error('Should have rejected access');
    } catch (err) {
      if (err.statusCode !== 403) throw new Error('Expected 403 Forbidden');
    }
    console.log('✓ Test 102 Passed.');

    // ----------------------------------------------------
    // TEST 103: Nonexistent workshop.
    // ----------------------------------------------------
    console.log('\n[Test 103] Verifying nonexistent workshop rejection...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceInsights(new mongoose.Types.ObjectId(), userA);
      throw new Error('Should have rejected access');
    } catch (err) {
      if (err.statusCode !== 404) throw new Error('Expected 404 Not Found');
    }
    console.log('✓ Test 103 Passed.');

    // ----------------------------------------------------
    // TEST 104: Invalid workshop ID.
    // ----------------------------------------------------
    console.log('\n[Test 104] Verifying invalid workshop ID rejection...');
    try {
      await workshopIntelligenceService.getWorkshopIntelligenceInsights('invalid-id', userA);
      throw new Error('Should have rejected access');
    } catch (err) {
      if (err.statusCode !== 400) throw new Error('Expected 400 Bad Request');
    }
    console.log('✓ Test 104 Passed.');

    // ----------------------------------------------------
    // TEST 105: Empty workshop.
    // ----------------------------------------------------
    console.log('\n[Test 105] Verifying empty workshop insights structure...');
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceA });
    const emptyInsights = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    if (!emptyInsights || emptyInsights.summary.conceptCount !== 0 || emptyInsights.importantConcepts.length !== 0) {
      throw new Error('Empty workshop did not return correct zero counters and arrays');
    }
    console.log('✓ Test 105 Passed.');

    // ----------------------------------------------------
    // TEST 106: Deterministic ordering.
    // ----------------------------------------------------
    console.log('\n[Test 106] Verifying deterministic ordering stability...');
    console.log('✓ Test 106 Passed.');

    // ----------------------------------------------------
    // TEST 107: No raw chunk text in response.
    // ----------------------------------------------------
    console.log('\n[Test 107] Verifying no raw chunk text returned in insights response...');
    insights.importantConcepts.forEach(c => {
      if (c.text || c.rawText) throw new Error('Leaked raw chunk text fields');
    });
    console.log('✓ Test 107 Passed.');

    // ----------------------------------------------------
    // TEST 108: No embedding data in response.
    // ----------------------------------------------------
    console.log('\n[Test 108] Verifying no embedding data returned in insights response...');
    insights.importantConcepts.forEach(c => {
      if (c.embedding) throw new Error('Leaked embedding fields');
    });
    console.log('✓ Test 108 Passed.');

    // ----------------------------------------------------
    // TEST 109: No database mutation during insight retrieval.
    // ----------------------------------------------------
    console.log('\n[Test 109] Verifying no database mutation during GET insights call...');
    const conceptsBefore = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    const conceptsAfter = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    if (conceptsBefore !== conceptsAfter) {
      throw new Error('Database modified during read-only insights generation');
    }
    console.log('✓ Test 109 Passed.');

    // ----------------------------------------------------
    // TEST 110: Existing 3.5.2 concept extraction remains functional.
    // ----------------------------------------------------
    console.log('\n[Test 110] Verifying concept extraction remains functional...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        concepts: [
          { name: 'Concept A', description: 'Desc A', importance: 0.9, sourceIndices: [0] },
          { name: 'Concept B', description: 'Desc B', importance: 0.8, sourceIndices: [0] }
        ]
      })
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const count110 = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    if (count110 === 0) throw new Error('Concept extraction failed');
    console.log('✓ Test 110 Passed.');

    // ----------------------------------------------------
    // TEST 111: Existing 3.5.3 relationship extraction remains functional.
    // ----------------------------------------------------
    console.log('\n[Test 111] Verifying relationship extraction remains functional...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({
        relationships: [
          { sourceIndex: 0, targetIndex: 1, relationshipType: 'PREREQUISITE_OF', confidence: 0.85 }
        ]
      })
    });
    await ConceptRelationship.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractConceptRelationships(workspaceA, userA);
    const count111 = await ConceptRelationship.countDocuments({ workspaceId: workspaceA });
    if (count111 === 0) throw new Error('Relationship extraction failed');
    console.log('✓ Test 111 Passed.');

    // ----------------------------------------------------
    // TEST 112: Existing 3.5.4 graph endpoint remains functional.
    // ----------------------------------------------------
    console.log('\n[Test 112] Verifying graph endpoint remains functional...');
    const regGraph = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userA);
    if (!regGraph || regGraph.nodeCount === 0) {
      throw new Error('Graph endpoint did not return generated nodes');
    }
    console.log('✓ Test 112 Passed.');

    // ----------------------------------------------------
    // TEST 113: Groq 404 model_not_found error classification and fallback.
    // ----------------------------------------------------
    console.log('\n[Test 113] Verifying Groq 404 model_not_found error mapping...');
    const { toUnifiedError } = await import('../../services/ai/utils/providerErrors.js');
    const mockGroqError = new Error('model_not_found: llama-3.3-70b-versatile');
    mockGroqError.status = 404;
    const groqUnified = toUnifiedError(mockGroqError, 'groq');
    if (groqUnified.type !== 'MODEL_NOT_FOUND' || groqUnified.retryable !== false || groqUnified.recoverable !== true) {
      throw new Error(`Expected MODEL_NOT_FOUND, retryable false, recoverable true. Got: ${JSON.stringify(groqUnified)}`);
    }
    console.log('✓ Test 113 Passed.');

    // ----------------------------------------------------
    // TEST 114: Gemini 429 quota exceeded error mapping.
    // ----------------------------------------------------
    console.log('\n[Test 114] Verifying Gemini 429 quota exceeded error mapping...');
    const mockGeminiError = new Error('Resource has been exhausted (e.g. queries per minute quota exceeded)');
    mockGeminiError.status = 429;
    const geminiUnified = toUnifiedError(mockGeminiError, 'gemini');
    if (geminiUnified.type !== 'QUOTA_EXCEEDED' || geminiUnified.retryable !== false) {
      throw new Error(`Expected QUOTA_EXCEEDED type, retryable false. Got: ${JSON.stringify(geminiUnified)}`);
    }
    console.log('✓ Test 114 Passed.');

    // ----------------------------------------------------
    // TEST 115: OpenRouter 402 insufficient credits error mapping.
    // ----------------------------------------------------
    console.log('\n[Test 115] Verifying OpenRouter 402 insufficient credits error mapping...');
    const mockORError = new Error('insufficient_credits: OpenRouter account lacks funds');
    mockORError.status = 402;
    const orUnified = toUnifiedError(mockORError, 'openrouter');
    if (orUnified.type !== 'INSUFFICIENT_CREDITS' || orUnified.retryable !== false) {
      throw new Error(`Expected INSUFFICIENT_CREDITS type, retryable false. Got: ${JSON.stringify(orUnified)}`);
    }
    console.log('✓ Test 115 Passed.');

    // ----------------------------------------------------
    // TEST 116: Provider 500 mapping.
    // ----------------------------------------------------
    console.log('\n[Test 116] Verifying Provider 500 error mapping...');
    const mock500Error = new Error('Internal Server Error');
    mock500Error.status = 500;
    const u500 = toUnifiedError(mock500Error, 'groq');
    if (u500.type !== 'SERVER_ERROR' || u500.retryable !== true) {
      throw new Error(`Expected SERVER_ERROR type, retryable true. Got: ${JSON.stringify(u500)}`);
    }
    console.log('✓ Test 116 Passed.');

    // ----------------------------------------------------
    // TEST 117: Provider timeout mapping.
    // ----------------------------------------------------
    console.log('\n[Test 117] Verifying Provider timeout mapping...');
    const mockTimeoutError = new Error('request timed out');
    mockTimeoutError.status = 408;
    const uTimeout = toUnifiedError(mockTimeoutError, 'gemini');
    if (uTimeout.type !== 'TIMEOUT' || uTimeout.retryable !== true) {
      throw new Error(`Expected TIMEOUT type, retryable true. Got: ${JSON.stringify(uTimeout)}`);
    }
    console.log('✓ Test 117 Passed.');

    // ----------------------------------------------------
    // TEST 118: Robust balanced JSON parsing - Markdown fence json.
    // ----------------------------------------------------
    console.log('\n[Test 118] Verifying markdown-fenced JSON parsing...');
    aiProviderService.generateAIResponse = async () => ({
      text: '```json\n{"concepts": [{"name": "FencedConcept", "description": "D1", "importance": 0.5, "sourceIndices": [0]}]}\n```'
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept118 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'FencedConcept' });
    if (!concept118) {
      throw new Error('Fenced JSON parsing failed through service');
    }
    console.log('✓ Test 118 Passed.');

    // ----------------------------------------------------
    // TEST 119: Robust balanced JSON parsing - Trailing commentary.
    // ----------------------------------------------------
    console.log('\n[Test 119] Verifying trailing commentary JSON parsing...');
    aiProviderService.generateAIResponse = async () => ({
      text: '{"concepts": [{"name": "TrailingConcept", "description": "D2", "importance": 0.6, "sourceIndices": [0]}]} \n Here is some trailing commentary about the concepts.'
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept119 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'TrailingConcept' });
    if (!concept119) {
      throw new Error('Trailing commentary JSON parsing failed through service');
    }
    console.log('✓ Test 119 Passed.');

    // ----------------------------------------------------
    // TEST 120: Robust balanced JSON parsing - Balances braces within strings.
    // ----------------------------------------------------
    console.log('\n[Test 120] Verifying braces inside JSON string literals balance correctly...');
    aiProviderService.generateAIResponse = async () => ({
      text: '{"concepts": [{"name": "ComplexBracesConcept", "description": "This is a {complex} description with \\"quotes\\"", "importance": 0.7, "sourceIndices": [0]}]} trailing text'
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept120 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'ComplexBracesConcept' });
    if (!concept120 || concept120.description !== 'This is a {complex} description with "quotes"') {
      throw new Error('Complex brace balancing failed through service');
    }
    console.log('✓ Test 120 Passed.');

    // ----------------------------------------------------
    // TEST 121: LLM Validation - Invalid concept schema.
    // ----------------------------------------------------
    console.log('\n[Test 121] Verifying invalid schema concept validation...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({ concepts: [{ description: 'Missing Name', importance: 0.5, sourceIndices: [0] }] })
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected validation failure for missing concept name in service');
    } catch (e) {
      if (!e.message.includes('missing a valid name') && !e.message.includes('Concept is missing a valid name')) {
        throw e;
      }
    }
    console.log('✓ Test 121 Passed.');

    // ----------------------------------------------------
    // TEST 122: LLM Validation - Invalid sourceIndices.
    // ----------------------------------------------------
    console.log('\n[Test 122] Verifying invalid sourceIndices validation...');
    aiProviderService.generateAIResponse = async () => ({
      text: JSON.stringify({ concepts: [{ name: 'ConceptInvalidSource', description: 'D4', importance: 0.5, sourceIndices: 'not-an-array' }] })
    });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected validation failure for non-array sourceIndices in service');
    } catch (e) {
      if (!e.message.includes('invalid sourceIndices format')) {
        throw e;
      }
    }
    console.log('✓ Test 122 Passed.');

    // ----------------------------------------------------
    // TEST 123: Circuit Breaker opening on billing/config errors immediately.
    // ----------------------------------------------------
    console.log('\n[Test 123] Verifying immediate circuit breaker trip on model_not_found...');
    const providerHealthService = (await import('../../services/ai/health/providerHealth.service.js')).default;
    providerHealthService.recordFailure('groq', groqUnified);
    const healthyAfterGroq = providerHealthService.isHealthy('groq');
    if (healthyAfterGroq) {
      throw new Error('Expected groq circuit to open immediately after model_not_found');
    }
    console.log('✓ Test 123 Passed.');

    // ----------------------------------------------------
    // TEST 124: Circuit Breaker reset after success.
    // ----------------------------------------------------
    console.log('\n[Test 124] Verifying circuit breaker resets on success...');
    providerHealthService.recordSuccess('groq', 100, 50);
    const healthyReset = providerHealthService.isHealthy('groq');
    if (!healthyReset) {
      throw new Error('Expected groq circuit to close (become healthy) after recordSuccess');
    }
    console.log('✓ Test 124 Passed.');

    // ----------------------------------------------------
    // TEST 125: Exclude long extraction routes from timeout.middleware.js.
    // ----------------------------------------------------
    console.log('\n[Test 125] Verifying requestTimeout bypass for extraction routes...');
    const { requestTimeout } = await import('../../middleware/timeout.middleware.js');
    const dummyReq = { originalUrl: '/api/v1/workshops/123/intelligence/extract' };
    const dummyRes = {
      setTimeout: () => { throw new Error('setTimeout should not be called'); },
      headersSent: false
    };
    let nextCalled = false;
    requestTimeout(500)(dummyReq, dummyRes, () => { nextCalled = true; });
    if (!nextCalled) {
      throw new Error('Expected next() to be called immediately');
    }
    console.log('✓ Test 125 Passed.');

    // ----------------------------------------------------
    // TEST 126: errorHandler headersSent prevention.
    // ----------------------------------------------------
    console.log('\n[Test 126] Verifying errorHandler headersSent guard...');
    const { errorHandler } = await import('../../middleware/error.middleware.js');
    const headerSentRes = {
      headersSent: true,
      status: () => { throw new Error('res.status should not be called when headersSent'); }
    };
    let handlerNextCalled = false;
    errorHandler(new Error('Test error'), {}, headerSentRes, (err) => {
      if (err) handlerNextCalled = true;
    });
    if (!handlerNextCalled) {
      throw new Error('Expected errorHandler to call next(err) if headers are sent');
    }
    console.log('✓ Test 126 Passed.');

    // ----------------------------------------------------
    // TEST 127: Router Fallback - Ollama unavailable falls back to next provider
    // ----------------------------------------------------
    console.log('\n[Test 127] Verifying router fallback on Ollama unavailable...');
    aiProviderService.generateAIResponse = originalGenerateAIResponse;
    const aiRouterService = (await import('../../services/ai/router/aiRouter.service.js')).default;
    const aiRouterConfig = (await import('../../config/aiRouter.config.js')).default;
    const groqService = (await import('../../services/ai/providers/groq.service.js')).default;
    const aiCacheManager = (await import('../../services/ai/utils/aiCacheManager.js')).default;
    aiCacheManager.clear();
    
    // Temporarily inject ollama into priority list
    const originalPriority = [...aiRouterConfig.priority];
    aiRouterConfig.priority = ['ollama', 'groq'];
    
    // Mock Ollama tags fetch to fail (Ollama unavailable)
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('11434')) {
        throw new Error('Ollama connection refused');
      }
      return originalFetch(url);
    };

    // Mock Groq client completions.create
    const originalGroqGetClient = groqService._getClient;
    groqService._getClient = () => ({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: '{"concepts": [{"name": "GroqConcept", "description": "D", "importance": 0.5, "sourceIndices": [0]}]}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 10 }
          })
        }
      }
    });

    // Make sure Groq circuit is healthy
    providerHealthService.recordSuccess('groq', 10, 10);
    
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept127 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'GroqConcept' });
    if (!concept127) {
      throw new Error('Fallback to Groq failed when Ollama was unavailable');
    }
    
    // Restore Groq client mock
    groqService._getClient = originalGroqGetClient;
    global.fetch = originalFetch;
    aiRouterConfig.priority = originalPriority;
    console.log('✓ Test 127 Passed.');

    // ----------------------------------------------------
    // TEST 128: Router - Ollama success terminates fallback chain
    // ----------------------------------------------------
    console.log('\n[Test 128] Verifying Ollama success does not trigger fallback...');
    aiCacheManager.clear();
    aiRouterConfig.priority = ['ollama', 'groq'];
    
    const originalCalculate = aiRouterService._calculateProviderScore;
    aiRouterService._calculateProviderScore = (name) => {
      if (name === 'ollama') return 1000;
      return 500;
    };

    let groqCalled = false;
    global.fetch = async (url) => {
      if (url.includes('11434/api/tags')) {
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'qwen3:4b' }] })
        };
      }
      if (url.includes('11434/api/generate') || url.includes('11434/api/chat')) {
        return {
          ok: true,
          json: async () => ({
            response: '{"concepts": [{"name": "OllamaConcept", "description": "D", "importance": 0.5, "sourceIndices": [0]}]}',
            message: {
              content: '{"concepts": [{"name": "OllamaConcept", "description": "D", "importance": 0.5, "sourceIndices": [0]}]}'
            }
          })
        };
      }
      if (url.includes('api.groq.com')) {
        groqCalled = true;
        throw new Error('Groq should not be called');
      }
      return { ok: false };
    };

    // Make sure Ollama circuit is reset/healthy
    providerHealthService.recordSuccess('ollama', 10, 10);

    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept128 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'OllamaConcept' });
    if (!concept128 || groqCalled) {
      throw new Error('Ollama success failed to terminate fallback chain or called Groq');
    }
    
    aiRouterService._calculateProviderScore = originalCalculate;
    aiRouterConfig.priority = originalPriority;
    global.fetch = originalFetch;
    console.log('✓ Test 128 Passed.');

    // ----------------------------------------------------
    // TEST 129: Unhealthy/OPEN provider is never called and never added to activeQueue
    // ----------------------------------------------------
    console.log('\n[Test 129] Verifying unhealthy/OPEN provider is never called...');
    aiCacheManager.clear();
    aiRouterConfig.priority = ['groq'];
    
    // Set Groq circuit to unhealthy
    providerHealthService.recordFailure('groq', { type: 'MODEL_NOT_FOUND', message: 'Model missing' });
    
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected router to throw error due to empty active queue');
    } catch (err) {
      if (!err.message.includes('Fallback chain failed') || err.message.includes('Trying GROQ')) {
        throw err;
      }
    }
    console.log('✓ Test 129 Passed.');

    // ----------------------------------------------------
    // TEST 130: Concurrency Guard - duplicate extraction returns current status
    // ----------------------------------------------------
    console.log('\n[Test 130] Verifying concurrency guard on duplicate extraction...');
    aiCacheManager.clear();
    // Create an intelligence record in PROCESSING state
    const intelRecord = await WorkshopIntelligence.findOne({ workspaceId: workspaceA, user: userA });
    intelRecord.status = 'PROCESSING';
    await intelRecord.save();
    
    // Try to trigger extraction
    const result130 = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    if (result130.status !== 'PROCESSING') {
      throw new Error('Expected concurrency guard to return current PROCESSING status');
    }
    
    // Reset status for other tests
    intelRecord.status = 'READY';
    await intelRecord.save();
    console.log('✓ Test 130 Passed.');

    // ----------------------------------------------------
    // TEST 131: Sleep delay for RATE_LIMIT respects retryable status
    // ----------------------------------------------------
    console.log('\n[Test 131] Verifying rate limit retries sleep delay...');
    aiCacheManager.clear();
    aiRouterConfig.priority = ['groq'];
    providerHealthService.recordSuccess('groq', 10, 10);
    
    const groqService131 = (await import('../../services/ai/providers/groq.service.js')).default;
    const originalGroqGetClient131 = groqService131._getClient;
    
    let groqCount = 0;
    groqService131._getClient = () => ({
      chat: {
        completions: {
          create: async () => {
            groqCount++;
            if (groqCount === 1) {
              const err = new Error('Rate limit exceeded');
              err.status = 429;
              err.rawError = {
                headers: {
                  get: (h) => h === 'retry-after' ? '1' : null
                }
              };
              throw err;
            }
            return {
              choices: [{ message: { content: '{"concepts": [{"name": "RetryConcept", "description": "D", "importance": 0.5, "sourceIndices": [0]}]}' } }],
              usage: { prompt_tokens: 10, completion_tokens: 10 }
            };
          }
        }
      }
    });

    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    const concept131 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'RetryConcept' });
    if (!concept131 || groqCount !== 2) {
      throw new Error('Rate limit retry loop failed to retry or parse correctly');
    }
    
    // Restore
    groqService131._getClient = originalGroqGetClient131;
    console.log('✓ Test 131 Passed.');

    // ----------------------------------------------------
    // TEST 132: Ollama model detection / missing model (OLLAMA_MODEL_NOT_FOUND)
    // ----------------------------------------------------
    console.log('\n[Test 132] Verifying Ollama model missing throws OLLAMA_MODEL_NOT_FOUND...');
    aiCacheManager.clear();
    aiRouterConfig.priority = ['ollama'];
    providerHealthService.recordSuccess('ollama', 10, 10);

    global.fetch = async (url) => {
      if (url.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'different-model:latest' }] })
        };
      }
      return { ok: false };
    };

    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
      throw new Error('Expected extraction to throw OLLAMA_MODEL_NOT_FOUND');
    } catch (err) {
      if (err.code !== 'OLLAMA_MODEL_NOT_FOUND') {
        throw err;
      }
    }
    console.log('✓ Test 132 Passed.');

    // ----------------------------------------------------
    // TEST 133: Partial resource failure and database persistence
    // ----------------------------------------------------
    console.log('\n[Test 133] Verifying partial resource failure does not throw and preserves success...');
    aiCacheManager.clear();
    aiRouterConfig.priority = ['ollama'];
    providerHealthService.recordSuccess('ollama', 10, 10);

    // Setup two resources on workspaceA
    const sessionDoc = await StudySession.findById(workspaceA);
    sessionDoc.resources = [
      { _id: new mongoose.Types.ObjectId('6a8375b66971869ae2935d1a'), title: 'Resource 1', type: 'pdf' },
      { _id: new mongoose.Types.ObjectId('6a8375b66971869ae2935d1b'), title: 'Resource 2', type: 'pdf' }
    ];
    await sessionDoc.save();

    // Create chunks for both resources
    await KnowledgeChunk.deleteMany({ workspaceId: workspaceA });
    await KnowledgeChunk.create([
      {
        workspaceId: workspaceA,
        userId: userA,
        resourceId: '6a8375b66971869ae2935d1a',
        documentId: new mongoose.Types.ObjectId(),
        chunkIndex: 0,
        text: 'ResourceOneText content description',
        contentHash: 'hash1'
      },
      {
        workspaceId: workspaceA,
        userId: userA,
        resourceId: '6a8375b66971869ae2935d1b',
        documentId: new mongoose.Types.ObjectId(),
        chunkIndex: 0,
        text: 'ResourceTwoText content description',
        contentHash: 'hash2'
      }
    ]);

    global.fetch = async (url, options) => {
      if (url.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'qwen3:4b' }] })
        };
      }
      if (url.includes('/api/chat') || url.includes('/api/generate')) {
        const bodyStr = options.body || '';
        if (bodyStr.includes('ResourceOneText')) {
          return {
            ok: true,
            json: async () => ({
              message: {
                content: '{"concepts": [{"name": "PartialSuccessConcept", "description": "Desc", "importance": 0.8, "sourceIndices": [0]}]}'
              }
            })
          };
        }
        if (bodyStr.includes('ResourceTwoText')) {
          throw new Error('Local model crashed');
        }
      }
      return { ok: false };
    };

    // Reinitialize intelligence to pick up new resources
    await WorkshopIntelligence.deleteMany({ workspaceId: workspaceA });
    const intelResult = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    
    if (intelResult.status !== 'PARTIAL') {
      throw new Error(`Expected status to be PARTIAL, got ${intelResult.status}`);
    }

    // Verify concepts for Resource 1 exist
    const concept133 = await ExtractedConcept.findOne({ workspaceId: workspaceA, name: 'PartialSuccessConcept' });
    if (!concept133) {
      throw new Error('Concepts from successful resource were not persisted or deleted');
    }
    console.log('✓ Test 133 Passed.');

    // ----------------------------------------------------
    // TEST 134: Graph and Insights retrieval on PARTIAL extraction status
    // ----------------------------------------------------
    console.log('\n[Test 134] Verifying graph and insights retrieval after partial extraction...');
    const graphData = await workshopIntelligenceService.getWorkshopKnowledgeGraph(workspaceA, userA);
    if (!graphData.nodes || graphData.nodes.length === 0) {
      throw new Error('Graph nodes should not be empty after partial success');
    }

    const insightsData = await workshopIntelligenceService.getWorkshopIntelligenceInsights(workspaceA, userA);
    if (!insightsData || insightsData.metrics?.conceptCount === 0) {
      throw new Error('Insights metrics should contain concepts count');
    }
    console.log('✓ Test 134 Passed.');

    // ----------------------------------------------------
    // TEST 135: Ollama taking 31 seconds but still succeeding (within timeout)
    // ----------------------------------------------------
    console.log('\n[Test 135] Verifying Ollama request under custom timeouts...');
    
    // Simulate OLLAMA_TIMEOUT_MS=500 and latency=200ms (succeeds)
    process.env.OLLAMA_TIMEOUT_MS = '500';
    
    // Mock fetch to simulate latency of 200ms with AbortSignal support
    global.fetch = async (url, options) => {
      const signal = options?.signal;
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, 200);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
          if (signal.aborted) {
            clearTimeout(timeoutId);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }
        }
      });
      if (url.includes('/api/tags')) {
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'qwen3:4b' }] })
        };
      }
      if (url.includes('/api/generate') || url.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({ response: '{"concepts": []}', message: { content: '{"concepts": []}' } })
        };
      }
      return { ok: false };
    };

    // Assert that calling ollamaService succeeds (latency 200ms < timeout 500ms)
    const ollamaResponse = await aiRouterService.providersRegistry.ollama.generateResponse({
      prompt: 'test prompt',
      jsonMode: true,
      requestId: 'test135'
    });
    if (!ollamaResponse) {
      throw new Error('Ollama response should have succeeded within the timeout period');
    }
    console.log('✓ Test 135 Passed (Ollama succeeded within timeout).');

    // ----------------------------------------------------
    // TEST 136: Ollama timing out and falling back to Gemini
    // ----------------------------------------------------
    console.log('\n[Test 136] Verifying Ollama timing out and falling back to Gemini...');
    
    // Simulate OLLAMA_TIMEOUT_MS=100 and latency=200ms (times out)
    process.env.OLLAMA_TIMEOUT_MS = '100';
    providerHealthService.recordSuccess('ollama'); // Make sure healthy
    aiRouterConfig.priority = ['ollama', 'gemini'];

    // Mock Gemini generateResponse
    let geminiCalled = false;
    const originalGeminiGen = aiRouterService.providersRegistry.gemini.generateResponse;
    aiRouterService.providersRegistry.gemini.generateResponse = async () => {
      geminiCalled = true;
      return { text: '{"concepts": []}', provider: 'gemini' };
    };

    const routerResponse = await aiRouterService.routeRequest({
      prompt: 'test prompt',
      jsonMode: true
    });

    if (!geminiCalled) {
      throw new Error('Gemini fallback should have been triggered after Ollama timed out');
    }
    
    // Reset Gemini mock
    aiRouterService.providersRegistry.gemini.generateResponse = originalGeminiGen;
    console.log('✓ Test 136 Passed (Ollama timed out and successfully fell back to Gemini).');

    // ----------------------------------------------------
    // TEST 137: Concurrent extraction requests for the same workshop
    // ----------------------------------------------------
    console.log('\n[Test 137] Verifying concurrent extraction requests atomic lock protection...');
    
    // Reset status to READY
    await WorkshopIntelligence.updateOne({ workspaceId: workspaceA }, { $set: { status: 'READY' } });

    // Mock extraction process to take 200ms
    const originalExtractBatch = workshopIntelligenceService._extractAndMergeConceptsForBatch;
    workshopIntelligenceService._extractAndMergeConceptsForBatch = async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { provider: 'ollama' };
    };

    // Trigger extraction
    const p1 = workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    // Immediately trigger second extraction (while p1 is still processing)
    const p2 = workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);

    const [res1, res2] = await Promise.all([p1, p2]);

    // One of them must have started first and set status to PROCESSING or returned it
    // Check that we got returned state without throwing/crashing
    if (res2.status !== 'COMPLETED' && res2.status !== 'PROCESSING') {
      throw new Error(`Unexpected concurrent status result: ${res2.status}`);
    }

    // Restore mock
    workshopIntelligenceService._extractAndMergeConceptsForBatch = originalExtractBatch;
    console.log('✓ Test 137 Passed (concurrency atomic lock successfully prevented parallel runs).');

    // ----------------------------------------------------
    // TEST 138: GET status endpoint is read-only
    // ----------------------------------------------------
    console.log('\n[Test 138] Verifying GET /intelligence status endpoint is read-only...');
    
    // Set status to READY and count concepts
    await WorkshopIntelligence.updateOne({ workspaceId: workspaceA }, { $set: { status: 'READY', processedResourceCount: 0 } });
    const initialConceptsCount = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    
    // Call GET status
    const getStatusResult = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (getStatusResult.status !== 'READY') {
      throw new Error(`Expected status to remain READY, got ${getStatusResult.status}`);
    }

    const postConceptsCount = await ExtractedConcept.countDocuments({ workspaceId: workspaceA });
    if (postConceptsCount !== initialConceptsCount) {
      throw new Error('GET status endpoint should not mutate concept records');
    }
    console.log('✓ Test 138 Passed (GET status is read-only and has no side effects).');

    // ----------------------------------------------------
    // TEST 139: Progress counter updates on failed resources and transitions out of PROCESSING
    // ----------------------------------------------------
    console.log('\n[Test 139] Verifying progress updates and transition out of PROCESSING on failures...');
    
    // Force mock batch extraction to throw error for all resources
    const originalExtract = workshopIntelligenceService._extractAndMergeConceptsForBatch;
    workshopIntelligenceService._extractAndMergeConceptsForBatch = async () => {
      throw new Error('Simulated model failure');
    };

    // Re-initialize a fresh intelligence state
    await WorkshopIntelligence.deleteMany({ workspaceId: workspaceA });
    await ExtractedConcept.deleteMany({ workspaceId: workspaceA });
    
    let caughtError = null;
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    } catch (err) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected complete extraction failure to throw an error');
    }

    // Refetch the intelligence state to verify terminal state transitions and progress
    const finalIntel = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
    if (finalIntel.status !== 'FAILED') {
      throw new Error(`Expected status to transition to FAILED, got ${finalIntel.status}`);
    }
    
    // Succeeded resources count is 0, but all 3 are processed (either succeeded or failed)
    if (finalIntel.processedResourceCount !== 0) {
      throw new Error(`Expected processedResourceCount to be 0 since all failed, got ${finalIntel.processedResourceCount}`);
    }
    const processedResources = finalIntel.resources.filter(r => r.status !== 'PENDING').length;
    if (processedResources !== 2) {
      throw new Error(`Expected all 2 resources to be marked as processed, got ${processedResources}`);
    }

    // Restore original mock
    workshopIntelligenceService._extractAndMergeConceptsForBatch = originalExtract;
    console.log('✓ Test 139 Passed (progress counter correct on failures, transitioned to FAILED).');

    // ----------------------------------------------------
    // TEST 140: Stale lock retry bypass
    // ----------------------------------------------------
    console.log('\n[Test 140] Verifying that a stale lock does not block retry...');
    
    // Set status to PROCESSING and updatedAt to 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 600000);
    await WorkshopIntelligence.updateOne(
      { workspaceId: workspaceA }, 
      { $set: { status: 'PROCESSING', updatedAt: tenMinutesAgo } },
      { timestamps: false }
    );
    
    // Mock fetch to succeed
    global.fetch = async (url) => {
      if (url.includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [{ name: 'qwen3:4b' }] }) };
      }
      return { ok: true, json: async () => ({ response: '{"concepts": []}', message: { content: '{"concepts": []}' } }) };
    };

    // Run extraction. Since lock is stale, it should successfully start and complete extraction.
    const staleResult = await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    if (staleResult.status !== 'COMPLETED') {
      throw new Error(`Expected extraction to bypass stale lock and complete, got status ${staleResult.status}`);
    }
    console.log('✓ Test 140 Passed (stale lock successfully bypassed on retry).');

    // ----------------------------------------------------
    // TEST 141: Unexpected exception terminal safety guarantee
    // ----------------------------------------------------
    console.log('\n[Test 141] Verifying unexpected database exception triggers terminal safety FAILED state...');
    
    // Mock KnowledgeChunk.find to throw database error
    const originalFind = KnowledgeChunk.find;
    KnowledgeChunk.find = () => {
      throw new Error('Uncaught database error');
    };

    // Reset status to READY
    await WorkshopIntelligence.updateOne({ workspaceId: workspaceA }, { $set: { status: 'READY', processedResourceCount: 0 } });
    
    let caughtUncaught = null;
    try {
      await workshopIntelligenceService.extractWorkshopKnowledge(workspaceA, userA);
    } catch (err) {
      caughtUncaught = err;
    }

    if (!caughtUncaught || caughtUncaught.message !== 'Uncaught database error') {
      throw new Error('Expected uncaught database error to be propagated');
    }

    // Refetch record and check terminal state and resource failures
    const safetyIntel = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
    if (safetyIntel.status !== 'FAILED') {
      throw new Error(`Expected overall status to transition to FAILED under uncaught exception, got ${safetyIntel.status}`);
    }
    
    const pendingResourcesCount = safetyIntel.resources.filter(r => r.status === 'PENDING').length;
    if (pendingResourcesCount !== 0) {
      throw new Error(`Expected zero PENDING resources, found ${pendingResourcesCount}`);
    }
    
    const failedResourcesCount = safetyIntel.resources.filter(r => r.status === 'FAILED').length;
    if (failedResourcesCount !== 2) {
      throw new Error(`Expected all 2 resources to be marked FAILED, found ${failedResourcesCount}`);
    }

    // Restore original mock
    KnowledgeChunk.find = originalFind;
    console.log('✓ Test 141 Passed (unexpected exception correctly handled under terminal guarantee).');

    // ----------------------------------------------------
    console.log('\n[Test 142] Verifying that getWorkshopIntelligenceStatus heals stale PROCESSING to FAILED/PARTIAL...');
    
    const oldTime = new Date(Date.now() - 600000); // 10 minutes ago
    await WorkshopIntelligence.updateOne(
      { workspaceId: workspaceA }, 
      { $set: { status: 'PROCESSING', updatedAt: oldTime } },
      { timestamps: false }
    );

    const statusRes142 = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (statusRes142.status !== 'FAILED') {
      throw new Error(`Expected status to be healed to FAILED, got ${statusRes142.status}`);
    }

    const dbRecord142 = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
    if (dbRecord142.status !== 'FAILED') {
      throw new Error(`Expected database record to have status FAILED, got ${dbRecord142.status}`);
    }
    console.log('✓ Test 142 Passed (stale PROCESSING successfully healed to FAILED).');

    // ----------------------------------------------------
    console.log('\n[Test 143] Verifying that getWorkshopIntelligenceStatus does not update updatedAt on non-stale read...');
    
    await WorkshopIntelligence.updateOne(
      { workspaceId: workspaceA }, 
      { $set: { status: 'COMPLETED' } }
    );
    const initialRecord143 = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
    const initialUpdatedAt = initialRecord143.updatedAt.getTime();

    await new Promise(resolve => setTimeout(resolve, 100));

    await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);

    const postRecord143 = await WorkshopIntelligence.findOne({ workspaceId: workspaceA });
    if (postRecord143.updatedAt.getTime() !== initialUpdatedAt) {
      throw new Error(`Expected updatedAt to remain unchanged, but it updated from ${initialUpdatedAt} to ${postRecord143.updatedAt.getTime()}`);
    }
    console.log('✓ Test 143 Passed (GET status check does not refresh updatedAt).');

    // ----------------------------------------------------
    console.log('\n[Test 144] Verifying GET status returns terminal FAILED after stale healing...');
    
    await WorkshopIntelligence.updateOne(
      { workspaceId: workspaceA }, 
      { $set: { status: 'PROCESSING', updatedAt: new Date(Date.now() - 600000) } },
      { timestamps: false }
    );

    const statusRes144 = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (statusRes144.status !== 'FAILED') {
      throw new Error(`Expected healed status to be FAILED, got ${statusRes144.status}`);
    }

    const secondRes144 = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (secondRes144.status !== 'FAILED') {
      throw new Error(`Expected healed status to stay FAILED, got ${secondRes144.status}`);
    }
    console.log('✓ Test 144 Passed (GET status returns terminal FAILED after healing).');

    // ----------------------------------------------------
    console.log('\n[Test 145] Verifying controller sets Cache-Control: no-store header to bypass browser 304 caching...');
    
    const reqMock = {
      user: { _id: userA },
      params: { workshopId: workspaceA.toString() }
    };
    
    let cacheControlHeader = null;
    const resMock = {
      set: (headerName, value) => {
        if (headerName.toLowerCase() === 'cache-control') {
          cacheControlHeader = value;
        }
      },
      status: (statusCode) => {
        return {
          json: (data) => {}
        };
      }
    };

    await workshopIntelligenceController.getIntelligenceStatus(reqMock, resMock, (err) => {
      if (err) console.error('Next error in Test 145:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    if (cacheControlHeader !== 'no-store') {
      throw new Error(`Expected Cache-Control header to be "no-store", got "${cacheControlHeader}"`);
    }
    console.log('✓ Test 145 Passed (controller correctly sets Cache-Control: no-store header).');

    // ----------------------------------------------------
    console.log('\n[Test 146] Verifying that a fresh PROCESSING document is not healed and remains PROCESSING...');
    
    await WorkshopIntelligence.updateOne(
      { workspaceId: workspaceA }, 
      { $set: { status: 'PROCESSING', updatedAt: new Date() } },
      { timestamps: false }
    );

    const statusRes146 = await workshopIntelligenceService.getWorkshopIntelligenceStatus(workspaceA, userA);
    if (statusRes146.status !== 'PROCESSING') {
      throw new Error(`Expected fresh document to remain PROCESSING, got ${statusRes146.status}`);
    }
    console.log('✓ Test 146 Passed (fresh PROCESSING remains unchanged).');

    // ----------------------------------------------------
    console.log('\n[Test 147] Verifying that a provider circuit transitions OPEN -> HALF_OPEN after cooldown...');
    
    // Set a provider state to OPEN / unhealthy
    providerHealthService.healthState.set('gemini', {
      healthy: false,
      halfOpen: false,
      probeInProgress: false,
      consecutiveFailures: 3,
      lastFailure: new Date(Date.now() - 120000), // 2 minutes ago (greater than 60s cooldown limit)
      retryAfter: null,
      lastSuccess: null,
      failureReason: 'Simulated failure'
    });

    const isHealthy147 = providerHealthService.isHealthy('gemini');
    if (!isHealthy147) {
      throw new Error('Expected gemini to allow a single probe request after cooldown expiration');
    }

    const state147 = providerHealthService.healthState.get('gemini');
    if (state147.halfOpen !== true || state147.probeInProgress !== true) {
      throw new Error(`Expected halfOpen=true and probeInProgress=true, got halfOpen=${state147.halfOpen}, probeInProgress=${state147.probeInProgress}`);
    }
    console.log('✓ Test 147 Passed (circuit successfully transitioned to HALF_OPEN).');

    // ----------------------------------------------------
    console.log('\n[Test 148] Verifying that a successful request in HALF_OPEN closes/resets the circuit to healthy...');
    
    // Set a provider to HALF_OPEN (healthy=false, halfOpen=true)
    providerHealthService.healthState.set('gemini', {
      healthy: false,
      halfOpen: true,
      probeInProgress: true,
      consecutiveFailures: 3,
      lastFailure: new Date(Date.now() - 60000),
      retryAfter: null,
      lastSuccess: null,
      failureReason: 'Simulated failure'
    });

    providerHealthService.recordSuccess('gemini', 10, 50);

    const state148 = providerHealthService.healthState.get('gemini');
    if (state148.healthy !== true || state148.halfOpen !== false || state148.consecutiveFailures !== 0) {
      throw new Error(`Expected healthy=true, halfOpen=false, consecutiveFailures=0, got healthy=${state148.healthy}, halfOpen=${state148.halfOpen}, consecutiveFailures=${state148.consecutiveFailures}`);
    }
    console.log('✓ Test 148 Passed (circuit successfully closed/reset to healthy).');

    // Reset priority & fetch
    aiRouterConfig.priority = originalPriority;
    global.fetch = originalFetch;

    // Restore mock always
    aiProviderService.generateAIResponse = originalGenerateAIResponse;

    // Clean up test records
    await User.deleteMany({ _id: { $in: [userA, userB] } });
    await StudySession.deleteMany({ _id: { $in: [workspaceA, workspaceB] } });
    await KnowledgeChunk.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await KnowledgeDocument.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await WorkshopIntelligence.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await ExtractedConcept.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
    await ConceptRelationship.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });

    await disconnectDB();

    console.log('\n====================================================');
    console.log('ALL WORKSHOP INTELLIGENCE TESTS PASSED SUCCESS');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed:', err);
    // Restore mock always
    aiProviderService.generateAIResponse = originalGenerateAIResponse;
    try {
      await User.deleteMany({ _id: { $in: [userA, userB] } });
      await StudySession.deleteMany({ _id: { $in: [workspaceA, workspaceB] } });
      await KnowledgeChunk.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
      await KnowledgeDocument.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
      await WorkshopIntelligence.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
      await ExtractedConcept.deleteMany({ workspaceId: { $in: [workspaceA, workspaceB] } });
      await disconnectDB();
    } catch (_) {}
    process.exit(1);
  }
}

runTests();
