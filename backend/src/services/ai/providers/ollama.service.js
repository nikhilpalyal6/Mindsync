import { aiRouterConfig } from '../../../config/aiRouter.config.js';
import { normalizeResponse } from '../utils/providerNormalizer.js';
import {
  AIRequestValidationError,
  AIRateLimitError,
  AIQuotaExceededError,
  AIServerError,
  AITimeoutError,
  AINetworkError,
  AIProviderError
} from '../utils/providerErrors.js';
import logger from '../../../config/logger.js';

class OllamaService {
  constructor() {
    this.providerName = 'ollama';
  }

  async generateResponse({
    prompt,
    systemPrompt,
    messages,
    systemInstruction,
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
    requestId = 'N/A'
  }) {
    const startTime = Date.now();

    const ollamaUrl =
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    const model =
      process.env.OLLAMA_MODEL ||
      process.env.OLLAMA_RERANK_MODEL ||
      'qwen3:4b';

    const timeoutMs =
      parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 120000;

    const numCtx =
      parseInt(process.env.OLLAMA_NUM_CTX, 10) || 2048;

    const startTimeStr = new Date(startTime).toISOString();

    logger.info(
      `[Ollama Provider][requestId=${requestId}] Request started - ` +
      `Model: ${model}, Timeout: ${timeoutMs}ms, ` +
      `Start Time: ${startTimeStr}`
    );

    const activeSystemPrompt =
      systemPrompt ||
      systemInstruction ||
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot.';

    // ---------------------------------------------------------
    // Build request
    // ---------------------------------------------------------

    let url = `${ollamaUrl}/api/generate`;

    let requestBody = {
      model,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
        num_ctx: numCtx
      }
    };

    // If messages are provided, use Ollama /api/chat
    if (messages && Array.isArray(messages) && messages.length > 0) {
      url = `${ollamaUrl}/api/chat`;

      requestBody.messages = [
        {
          role: 'system',
          content: activeSystemPrompt
        },
        ...messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];
    } else {
      // Otherwise use /api/generate
      requestBody.prompt = prompt || '';
      requestBody.system = activeSystemPrompt;
    }

    // Enable JSON format mode for Ollama
    if (jsonMode) {
      requestBody.format = 'json';
    }

    // ---------------------------------------------------------
    // Diagnostic request information
    // ---------------------------------------------------------

    const messageCount = requestBody.messages?.length || 0;
    let promptLength = requestBody.prompt?.length || 0;
    let systemLength = requestBody.system?.length || 0;
    if (requestBody.messages) {
      const systemMsg = requestBody.messages.find(m => m.role === 'system');
      if (systemMsg) systemLength = systemMsg.content?.length || 0;
      const userMsg = requestBody.messages.find(m => m.role === 'user');
      if (userMsg) promptLength = userMsg.content?.length || 0;
    }

    logger.info(
      `[Ollama Provider][requestId=${requestId}] ` +
      `Request configuration: ${JSON.stringify({
        url,
        model,
        messageCount,
        promptLength,
        systemLength,
        numCtx,
        numPredict: maxTokens,
        temperature,
        jsonMode
      })}`
    );

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      logger.warn(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Request timeout reached after ${timeoutMs}ms`
      );

      controller.abort();
    }, timeoutMs);

    try {
      // -------------------------------------------------------
      // Verify Ollama availability
      // -------------------------------------------------------

      logger.info(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Checking model ${model} existence...`
      );

      try {
        const tagsResponse = await fetch(
          `${ollamaUrl}/api/tags`,
          {
            signal: controller.signal
          }
        );

        if (!tagsResponse.ok) {
          throw new Error('OLLAMA_UNAVAILABLE');
        }

        const data = await tagsResponse.json();

        const models = data.models || [];

        const modelExists = models.some(
          (m) =>
            m.name === model ||
            m.name.startsWith(model + ':') ||
            model.startsWith(m.name + ':')
        );

        logger.info(
          `[Ollama Provider][requestId=${requestId}] ` +
          `Available models: ${models.map((m) => m.name).join(', ')}`
        );

        if (!modelExists) {
          throw new Error('OLLAMA_MODEL_NOT_FOUND');
        }

        logger.info(
          `[Ollama Provider][requestId=${requestId}] ` +
          `Model ${model} confirmed available`
        );
      } catch (err) {
        if (err.message === 'OLLAMA_MODEL_NOT_FOUND') {
          throw new AIProviderError(
            `Required local AI model "${model}" is not installed.`,
            this.providerName,
            404,
            err
          );
        }

        if (err.name === 'AbortError') {
          throw err;
        }

        throw new AIProviderError(
          `Local Ollama service is unreachable at ${ollamaUrl}.`,
          this.providerName,
          503,
          err
        );
      }

      // -------------------------------------------------------
      // Send actual generation request
      // -------------------------------------------------------

      logger.info(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Dispatching request to ${url} with model ${model}`
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      // -------------------------------------------------------
      // IMPORTANT:
      // Read the response body when Ollama returns an error.
      // This tells us WHY Ollama returned 400/500/etc.
      // -------------------------------------------------------

      if (!response.ok) {
        const errorBody = await response.text();

        logger.error(
          `[Ollama Provider][requestId=${requestId}] ` +
          `HTTP ERROR ${response.status}`
        );

        logger.error(
          `[Ollama Provider][requestId=${requestId}] ` +
          `Ollama error response: ${errorBody}`
        );

        throw new Error(
          `Ollama responded with status code ${response.status}: ${errorBody}`
        );
      }

      // Request succeeded, so the timeout is no longer needed.
      clearTimeout(timeoutId);

      // -------------------------------------------------------
      // Parse successful response
      // -------------------------------------------------------

      const resBody = await response.json();

      logger.info(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Raw response received successfully`
      );

      let text = '';

      if (url.endsWith('/chat')) {
        text = resBody.message?.content || '';
      } else {
        text = resBody.response || '';
      }

      // -------------------------------------------------------
      // Validate returned text
      // -------------------------------------------------------

      if (!text || !text.trim()) {
        logger.warn(
          `[Ollama Provider][requestId=${requestId}] ` +
          `Ollama returned an empty response`
        );

        throw new Error(
          'Ollama returned an empty response'
        );
      }

      logger.info(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Raw response text snippet (truncated): ${text.slice(0, 500)}`
      );

      const latency = Date.now() - startTime;

      const completionTimeStr =
        new Date().toISOString();

      logger.info(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Request succeeded - ` +
        `Completion Time: ${completionTimeStr}, ` +
        `Latency: ${latency}ms, ` +
        `Fallback: NO`
      );

      // -------------------------------------------------------
      // Token estimation
      // -------------------------------------------------------

      const inputText =
        prompt ||
        messages
          ?.map((m) => m.content || '')
          .join('\n') ||
        '';

      const inputTokens =
        Math.round(inputText.length / 4);

      const outputTokens =
        Math.round(text.length / 4);

      // -------------------------------------------------------
      // Return normalized response
      // -------------------------------------------------------

      return normalizeResponse({
        provider: this.providerName,
        model,
        text: text.trim(),

        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens:
            inputTokens + outputTokens
        },

        finishReason: 'stop',
        latency,
        inputTokens,
        outputTokens
      });

    } catch (err) {

      // Always clear timeout
      clearTimeout(timeoutId);

      const latency =
        Date.now() - startTime;

      const completionTimeStr =
        new Date().toISOString();

      logger.error(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Request failed - ` +
        `Completion Time: ${completionTimeStr}, ` +
        `Latency: ${latency}ms, ` +
        `Fallback: YES`
      );

      logger.error(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Error name: ${err.name}`
      );

      logger.error(
        `[Ollama Provider][requestId=${requestId}] ` +
        `Error message: ${err.message}`
      );

      // -------------------------------------------------------
      // Timeout
      // -------------------------------------------------------

      if (err.name === 'AbortError') {
        throw new AITimeoutError(
          `Request timed out after ${timeoutMs / 1000}s`,
          this.providerName,
          err
        );
      }

      // -------------------------------------------------------
      // Model not found
      // -------------------------------------------------------

      if (
        err.message?.includes('status code 404') ||
        err.message?.includes('model not found') ||
        err.message?.includes('MODEL_NOT_FOUND')
      ) {
        throw new AIProviderError(
          `Model not found: ${model}`,
          this.providerName,
          404,
          err
        );
      }

      // -------------------------------------------------------
      // Rate limit
      // -------------------------------------------------------

      if (
        err.message?.includes('status code 429') ||
        err.message?.toLowerCase().includes('rate limit')
      ) {
        throw new AIRateLimitError(
          err.message,
          this.providerName,
          err
        );
      }

      // -------------------------------------------------------
      // Server error
      // -------------------------------------------------------

      if (
        err.message?.includes('status code 500') ||
        err.message?.includes('status code 502') ||
        err.message?.includes('status code 503')
      ) {
        throw new AIServerError(
          err.message,
          this.providerName,
          err
        );
      }

      // -------------------------------------------------------
      // Preserve existing AI errors
      // -------------------------------------------------------

      if (
        err instanceof AIProviderError ||
        err instanceof AITimeoutError ||
        err instanceof AIRateLimitError ||
        err instanceof AIQuotaExceededError ||
        err instanceof AIServerError ||
        err instanceof AINetworkError ||
        err instanceof AIRequestValidationError
      ) {
        throw err;
      }

      // -------------------------------------------------------
      // Fallback network error
      // -------------------------------------------------------

      throw new AINetworkError(
        err.message || 'Unknown Ollama error',
        this.providerName,
        err
      );
    }
  }
}

export default new OllamaService();