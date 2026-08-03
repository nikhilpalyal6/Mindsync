import Groq from 'groq-sdk';
import { aiRouterConfig } from '../../../config/aiRouter.config.js';
import { normalizeResponse } from '../utils/providerNormalizer.js';
import {
  AIRequestValidationError,
  AIRateLimitError,
  AIServerError,
  AITimeoutError,
  AINetworkError,
  AIProviderError
} from '../utils/providerErrors.js';
import logger from '../../../config/logger.js';

class GroqService {
  constructor() {
    this.providerName = 'groq';
    this._client = null;
  }

  _getClient() {
    if (this._client) return this._client;

    const apiKey = aiRouterConfig.providers.groq.apiKey();
    if (!apiKey) {
      throw new Error('Groq API Key is not configured.');
    }
    this._client = new Groq({ apiKey });
    return this._client;
  }

  async generateResponse({
    prompt,
    systemPrompt,
    messages,
    systemInstruction,
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false
  }) {
    const startTime = Date.now();
    const model = aiRouterConfig.providers.groq.model();

    // 1. Build messages array compatibly
    let formattedMessages = [];
    const activeSystemPrompt = systemPrompt || systemInstruction || 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot.';

    if (messages && Array.isArray(messages)) {
      formattedMessages = [
        { role: 'system', content: activeSystemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];
    } else {
      formattedMessages = [
        { role: 'system', content: activeSystemPrompt },
        { role: 'user', content: prompt || '' }
      ];
    }

    try {
      const client = this._getClient();
      const options = {
        messages: formattedMessages,
        model,
        temperature,
        max_tokens: maxTokens
      };

      if (jsonMode) {
        options.response_format = { type: 'json_object' };
      }

      logger.info(`[Groq Provider] Dispatching request with model ${model}`);
      const chatCompletion = await client.chat.completions.create(options);
      const text = chatCompletion.choices[0]?.message?.content || '';
      const usage = chatCompletion.usage || {};
      const latency = Date.now() - startTime;

      return normalizeResponse({
        provider: this.providerName,
        model,
        text,
        usage,
        finishReason: chatCompletion.choices[0]?.finish_reason || 'stop',
        latency,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0
      });
    } catch (err) {
      const errorMsg = err.message || '';
      const statusCode = err.status || err.statusCode || (err.response && err.response.status) || null;

      logger.error(`[Groq Provider] Error (Status: ${statusCode}): ${errorMsg}`);

      // Map to standard error types
      if (statusCode === 400 || errorMsg.includes('invalid_request_error')) {
        throw new AIRequestValidationError(errorMsg, this.providerName, err);
      }
      if (statusCode === 429 || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota')) {
        throw new AIRateLimitError(errorMsg, this.providerName, err);
      }
      if (err.name === 'AbortError' || errorMsg.toLowerCase().includes('timeout')) {
        throw new AITimeoutError(errorMsg, this.providerName, err);
      }
      if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('connect')) {
        throw new AINetworkError(errorMsg, this.providerName, err);
      }
      if (statusCode >= 500) {
        throw new AIServerError(errorMsg, this.providerName, statusCode, err);
      }

      throw new AIProviderError(errorMsg, this.providerName, statusCode, err);
    }
  }
}

export default new GroqService();
