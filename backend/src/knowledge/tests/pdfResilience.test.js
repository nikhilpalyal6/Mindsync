import dotenv from 'dotenv';
import mongoose from 'mongoose';
import pdfExtractorService from '../../services/pdf/pdfExtractor.service.js';
import aiRouterService from '../../services/ai/router/aiRouter.service.js';
import providerHealthService from '../../services/ai/health/providerHealth.service.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import KnowledgeJob from '../../models/knowledgeJob.model.js';
import KnowledgeDocument from '../../models/knowledgeDocument.model.js';
import StudySession from '../../models/studySession.model.js';
import { aiRouterConfig } from '../../config/aiRouter.config.js';
import { AIQuotaExceededError, AIRateLimitError } from '../../services/ai/utils/providerErrors.js';
import aiCacheManager from '../../services/ai/utils/aiCacheManager.js';

dotenv.config();
process.env.KNOWLEDGE_ENGINE_ENABLED = 'true';
process.env.AI_PROVIDER_QUOTA_COOLDOWN_MS = '5000'; // 5 seconds for tests

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3.3 PDF RESILIENCE INTEGRATION TESTS');
  console.log('====================================================');

  const testUserId = new mongoose.Types.ObjectId();
  const testWorkspaceId = new mongoose.Types.ObjectId();
  const testResourceId = new mongoose.Types.ObjectId().toString();

  try {
    await connectDB();

    // Prepare a mock workspace session with resources
    console.log('\nSetting up test workspace database records...');
    await StudySession.deleteMany({ _id: testWorkspaceId });
    await StudySession.create({
      _id: testWorkspaceId,
      user: testUserId,
      title: 'Resilience Test Session',
      description: 'Workspace for extraction tests',
      resources: [
        {
          _id: testResourceId,
          type: 'pdf',
          title: 'project_ideas.pdf',
          url: 'project_ideas.pdf',
          addedAt: new Date()
        }
      ]
    });

    // Clean old jobs & documents
    await KnowledgeJob.deleteMany({ resourceId: testResourceId });
    await KnowledgeDocument.deleteMany({ resourceId: testResourceId });

    // Store references to original functions to restore later
    const originalRouteRequest = aiRouterService.routeRequest;
    const originalIsTextMeaningful = pdfExtractorService.isTextMeaningful;
    const originalGeminiGen = aiRouterService.providersRegistry.gemini.generateResponse;
    const originalOpenRouterGen = aiRouterService.providersRegistry.openrouter.generateResponse;

    // A sample valid Base64 PDF Data URL (for testing format verification)
    // This is a minimal 1-pixel PDF representation in Base64
    const validBase64PdfUrl = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmogCiAgPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiA+PgplbmRvYmoKdHJhaWxlcgogIDw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4KJSVFT0Y=';

    // ----------------------------------------------------
    // Test 1 — Native PDF Extraction Success (AI Bypassed)
    // ----------------------------------------------------
    console.log('\n[Test 1] Verifying native PDF extraction success...');
    let routerCallCount = 0;
    aiRouterService.routeRequest = async (params) => {
      routerCallCount++;
      return { text: 'AI Fallback text' };
    };

    // Override quality check to mock successful native extraction
    pdfExtractorService.isTextMeaningful = () => true;

    const result1 = await pdfExtractorService.extractTextFromBase64(validBase64PdfUrl);
    if (!result1.includes('JVBERi0x') && routerCallCount !== 0) {
      throw new Error(`Expected native text to be returned without AI calls. AI Router called: ${routerCallCount}`);
    }
    console.log('✓ Test 1 Passed: Native extraction succeeded. AI Router call count = 0.');

    // ----------------------------------------------------
    // Test 2 — Native Extraction Insufficient (AI Fallback)
    // ----------------------------------------------------
    console.log('\n[Test 2] Verifying native extraction insufficient -> AI Fallback...');
    routerCallCount = 0;
    pdfExtractorService.isTextMeaningful = () => false;

    const result2 = await pdfExtractorService.extractTextFromBase64(validBase64PdfUrl);
    if (result2 !== 'AI Fallback text' || routerCallCount !== 1) {
      throw new Error(`Expected AI Fallback text, got "${result2}". AI Router called: ${routerCallCount}`);
    }
    console.log('✓ Test 2 Passed: Native insufficient. Routed to AI fallback successfully.');

    // Restore routeRequest
    aiRouterService.routeRequest = originalRouteRequest;

    // ----------------------------------------------------
    // Test 3 — Gemini 429 Quota Exceeded (Fallback to OpenRouter)
    // ----------------------------------------------------
    console.log('\n[Test 3] Verifying Gemini 429 Quota Exceeded -> Fallback to OpenRouter...');
    
    // Ensure both direct gemini and openrouter are healthy
    providerHealthService.recordSuccess('gemini');
    providerHealthService.recordSuccess('openrouter');

    let geminiCallCount = 0;
    let openRouterCallCount = 0;

    aiRouterService.providersRegistry.gemini.generateResponse = async (params) => {
      geminiCallCount++;
      throw new AIQuotaExceededError('Quota exceeded for model gemini-3.5-flash', 'gemini');
    };

    aiRouterService.providersRegistry.openrouter.generateResponse = async (params) => {
      openRouterCallCount++;
      return { text: 'OpenRouter OCR output text', usage: { total_tokens: 15 } };
    };

    const ocrResult = await pdfExtractorService.extractTextFromBase64(validBase64PdfUrl);
    if (ocrResult !== 'OpenRouter OCR output text') {
      throw new Error(`Expected OpenRouter output, got: "${ocrResult}"`);
    }

    if (geminiCallCount !== 1 || openRouterCallCount !== 1) {
      throw new Error(`Expected exactly 1 Gemini call and 1 OpenRouter call. Gemini: ${geminiCallCount}, OpenRouter: ${openRouterCallCount}`);
    }

    // Verify Gemini circuit is immediately tripped (marked unhealthy)
    const geminiHealth = providerHealthService.healthState.get('gemini');
    if (geminiHealth.healthy !== false || geminiHealth.consecutiveFailures < 3) {
      throw new Error(`Expected Gemini health circuit to be opened immediately. Status: ${JSON.stringify(geminiHealth)}`);
    }

    console.log('✓ Test 3 Passed: Gemini Quota Exceeded immediately opened circuit, fell back to OpenRouter successfully.');

    // ----------------------------------------------------
    // Test 4 — All Capable Providers Unavailable (AI_EXTRACTION_UNAVAILABLE)
    // ----------------------------------------------------
    console.log('\n[Test 4] Verifying all capable providers unavailable throws AI_EXTRACTION_UNAVAILABLE...');
    
    // Clear cache to prevent cache hits
    aiCacheManager.clear();

    // Force both providers unhealthy/unsupported
    aiRouterService.providersRegistry.openrouter.generateResponse = async (params) => {
      throw new Error('OpenRouter provider down');
    };

    try {
      await pdfExtractorService.extractTextFromBase64(validBase64PdfUrl);
      throw new Error('Expected PDF extraction to fail when all providers are down.');
    } catch (err) {
      if (err.code !== 'AI_EXTRACTION_UNAVAILABLE' && err.code !== 'AI_PROVIDER_UNAVAILABLE') {
        throw new Error(`Expected AI_EXTRACTION_UNAVAILABLE or AI_PROVIDER_UNAVAILABLE error, got code: "${err.code}" (${err.message})`);
      }
    }
    console.log('✓ Test 4 Passed: All providers failed throws structured AI_EXTRACTION_UNAVAILABLE code.');

    // ----------------------------------------------------
    // Test 5 — Capability Filtering (Groq Excluded from PDF extraction)
    // ----------------------------------------------------
    console.log('\n[Test 5] Verifying capability filtering (Groq excluded)...');
    
    // Reset Direct Gemini and OpenRouter to healthy
    providerHealthService.recordSuccess('gemini');
    providerHealthService.recordSuccess('openrouter');
    providerHealthService.recordSuccess('groq');

    let groqCalled = false;
    aiRouterService.providersRegistry.groq.generateResponse = async (params) => {
      groqCalled = true;
      return { text: 'Groq text' };
    };

    // Override Gemini/OpenRouter to fail
    aiRouterService.providersRegistry.gemini.generateResponse = async (params) => {
      throw new Error('Gemini failed');
    };
    aiRouterService.providersRegistry.openrouter.generateResponse = async (params) => {
      throw new Error('OpenRouter failed');
    };

    try {
      await pdfExtractorService.extractTextFromBase64(validBase64PdfUrl);
    } catch (err) {
      // Ignored: expect routing failure
    }

    if (groqCalled) {
      throw new Error('Groq should have been excluded from PDF extraction since it lacks capability metadata.');
    }
    console.log('✓ Test 5 Passed: Groq excluded from PDF extraction successfully.');

    // Restore original functions
    pdfExtractorService.isTextMeaningful = originalIsTextMeaningful;
    aiRouterService.providersRegistry.gemini.generateResponse = originalGeminiGen;
    aiRouterService.providersRegistry.openrouter.generateResponse = originalOpenRouterGen;

    // Cleanup database records
    console.log('\nCleaning up database records...');
    await StudySession.deleteMany({ _id: testWorkspaceId });
    await disconnectDB();

    console.log('\n====================================================');
    console.log('ALL PHASE 3.3 RESILIENCE INTEGRATION TESTS PASSED SUCCESS');
    console.log('====================================================');

  } catch (testErr) {
    console.error('\n❌ Test execution failed:', testErr);
    await StudySession.deleteMany({ _id: testWorkspaceId });
    await disconnectDB();
    process.exit(1);
  }
}

runTests();
