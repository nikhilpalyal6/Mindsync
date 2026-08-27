import crypto from 'crypto';
import { aiRouterConfig } from '../../../config/aiRouter.config.js';
import providerHealthService from '../health/providerHealth.service.js';
import groqService from '../providers/groq.service.js';
import geminiService from '../providers/gemini.service.js';
import openrouterService from '../providers/openrouter.service.js';
import ollamaService from '../providers/ollama.service.js';
import aiQueueManager from '../utils/aiQueueManager.js';
import aiCacheManager from '../utils/aiCacheManager.js';
import { toUnifiedError } from '../utils/providerErrors.js';
import logger from '../../../config/logger.js';

class AIRouterService {
  constructor() {
    this.providersRegistry = {
      groq: groqService,
      gemini: geminiService,
      openrouter: openrouterService,
      ollama: ollamaService
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

  async _checkOllamaAvailability() {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || process.env.OLLAMA_RERANK_MODEL || 'qwen3:4b';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return { ok: false, errorType: 'OLLAMA_UNAVAILABLE', message: `Local Ollama service responded with status code ${response.status}.` };
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      const modelExists = models.some(m => m.name === model || m.name.startsWith(model + ':') || model.startsWith(m.name + ':'));
      if (!modelExists) {
        logger.warn(`[Ollama Health] Configured model "${model}" not found in local Ollama instance.`);
        return { ok: false, errorType: 'OLLAMA_MODEL_NOT_FOUND', message: `Required local AI model "${model}" is not installed.` };
      }
      
      return { ok: true };
    } catch (err) {
      clearTimeout(timeoutId);
      logger.warn(`[Ollama Health] Ollama local service unreachable at ${ollamaUrl}: ${err.message}`);
      return { ok: false, errorType: 'OLLAMA_UNAVAILABLE', message: `Local Ollama service is unreachable at ${ollamaUrl}.` };
    }
  }

  /**
   * Main entry point to route the AI request.
   */
  async routeRequest(requestParams) {
    const requestId = crypto.randomUUID().slice(0, 8);
    requestParams.requestId = requestId;
    
    // 1. Perform early Cache Lookup before entering queue
    const cacheKey = aiCacheManager.generateKey(requestParams);
    const cachedVal = aiCacheManager.get(cacheKey);
    if (cachedVal) {
      logger.info(`[AI Router][requestId=${requestId}] Cache HIT. Returning cached response immediately.`);
      logger.info(`[AI Router Telemetry][requestId=${requestId}] Status: SUCCESS | Selected: ${cachedVal.provider} (CACHE) | Score: N/A | Latency: 0ms | Cache: HIT | Queue Wait: 0ms | Retries: 0 | Fallback Used: NO | Final Provider: ${cachedVal.provider}`);
      return cachedVal;
    }

    // 2. Wrap routing flow inside the concurrency queue lock
    return await aiQueueManager.run(async (queueWaitTime) => {
      // Check cache again inside lock (double-checked locking optimization)
      const doubleCheckedVal = aiCacheManager.get(cacheKey);
      if (doubleCheckedVal) {
        logger.info(`[AI Router][requestId=${requestId}] Cache HIT (Double-Checked). Returning cached response.`);
        logger.info(`[AI Router Telemetry][requestId=${requestId}] Status: SUCCESS | Selected: ${doubleCheckedVal.provider} (CACHE) | Score: N/A | Latency: 0ms | Cache: HIT | Queue Wait: ${queueWaitTime}ms | Retries: 0 | Fallback Used: NO | Final Provider: ${doubleCheckedVal.provider}`);
        return doubleCheckedVal;
      }

      const tuning = aiRouterConfig.tuning || {};
      const requestType = this._inferRequestType(requestParams);

      let providersToEvaluate = [...aiRouterConfig.priority];

      // Enforce: Production must NEVER force a provider unless explicitly requested by an API parameter
      const explicitProvider = requestParams.provider || requestParams.forceProvider;
      if (explicitProvider && this.providersRegistry[explicitProvider.toLowerCase()]) {
        logger.info(`[AI Router][requestId=${requestId}] API parameter requested specific provider override: ${explicitProvider.toUpperCase()}`);
        providersToEvaluate = [explicitProvider.toLowerCase()];
      }

      // Log the requested provider order sequence
      const displayOrder = providersToEvaluate.map(name => aiRouterConfig.providers[name]?.name || name).join(' → ');
      console.log(`[AI Router][requestId=${requestId}] Provider order: ${displayOrder}`);

      // Check Ollama availability dynamically if in the evaluated list
      if (providersToEvaluate.includes('ollama')) {
        const model = process.env.OLLAMA_MODEL || process.env.OLLAMA_RERANK_MODEL || 'qwen3:4b';
        console.log(`[AI Router][requestId=${requestId}] Checking Ollama model ${model}`);
        
        const ollamaStatus = await this._checkOllamaAvailability();
        if (!ollamaStatus.ok) {
          console.log(`[AI Router][requestId=${requestId}] Ollama unavailable`);
          const nextIndex = providersToEvaluate.indexOf('ollama') + 1;
          if (nextIndex < providersToEvaluate.length) {
            const nextProvider = providersToEvaluate[nextIndex];
            const nextDisplayName = aiRouterConfig.providers[nextProvider]?.name || nextProvider;
            console.log(`[AI Router][requestId=${requestId}] Falling back to ${nextDisplayName}`);
          }
          
          providerHealthService.recordFailure('ollama', {
            type: ollamaStatus.errorType,
            message: ollamaStatus.message
          });
        } else {
          console.log(`[AI Router][requestId=${requestId}] Ollama AVAILABLE`);
          console.log(`[AI Router][requestId=${requestId}] Using Ollama`);
          
          // Reset health state only if it was unhealthy due to reachability/connectivity issues.
          // Do NOT reset health state if it was marked unhealthy due to formatting/intelligence errors.
          const state = providerHealthService.healthState.get('ollama');
          if (state && !state.healthy) {
            const reason = (state.failureReason || '').toLowerCase();
            if (reason.includes('unreachable') || reason.includes('refused') || reason.includes('unavailable') || reason.includes('status code')) {
              providerHealthService.recordSuccess('ollama');
            }
          }
        }
      }

      const activeQueue = [];
      const skippedList = [];

      for (const name of providersToEvaluate) {
        const providerConf = aiRouterConfig.providers[name];
        if (!providerConf) continue;

        const isEnabled = providerConf.enabled();
        const isHealthy = providerHealthService.isHealthy(name);

        if (requestParams.requestType === 'pdf_extraction' && !providerConf.metadata?.supportsPdfExtraction) {
          skippedList.push({ name, reason: 'does not support PDF text extraction' });
          continue;
        }

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

      // Sort by priority order index (user configured precedence)
      activeQueue.sort((a, b) => {
        const indexA = providersToEvaluate.indexOf(a.name);
        const indexB = providersToEvaluate.indexOf(b.name);
        return indexA - indexB;
      });

      // Log the provider queue sequence before the request starts
      console.log(`[AI Router][requestId=${requestId}] Trying providers:`);
      activeQueue.forEach((p, index) => {
        const displayName = aiRouterConfig.providers[p.name]?.name || p.name;
        console.log(`[AI Router][requestId=${requestId}] ${index + 1}. ${displayName}`);
      });
      console.log('');

      // Log skipped providers and reasons
      skippedList.forEach(item => {
        const displayName = aiRouterConfig.providers[item.name]?.name || item.name;
        console.log(`[AI Router][requestId=${requestId}] Skipping ${displayName}`);
        console.log(`[AI Router][requestId=${requestId}] Reason: ${item.reason}\n`);
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
        console.log(`[AI Router][requestId=${requestId}] Trying ${displayName.toUpperCase()}...`);

        const maxRetryLimit = tuning.retryLimit || 1;
        const totalAttempts = 1 + maxRetryLimit;

        for (let attempt = 1; attempt <= totalAttempts; attempt++) {
          const startTime = Date.now();
          
          try {
            const result = await adapter.generateResponse(requestParams);
            const latency = Date.now() - startTime;

            // Validate structured JSON if jsonMode is active
            if (requestParams.jsonMode) {
              const rawText = result.text || '';
              // 1. Strip think blocks
              let cleanText = rawText.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
              
              // 2. Remove markdown fences
              if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7);
              } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3);
              }
              if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
              }
              cleanText = cleanText.trim();

              const start = cleanText.indexOf('{');
              const end = cleanText.lastIndexOf('}');
              if (start === -1 || end === -1 || end < start) {
                logger.warn(`[AI Router JSON Parse Debug] Raw response (truncated): ${rawText.slice(0, 1000)}`);
                throw new Error('No valid JSON object boundaries found in response');
              }

              let braceCount = 0;
              let inString = false;
              let escaped = false;
              let balancedEnd = -1;
              for (let i = start; i < cleanText.length; i++) {
                const char = cleanText[i];
                if (inString) {
                  if (escaped) escaped = false;
                  else if (char === '\\') escaped = true;
                  else if (char === '"') inString = false;
                  continue;
                }
                if (char === '"') {
                  inString = true;
                  continue;
                }
                if (char === '{') {
                  braceCount++;
                } else if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    balancedEnd = i;
                    break;
                  }
                }
              }

              const finalJson = balancedEnd !== -1 ? cleanText.slice(start, balancedEnd + 1) : cleanText.slice(start, end + 1);
              
              try {
                const parsed = JSON.parse(finalJson);
                
                // Validate schema expectations for key extraction tasks
                if (requestParams.systemInstruction?.toLowerCase().includes('concepts')) {
                  if (!parsed || !Array.isArray(parsed.concepts)) {
                    throw new Error('Missing or invalid "concepts" array in response schema');
                  }
                  for (const c of parsed.concepts) {
                    if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
                      throw new Error('Concept is missing a valid name');
                    }
                    if (c.importance === undefined || typeof c.importance !== 'number' || c.importance < 0 || c.importance > 1) {
                      throw new Error(`Concept "${c.name}" has an invalid importance: ${c.importance}`);
                    }
                  }
                }
                
                // Re-serialize the cleaned/validated JSON back to result.text
                result.text = finalJson;
              } catch (parseErr) {
                logger.warn(`[AI Router JSON Parse Debug] Raw response (truncated): ${rawText.slice(0, 1000)}`);
                throw new Error(`Failed to parse extracted JSON payload: ${parseErr.message}`);
              }
            }

            // Log Success
            console.log(`[AI Router][requestId=${requestId}] ${displayName.toUpperCase()} success.`);
            console.log(`[AI Router][requestId=${requestId}] Returning response.\n`);

            // Record health metric success
            providerHealthService.recordSuccess(
              providerName, 
              latency, 
              result.usage?.total_tokens || 0
            );

            // Save to Cache store
            aiCacheManager.set(cacheKey, result);

            // Log detailed telemetry message
            logger.info(`[AI Router Telemetry][requestId=${requestId}] Status: SUCCESS | Selected: ${providerName} | Score: ${dynamicScore} | Latency: ${latency}ms | Cache: MISS | Queue Wait: ${queueWaitTime}ms | Retries: ${attempt - 1} | Fallback Used: ${fallbackUsed ? 'YES' : 'NO'} | Final Provider: ${providerName}`);

             // Add provider metadata to the return value
             result.provider = providerName;
             return result;
          } catch (err) {
            const latency = Date.now() - startTime;
            
            // Normalize error
            const unifiedError = toUnifiedError(err, providerName);
            
            // Log Failure
            console.log(`[AI Router][requestId=${requestId}] ${displayName.toUpperCase()} failed:`);
            console.log(`[AI Router][requestId=${requestId}] ${unifiedError.status} ${unifiedError.type === 'RATE_LIMIT' ? 'Rate Limit' : unifiedError.type === 'QUOTA_EXCEEDED' ? 'Quota Exceeded' : unifiedError.message}\n`);

            // Update health failure metrics
            providerHealthService.recordFailure(providerName, unifiedError);

            errorsLog.push(unifiedError);

            // If error is not recoverable (e.g. 400 validation request), abort failover instantly
            if (!unifiedError.recoverable) {
              logger.error(`[AI Router][requestId=${requestId}] Aborting routing loop: Unrecoverable validation error. Rethrowing.`);
              
              logger.info(`[AI Router Telemetry][requestId=${requestId}] Status: FAILURE | Selected: ${providerName} | Score: ${dynamicScore} | Latency: ${latency}ms | Cache: MISS | Queue Wait: ${queueWaitTime}ms | Retries: ${attempt - 1} | Fallback Used: ${fallbackUsed ? 'YES' : 'NO'} | Final Provider: ${providerName} | Reason: ${unifiedError.message}`);
              
              throw unifiedError;
            }

            // If provider error is not retryable (e.g. rate limits, billing, model not found), fallback immediately
            if (unifiedError.retryable === false) {
              logger.warn(`[AI Router][requestId=${requestId}] Provider ${providerName.toUpperCase()} is not retryable for error: ${unifiedError.type}. Skipping retries.`);
              break;
            }

            // Retry if attempts remain
            if (attempt < totalAttempts) {
              if (unifiedError.type === 'RATE_LIMIT' && unifiedError.retryAfter) {
                const sleepMs = unifiedError.retryAfter * 1000;
                if (sleepMs < 5000) {
                  logger.info(`[AI Router][requestId=${requestId}] Rate limited. Sleeping for ${sleepMs}ms before retry...`);
                  await new Promise(r => setTimeout(r, sleepMs));
                  continue;
                } else {
                  logger.warn(`[AI Router][requestId=${requestId}] Retry-after duration too long (${unifiedError.retryAfter}s). Skipping retries.`);
                  break;
                }
              }
              logger.info(`[AI Router][requestId=${requestId}] Retrying provider ${providerName.toUpperCase()} (Retry: ${attempt}/${maxRetryLimit})...`);
              continue;
            }

            // Fallback to next provider
            logger.warn(`[AI Router][requestId=${requestId}] All retry attempts failed for ${providerName.toUpperCase()}. Trying next fallback provider...`);
            break;
          }
        }
      }

      // If routing queue exhausted, compile detailed reports (Step 8)
      const errorReports = [];
      let finalCode = 'AI_EXTRACTION_UNAVAILABLE';

      const hasOllamaModelNotFound = errorsLog.some(e => e.type === 'OLLAMA_MODEL_NOT_FOUND');
      const hasOllamaUnavailable = errorsLog.some(e => e.type === 'OLLAMA_UNAVAILABLE');
      const hasQuotaExceeded = errorsLog.some(e => e.type === 'QUOTA_EXCEEDED' || e.type === 'INSUFFICIENT_CREDITS');
      const hasRateLimit = errorsLog.some(e => e.type === 'RATE_LIMIT');
      const hasAuthError = errorsLog.some(e => e.type === 'INVALID_REQUEST' || e.type === 'MODEL_NOT_FOUND' || e.type === 'INVALID_API_KEY');

      const ollamaState = providerHealthService.healthState.get('ollama');
      const ollamaSkippedOpen = skippedList.some(s => s.name === 'ollama' && s.reason === 'health circuit open');

      if (hasOllamaModelNotFound || (ollamaSkippedOpen && (ollamaState?.failureReason?.toLowerCase().includes('model') || ollamaState?.failureReason?.toLowerCase().includes('installed')))) {
        finalCode = 'OLLAMA_MODEL_NOT_FOUND';
      } else if (hasOllamaUnavailable || ollamaSkippedOpen) {
        finalCode = 'OLLAMA_UNAVAILABLE';
      } else if (hasQuotaExceeded) {
        finalCode = 'AI_QUOTA_EXCEEDED';
      } else if (hasRateLimit) {
        finalCode = 'AI_RATE_LIMITED';
      } else if (hasAuthError) {
        finalCode = 'AI_AUTH_ERROR';
      } else if (errorsLog.length === 0 && skippedList.every(s => s.reason === 'health circuit open' || s.reason === 'API key missing')) {
        finalCode = 'AI_PROVIDER_UNAVAILABLE';
      }
      
      errorsLog.forEach(e => {
        const displayName = aiRouterConfig.providers[e.provider]?.name || e.provider;
        let typeStr = e.type;
        if (e.type === 'RATE_LIMIT') typeStr = 'Rate Limit';
        else if (e.type === 'QUOTA_EXCEEDED') typeStr = 'Quota Exceeded';
        else if (e.type === 'INVALID_REQUEST') typeStr = 'Invalid Request';
        else if (e.type === 'NETWORK_ERROR') typeStr = 'Network Error';
        else if (e.type === 'TIMEOUT') typeStr = 'Timeout';
        else if (e.type === 'SERVER_ERROR') typeStr = 'Server Error';
        else if (e.type === 'OLLAMA_MODEL_NOT_FOUND') typeStr = 'Model Not Found';
        else if (e.type === 'OLLAMA_UNAVAILABLE') typeStr = 'Service Unavailable';

        errorReports.push(`${displayName}: ${e.status} ${typeStr}`);
      });

      skippedList.forEach(s => {
        const displayName = aiRouterConfig.providers[s.name]?.name || s.name;
        errorReports.push(`${displayName}: Skipped (${s.reason})`);
      });

      const finalErrorMessage = `Fallback chain failed.\n${errorReports.join('\n')}`;
      logger.error(`[AI Router][requestId=${requestId}] AI Router error: ${finalErrorMessage}`);
      
      const routerError = new Error(finalErrorMessage);
      routerError.code = finalCode;
      throw routerError;
    });
  }
}

export default new AIRouterService();
