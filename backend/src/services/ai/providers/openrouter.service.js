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

class OpenRouterService {
  constructor() {
    this.providerName = 'openrouter';
    this.TIMEOUT_MS = 30000; // 30 seconds timeout
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
    const apiKey = aiRouterConfig.providers.openrouter.apiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API Key is not configured.');
    }

    const model = aiRouterConfig.providers.openrouter.model();

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

    // 2. Set up fetch request options
    const requestBody = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      logger.info(`[OpenRouter Provider] Dispatching request with model ${model}`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://mindsync.ai',
          'X-Title': 'MindSync'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        
        logger.error(`[OpenRouter Provider] Error Response (Status: ${statusCode}): ${errorText}`);

        if (statusCode === 400 || errorText.includes('invalid_request_error')) {
          throw new AIRequestValidationError(errorText, this.providerName, new Error(errorText));
        }
        if (statusCode === 429 || errorText.toLowerCase().includes('rate limit') || errorText.toLowerCase().includes('quota') || errorText.toLowerCase().includes('credits')) {
          throw new AIRateLimitError(errorText, this.providerName, new Error(errorText));
        }
        if (statusCode >= 500) {
          throw new AIServerError(errorText, this.providerName, statusCode, new Error(errorText));
        }
        throw new AIProviderError(errorText, this.providerName, statusCode, new Error(errorText));
      }

      const responseData = await response.json();
      const text = responseData.choices?.[0]?.message?.content || '';
      const usage = responseData.usage || {};
      const latency = Date.now() - startTime;

      return normalizeResponse({
        provider: this.providerName,
        model,
        text,
        usage,
        finishReason: responseData.choices?.[0]?.finish_reason || 'stop',
        latency,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0
      });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof AIProviderError) {
        throw err;
      }

      const errorMsg = err.message || '';
      logger.error(`[OpenRouter Provider] Fetch exception: ${errorMsg}`);

      if (err.name === 'AbortError') {
        throw new AITimeoutError(`Request timed out after ${this.TIMEOUT_MS / 1000}s`, this.providerName, err);
      }

      throw new AINetworkError(errorMsg, this.providerName, err);
    }
  }
}

export default new OpenRouterService();
