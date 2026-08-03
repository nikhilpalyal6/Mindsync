import aiRouterService from './router/aiRouter.service.js';
import providerHealthService from './health/providerHealth.service.js';
import aiCacheManager from './utils/aiCacheManager.js';
import aiQueueManager from './utils/aiQueueManager.js';
import { aiRouterConfig } from '../../config/aiRouter.config.js';
import logger from '../../config/logger.js';

class AIProviderService {
  constructor() {
    this._logStartupDiagnostics();
  }

  _logStartupDiagnostics() {
    // 1. Print enabled status
    aiRouterConfig.priority.forEach(providerName => {
      const providerConf = aiRouterConfig.providers[providerName];
      if (providerConf) {
        console.log(`${providerConf.name} enabled: ${providerConf.enabled()}`);
      }
    });
    console.log('');

    // 2. Print detailed configuration
    aiRouterConfig.priority.forEach(providerName => {
      const providerConf = aiRouterConfig.providers[providerName];
      if (providerConf) {
        const apiKeyDetected = providerConf.apiKey() ? 'YES' : 'NO';
        const model = providerConf.model();
        console.log(`${providerConf.name}`);
        console.log(`API Key: ${apiKeyDetected}`);
        console.log(`Model: ${model}\n`);
      }
    });
  }

  getProvider() {
    return (process.env.AI_PROVIDER || 'auto').toLowerCase();
  }

  getModel() {
    const provider = this.getProvider();
    if (provider !== 'auto' && aiRouterConfig.providers[provider]) {
      return aiRouterConfig.providers[provider].model();
    }
    // Return primary active fallback model (Groq)
    return aiRouterConfig.providers.groq.model();
  }

  /**
   * Main legacy-compatible function called by all system features.
   * Delegates routing to the new robust AI router and returns a string-proxy response.
   */
  async generateAIResponse(params) {
    logger.info('[AI Provider Router] Delegating request to AI Router Service');
    return await aiRouterService.routeRequest(params);
  }

  /**
   * Optional helper to fetch internal routing metrics for dashboards.
   */
  getMetrics() {
    const providerStats = providerHealthService.getMetrics();
    const cacheStats = aiCacheManager.getStats();
    const queueLength = aiQueueManager.getQueueLength();

    let totalProviderRequests = 0;
    let totalProviderSuccesses = 0;
    let totalProviderFailures = 0;
    let latencySum = 0;
    let tokenSum = 0;
    const providerUsageCount = {};

    for (const [provider, metric] of providerHealthService.metrics.entries()) {
      totalProviderRequests += metric.requestCount;
      totalProviderSuccesses += metric.successCount;
      totalProviderFailures += metric.failureCount;
      latencySum += metric.latencySum;
      tokenSum += metric.tokenSum;
      providerUsageCount[provider] = metric.requestCount;
    }

    const totalRequests = totalProviderRequests + cacheStats.hits;
    const successfulRequests = totalProviderSuccesses + cacheStats.hits;
    const failedRequests = totalProviderFailures;

    const successPercent = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;
    const failurePercent = totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 100) : 0;
    const averageLatency = totalProviderSuccesses > 0 ? Math.round(latencySum / totalProviderSuccesses) : 0;
    const averageTokens = totalProviderSuccesses > 0 ? Math.round(tokenSum / totalProviderSuccesses) : 0;

    return {
      global: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: `${successPercent}%`,
        failureRate: `${failurePercent}%`,
        averageLatencyMs: averageLatency,
        averageTokens: averageTokens,
        currentQueueLength: queueLength,
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        providerUsageCount
      },
      providers: providerStats
    };
  }
}

export default new AIProviderService();
