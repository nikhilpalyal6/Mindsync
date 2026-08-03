import { aiRouterConfig } from '../../../config/aiRouter.config.js';
import providerHealthService from '../health/providerHealth.service.js';
import groqService from '../providers/groq.service.js';
import geminiService from '../providers/gemini.service.js';
import openrouterService from '../providers/openrouter.service.js';
import aiQueueManager from '../utils/aiQueueManager.js';
import aiCacheManager from '../utils/aiCacheManager.js';
import { toUnifiedError } from '../utils/providerErrors.js';
import logger from '../../../config/logger.js';

class AIRouterService {
  constructor() {
    this.providersRegistry = {
      groq: groqService,
      gemini: geminiService,
      openrouter: openrouterService
    };
  }

  /**
   * Helper to infer request type from prompt text and instructions
   */
  _inferRequestType(params) {
    const { messages, systemInstruction, prompt, systemPrompt } = params;
    const sysInstructionText = (systemInstruction || systemPrompt || '').toLowerCase();
    const promptText = (prompt || (messages && messages.map(m => m.content).join(' ')) || '').toLowerCase();

    const textToAnalyze = `${sysInstructionText} ${promptText}`;

    if (textToAnalyze.includes('quiz') || textToAnalyze.includes('multiple choice') || textToAnalyze.includes('questions') || params.jsonMode) {
      return 'quiz';
    }
    if (textToAnalyze.includes('summary') || textToAnalyze.includes('summarize') || textToAnalyze.includes('key point') || textToAnalyze.includes('bullet point')) {
      return 'summary';
    }
    if (textToAnalyze.includes('flashcard') || textToAnalyze.includes('front/back')) {
      return 'flashcards';
    }
    if (textToAnalyze.includes('tutor') || textToAnalyze.includes('explain') || textToAnalyze.includes('concept')) {
      return 'tutor';
    }
    return 'chat';
  }

  /**
   * Calculates dynamic routing score based on health state, latency metrics, and task capabilities.
   */
  _calculateProviderScore(providerName, requestType, tuning) {
    const state = providerHealthService.healthState.get(providerName) || {};
    const metric = providerHealthService.metrics.get(providerName) || { requestCount: 0, successCount: 0, failureCount: 0, latencySum: 0 };
    const providerConf = aiRouterConfig.providers[providerName];

    const isHealthy = providerHealthService.isHealthy(providerName);
    if (!isHealthy) {
      return -Infinity; // Push unhealthy providers to bottom
    }

    let score = 1000; // Base score

    // 1. Success Rate score contribution
    let successRate = 100;
    if (metric.requestCount > 0) {
      successRate = (metric.successCount / metric.requestCount) * 100;
    }
    score += successRate * (tuning.priorityWeights?.successRate ?? 10);

    // 2. Average Latency penalty contribution
    let avgLatency = 500;
    if (metric.successCount > 0) {
      avgLatency = metric.latencySum / metric.successCount;
    }
    score += avgLatency * (tuning.priorityWeights?.latency ?? -0.2);

    // 3. Failure count penalty
    score += metric.failureCount * (tuning.priorityWeights?.failures ?? -50);

    // 4. Healthy / Half-Open state bonus
    if (state.healthy && !state.halfOpen) {
      score += (tuning.priorityWeights?.healthy ?? 500);
    } else if (state.halfOpen) {
      score += (tuning.priorityWeights?.halfOpen ?? 100);
    }

    // 5. Capability alignment boost
    if (providerConf?.metadata) {
      const meta = providerConf.metadata;
      if (requestType === 'quiz') {
        if (meta.preferredForQuiz) score += 300;
        if (meta.supportsJSON) score += 200;
      } else if (requestType === 'summary') {
        if (meta.preferredForSummary) score += 300;
        if (meta.supportsLongContext) score += 200;
      } else if (requestType === 'flashcards') {
        if (meta.supportsJSON) score += 200;
      } else if (requestType === 'tutor') {
        if (meta.preferredForTutor) score += 300;
        if (meta.supportsStreaming) score += 100;
      }
    }

    return score;
  }

  /**
   * Main entry point to route the AI request.
   */
  async routeRequest(requestParams) {
    // 1. Perform early Cache Lookup before entering queue
    const cacheKey = aiCacheManager.generateKey(requestParams);
    const cachedVal = aiCacheManager.get(cacheKey);
    if (cachedVal) {
      logger.info(`[AI Router] Cache HIT. Returning cached response immediately.`);
      logger.info(`[AI Router Telemetry] Status: SUCCESS | Selected: ${cachedVal.provider} (CACHE) | Score: N/A | Latency: 0ms | Cache: HIT | Queue Wait: 0ms | Retries: 0 | Fallback Used: NO | Final Provider: ${cachedVal.provider}`);
      return cachedVal;
    }

    // 2. Wrap routing flow inside the concurrency queue lock
    return await aiQueueManager.run(async (queueWaitTime) => {
      // Check cache again inside lock (double-checked locking optimization)
      const doubleCheckedVal = aiCacheManager.get(cacheKey);
      if (doubleCheckedVal) {
        logger.info(`[AI Router] Cache HIT (Double-Checked). Returning cached response.`);
        logger.info(`[AI Router Telemetry] Status: SUCCESS | Selected: ${doubleCheckedVal.provider} (CACHE) | Score: N/A | Latency: 0ms | Cache: HIT | Queue Wait: ${queueWaitTime}ms | Retries: 0 | Fallback Used: NO | Final Provider: ${doubleCheckedVal.provider}`);
        return doubleCheckedVal;
      }

      const tuning = aiRouterConfig.tuning || {};
      const requestType = this._inferRequestType(requestParams);

      let providersToEvaluate = [...aiRouterConfig.priority];

      // Enforce: Production must NEVER force a provider unless explicitly requested by an API parameter
      const explicitProvider = requestParams.provider || requestParams.forceProvider;
      if (explicitProvider && this.providersRegistry[explicitProvider.toLowerCase()]) {
        logger.info(`[AI Router] API parameter requested specific provider override: ${explicitProvider.toUpperCase()}`);
        providersToEvaluate = [explicitProvider.toLowerCase()];
      }

      const activeQueue = [];
      const skippedList = [];

      for (const name of providersToEvaluate) {
        const providerConf = aiRouterConfig.providers[name];
        if (!providerConf) continue;

        const isEnabled = providerConf.enabled();
        const isHealthy = providerHealthService.isHealthy(name);

        if (!isEnabled) {
          const reason = !providerConf.apiKey() ? 'API key missing' : 'disabled in env';
          skippedList.push({ name, reason });
          continue;
        }

        if (!isHealthy) {
          skippedList.push({ name, reason: 'health circuit open' });
          continue;
        }

        // Calculate score for active healthy provider
        const score = this._calculateProviderScore(name, requestType, tuning);
        activeQueue.push({ name, score });
      }

      // Sort by score descending
      activeQueue.sort((a, b) => b.score - a.score);

      // Emergency failover fallback: if active queue is empty, try enabled providers anyway
      if (activeQueue.length === 0) {
        const backupProviders = providersToEvaluate.filter(name => {
          const providerConf = aiRouterConfig.providers[name];
          return providerConf && providerConf.enabled();
        });
        backupProviders.forEach(name => {
          activeQueue.push({ name, score: 0 });
        });
      }

      // Log the provider queue sequence before the request starts
      console.log('Trying providers:');
      activeQueue.forEach((p, index) => {
        const displayName = aiRouterConfig.providers[p.name]?.name || p.name;
        console.log(`${index + 1}. ${displayName}`);
      });
      console.log('');

      // Log skipped providers and reasons
      skippedList.forEach(item => {
        const displayName = aiRouterConfig.providers[item.name]?.name || item.name;
        console.log(`Skipping ${displayName}`);
        console.log(`Reason: ${item.reason}\n`);
      });

      const errorsLog = [];
      let fallbackUsed = false;
      const initialProvider = activeQueue[0]?.name || 'unknown';

      // Iterate through dynamic queue candidates
      for (let idx = 0; idx < activeQueue.length; idx++) {
        const { name: providerName, score: dynamicScore } = activeQueue[idx];
        const adapter = this.providersRegistry[providerName];
        const providerConf = aiRouterConfig.providers[providerName];
        const displayName = providerConf?.name || providerName;

        if (!adapter) continue;

        // Track fallback state
        if (providerName !== initialProvider) {
          fallbackUsed = true;
        }

        // Log request started
        console.log(`Trying ${displayName.toUpperCase()}...`);

        const maxRetryLimit = tuning.retryLimit || 1;
        const totalAttempts = 1 + maxRetryLimit;

        for (let attempt = 1; attempt <= totalAttempts; attempt++) {
          const startTime = Date.now();
          
          try {
            const result = await adapter.generateResponse(requestParams);
            const latency = Date.now() - startTime;

            // Log Success
            console.log(`${displayName.toUpperCase()} success.`);
            console.log('Returning response.\n');

            // Record health metric success
            providerHealthService.recordSuccess(
              providerName, 
              latency, 
              result.usage?.total_tokens || 0
            );

            // Save to Cache store
            aiCacheManager.set(cacheKey, result);

            // Log detailed telemetry message
            logger.info(`[AI Router Telemetry] Status: SUCCESS | Selected: ${providerName} | Score: ${dynamicScore} | Latency: ${latency}ms | Cache: MISS | Queue Wait: ${queueWaitTime}ms | Retries: ${attempt - 1} | Fallback Used: ${fallbackUsed ? 'YES' : 'NO'} | Final Provider: ${providerName}`);

            return result;
          } catch (err) {
            const latency = Date.now() - startTime;
            
            // Normalize error
            const unifiedError = toUnifiedError(err, providerName);
            
            // Log Failure
            console.log(`${displayName.toUpperCase()} failed:`);
            console.log(`${unifiedError.status} ${unifiedError.type === 'RATE_LIMIT' ? 'Rate Limit' : unifiedError.type === 'QUOTA_EXCEEDED' ? 'Quota Exceeded' : unifiedError.message}\n`);

            // Update health failure metrics
            providerHealthService.recordFailure(providerName, unifiedError);

            errorsLog.push(unifiedError);

            // If error is not recoverable (e.g. 400 validation request), abort failover instantly
            if (!unifiedError.recoverable) {
              logger.error(`[AI Router] Aborting routing loop: Unrecoverable validation error. Rethrowing.`);
              
              logger.info(`[AI Router Telemetry] Status: FAILURE | Selected: ${providerName} | Score: ${dynamicScore} | Latency: ${latency}ms | Cache: MISS | Queue Wait: ${queueWaitTime}ms | Retries: ${attempt - 1} | Fallback Used: ${fallbackUsed ? 'YES' : 'NO'} | Final Provider: ${providerName} | Reason: ${unifiedError.message}`);
              
              throw unifiedError;
            }

            // Retry if attempts remain
            if (attempt < totalAttempts) {
              logger.info(`[AI Router] Retrying provider ${providerName.toUpperCase()} (Retry: ${attempt}/${maxRetryLimit})...`);
              continue;
            }

            // Fallback to next provider
            logger.warn(`[AI Router] All retry attempts failed for ${providerName.toUpperCase()}. Trying next fallback provider...`);
            break;
          }
        }
      }

      // If routing queue exhausted, compile detailed reports (Step 8)
      const errorReports = [];
      
      errorsLog.forEach(e => {
        const displayName = aiRouterConfig.providers[e.provider]?.name || e.provider;
        let typeStr = e.type;
        if (e.type === 'RATE_LIMIT') typeStr = 'Rate Limit';
        else if (e.type === 'QUOTA_EXCEEDED') typeStr = 'Quota Exceeded';
        else if (e.type === 'INVALID_REQUEST') typeStr = 'Invalid Request';
        else if (e.type === 'NETWORK_ERROR') typeStr = 'Network Error';
        else if (e.type === 'TIMEOUT') typeStr = 'Timeout';
        else if (e.type === 'SERVER_ERROR') typeStr = 'Server Error';

        errorReports.push(`${displayName}: ${e.status} ${typeStr}`);
      });

      skippedList.forEach(s => {
        const displayName = aiRouterConfig.providers[s.name]?.name || s.name;
        errorReports.push(`${displayName}: Skipped (${s.reason})`);
      });

      const finalErrorMessage = `Fallback chain failed.\n${errorReports.join('\n')}`;
      logger.error(`[AI Router] AI Router error: ${finalErrorMessage}`);
      
      throw new Error(`Fallback chain failed.\n${errorReports.join('\n')}`);
    });
  }
}

export default new AIRouterService();
