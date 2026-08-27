import logger from '../../../config/logger.js';
import { aiRouterConfig } from '../../../config/aiRouter.config.js';

class ProviderHealthService {
  constructor() {
    // Health status store for each provider
    this.healthState = new Map();
    
    // Performance metrics store
    this.metrics = new Map();

    // Default configuration bounds (overridden dynamically from aiRouterConfig)
    this.MAX_CONSECUTIVE_FAILURES = 3;
    this.COOLDOWN_PERIOD_MS = 60 * 1000;

    if (process.env.NODE_ENV === 'development') {
      this.resetHealth();
    }
  }

  /**
   * Refreshes thresholds from the config file at runtime.
   */
  _refreshConfig() {
    this.MAX_CONSECUTIVE_FAILURES = aiRouterConfig.tuning?.failureThreshold || 3;
    this.COOLDOWN_PERIOD_MS = aiRouterConfig.tuning?.cooldownDuration || 60 * 1000;
  }

  /**
   * Initializes the state for a provider if not already present.
   */
  _initProviderState(provider) {
    this._refreshConfig();

    if (!this.healthState.has(provider)) {
      this.healthState.set(provider, {
        healthy: true,
        halfOpen: false,
        probeInProgress: false,
        consecutiveFailures: 0,
        lastFailure: null,
        retryAfter: null,
        lastSuccess: null,
        failureReason: null
      });
    }

    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        latencySum: 0,
        tokenSum: 0
      });
    }
  }

  /**
   * Checks if a provider is healthy, or eligible to accept a single recovery probe.
   */
  isHealthy(provider) {
    this._initProviderState(provider);
    const state = this.healthState.get(provider);

    if (state.healthy) {
      return true;
    }

    // Provider is currently unhealthy; check for recovery conditions
    const now = Date.now();

    // Respect Retry-After limits
    if (state.retryAfter && now < state.retryAfter) {
      const cooldownRemaining = Math.max(0, Math.round((state.retryAfter - now) / 1000));
      logger.info(`[Provider Health] provider=${provider} state=OPEN cooldownRemaining=${cooldownRemaining}s`);
      return false;
    }

    // Calculate time elapsed since the last failure
    const timeSinceLastFailure = now - (state.lastFailure ? state.lastFailure.getTime() : 0);
    const cooldownLimit = aiRouterConfig.tuning?.cooldownDuration || this.COOLDOWN_PERIOD_MS;

    if (timeSinceLastFailure > cooldownLimit) {
      // Cooldown expired; provider enters half-open recovery state
      if (!state.halfOpen) {
        state.halfOpen = true;
        state.probeInProgress = false;
        this.healthState.set(provider, state);
        logger.warn(`[Provider Health] provider=${provider} state=HALF_OPEN`);
      }

      // Allow exactly ONE concurrent probe request
      if (state.probeInProgress) {
        logger.debug(`[AI Health CB] Provider ${provider.toUpperCase()} probe already in progress. Skipping additional requests.`);
        return false;
      }

      // Lock the probe slot for this request
      state.probeInProgress = true;
      this.healthState.set(provider, state);
      logger.info(`[AI Health CB] Provider ${provider.toUpperCase()} allowing single probe request...`);
      return true;
    }

    const cooldownRemaining = Math.max(0, Math.round((cooldownLimit - timeSinceLastFailure) / 1000));
    logger.info(`[Provider Health] provider=${provider} state=OPEN cooldownRemaining=${cooldownRemaining}s`);
    return false;
  }

  /**
   * Records a successful request, resetting failures and updating latency.
   */
  recordSuccess(provider, latencyMs = 0, tokensProcessed = 0) {
    this._initProviderState(provider);
    const state = this.healthState.get(provider);
    const metric = this.metrics.get(provider);

    const wasUnhealthy = !state.healthy || state.halfOpen;

    // Reset health & breaker state on success
    state.healthy = true;
    state.halfOpen = false;
    state.probeInProgress = false;
    state.consecutiveFailures = 0;
    state.lastSuccess = new Date();
    state.failureReason = null;
    state.retryAfter = null;

    this.healthState.set(provider, state);

    // Update metrics
    metric.requestCount += 1;
    metric.successCount += 1;
    metric.latencySum += latencyMs;
    metric.tokenSum += tokensProcessed;
    this.metrics.set(provider, metric);

    if (wasUnhealthy) {
      logger.info(`[Provider Health] provider=${provider} probe=SUCCESS state=CLOSED`);
    } else {
      logger.debug(`[AI Health CB] Recorded SUCCESS for ${provider.toUpperCase()} (Latency: ${latencyMs}ms, Tokens: ${tokensProcessed})`);
    }
  }

  /**
   * Records a failed request, updating consecutive failures and checking circuit bounds.
   */
  recordFailure(provider, error) {
    this._initProviderState(provider);
    const state = this.healthState.get(provider);
    const metric = this.metrics.get(provider);

    state.lastFailure = new Date();
    state.failureReason = error?.message || 'Unknown error';

    // Handle Retry-After headers if present
    let cooldownDuration = aiRouterConfig.tuning?.cooldownDuration || this.COOLDOWN_PERIOD_MS;
    const rawError = error?.rawError || error;
    if (rawError?.headers) {
      const retryAfterHeader = rawError.headers.get?.('retry-after') || rawError.headers['retry-after'];
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds)) {
          cooldownDuration = seconds * 1000;
          state.retryAfter = Date.now() + cooldownDuration;
          logger.warn(`[AI Health CB] Respecting Retry-After header: ${seconds}s for ${provider.toUpperCase()}`);
        }
      }
    }

    const threshold = aiRouterConfig.tuning?.failureThreshold || this.MAX_CONSECUTIVE_FAILURES;

    // Handle Quota, Credits, Model, or Key errors immediately
    if (
      error?.type === 'QUOTA_EXCEEDED' || 
      error?.type === 'INSUFFICIENT_CREDITS' || 
      error?.type === 'MODEL_NOT_FOUND' || 
      error?.type === 'INVALID_API_KEY' ||
      error?.type === 'OLLAMA_UNAVAILABLE' ||
      error?.type === 'OLLAMA_MODEL_NOT_FOUND'
    ) {
      const quotaCooldown = parseInt(process.env.AI_PROVIDER_QUOTA_COOLDOWN_MS, 10) || 3600000;
      state.healthy = false;
      state.consecutiveFailures = threshold;
      state.retryAfter = Date.now() + quotaCooldown;
      logger.error(`[AI Health CB] Permanent/Quota error ${error.type} for ${provider.toUpperCase()}. Circuit opened immediately. Cooldown: ${quotaCooldown / 1000}s.`);
    }

    // Handle formatting or schema validation errors immediately to skip subsequent slow batch attempts
    const errMsg = (error?.message || '').toLowerCase();
    if (errMsg.includes('json') || errMsg.includes('boundaries') || errMsg.includes('concepts') || errMsg.includes('importance')) {
      state.healthy = false;
      state.consecutiveFailures = threshold;
      logger.warn(`[AI Health CB] Formatting/intelligence error for ${provider.toUpperCase()}. Circuit opened immediately to bypass subsequent batches.`);
    }

    // Handle probe failure vs normal execution failure
    if (state.halfOpen) {
      logger.error(`[AI Health CB] Recovery probe failed for ${provider.toUpperCase()}. Closing circuit and resetting cooldown.`);
      state.halfOpen = false;
      state.probeInProgress = false;
      // Probe fail keeps provider unhealthy and starts new cooldown period
    } else if (error?.type !== 'QUOTA_EXCEEDED') {
      state.consecutiveFailures += 1;
    }

    if (state.consecutiveFailures >= threshold || !state.healthy) {
      state.healthy = false;
      const cooldownVal = error?.type === 'QUOTA_EXCEEDED' 
        ? (parseInt(process.env.AI_PROVIDER_QUOTA_COOLDOWN_MS, 10) || 3600000) 
        : cooldownDuration;
      logger.error(`[Provider Health] provider=${provider} state=OPEN cooldownRemaining=${Math.round(cooldownVal / 1000)}s`);
    } else {
      logger.warn(`[AI Health CB] Failures count for ${provider.toUpperCase()}: ${state.consecutiveFailures}/${threshold}`);
    }

    this.healthState.set(provider, state);

    // Update metrics
    metric.requestCount += 1;
    metric.failureCount += 1;
    this.metrics.set(provider, metric);
  }

  /**
   * Resets all provider health states and metrics in memory.
   */
  resetHealth() {
    this.healthState.clear();
    this.metrics.clear();
    logger.info('[Provider Health] All provider health states and metrics reset.');
  }

  /**
   * Retrieve aggregated in-memory metrics for the dashboard.
   */
  getMetrics() {
    const list = {};
    for (const [provider, metric] of this.metrics.entries()) {
      const state = this.healthState.get(provider);
      const avgLatency = metric.successCount > 0 ? Math.round(metric.latencySum / metric.successCount) : 0;
      const successRate = metric.requestCount > 0 ? Math.round((metric.successCount / metric.requestCount) * 100) : 100;
      const avgTokens = metric.successCount > 0 ? Math.round(metric.tokenSum / metric.successCount) : 0;

      list[provider] = {
        provider,
        healthy: state?.healthy ?? true,
        halfOpen: state?.halfOpen ?? false,
        consecutiveFailures: state?.consecutiveFailures ?? 0,
        requestCount: metric.requestCount,
        successCount: metric.successCount,
        failureCount: metric.failureCount,
        successRate: `${successRate}%`,
        averageLatencyMs: avgLatency,
        averageTokens: avgTokens,
        lastSuccess: state?.lastSuccess || null,
        lastFailure: state?.lastFailure || null,
        failureReason: state?.failureReason || null
      };
    }
    return list;
  }
}

export default new ProviderHealthService();
