import crypto from 'crypto';
import logger from '../../../config/logger.js';
import { aiRouterConfig } from '../../../config/aiRouter.config.js';

class AICacheManager {
  constructor() {
    this.store = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Prune expired cache items every 5 minutes
    setInterval(() => this.prune(), 5 * 60 * 1000).unref?.();
  }

  /**
   * Generates a unique, model-independent and provider-independent fingerprint hash key.
   */
  generateKey(params) {
    const { messages, systemInstruction, prompt, systemPrompt, temperature = 0.7, jsonMode = false } = params;

    // 1. Extract prompt text
    let promptText = prompt || '';
    if (messages && Array.isArray(messages)) {
      promptText = messages.map(m => `${m.role}:${m.content}`).join('|');
    }

    // 2. Extract system instruction
    const systemText = systemPrompt || systemInstruction || '';

    // 3. Compute MD5 hashes
    const promptHash = crypto.createHash('md5').update(promptText).digest('hex');
    const systemHash = crypto.createHash('md5').update(systemText).digest('hex');

    // 4. Build fingerprint key
    return `ai_cache:${promptHash}:${systemHash}:${temperature}:${jsonMode ? 'json' : 'text'}`;
  }

  /**
   * Retrieve cached value if valid and not expired.
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.cacheMisses += 1;
      return null;
    }

    const now = Date.now();
    if (now > item.expiresAt) {
      logger.debug(`[AI Cache] Expired cache hit for key: ${key}. Pruning.`);
      this.store.delete(key);
      this.cacheMisses += 1;
      return null;
    }

    this.cacheHits += 1;
    logger.info(`[AI Cache] Cache hit for key: ${key}`);
    return item.value;
  }

  /**
   * Write response to the cache store.
   */
  set(key, value) {
    const ttl = aiRouterConfig.tuning?.cacheTTL || 30 * 60 * 1000; // default 30 minutes
    
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
    
    logger.debug(`[AI Cache] Cached response under key: ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Clear all items in cache.
   */
  clear() {
    this.store.clear();
    logger.info('[AI Cache] Cache cleared.');
  }

  /**
   * Prune expired items.
   */
  prune() {
    const now = Date.now();
    let prunedCount = 0;
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
        prunedCount += 1;
      }
    }
    if (prunedCount > 0) {
      logger.info(`[AI Cache] Pruned ${prunedCount} expired items from runtime cache.`);
    }
  }

  getStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.store.size
    };
  }
}

export default new AICacheManager();
