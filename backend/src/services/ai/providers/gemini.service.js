import { GoogleGenerativeAI } from '@google/generative-ai';
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

class GeminiService {
  constructor() {
    this.providerName = 'gemini';
    this._client = null;
  }

  _getClient() {
    if (this._client) return this._client;

    const apiKey = aiRouterConfig.providers.gemini.apiKey();
    if (!apiKey) {
      throw new Error('Gemini API Key is not configured.');
    }
    this._client = new GoogleGenerativeAI(apiKey);
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
    const modelName = aiRouterConfig.providers.gemini.model();

    const activeSystemPrompt = systemPrompt || systemInstruction || 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot.';

    try {
      const client = this._getClient();
      
      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens
      };

      if (jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: activeSystemPrompt,
        generationConfig
      });

      let responseText = '';
      let usageMetadata = {};

      logger.info(`[Gemini Provider] Dispatching request with model ${modelName}`);

      // Handle chat messages (history) vs simple single-shot prompt
      if (messages && Array.isArray(messages) && messages.length > 0) {
        const formattedHistory = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        const currentTurn = formattedHistory.pop();
        const promptText = currentTurn?.parts[0]?.text || '';

        const chat = model.startChat({
          history: formattedHistory
        });

        const result = await chat.sendMessage(promptText);
        const response = await result.response;
        responseText = response.text() || '';
        usageMetadata = response.usageMetadata || {};
      } else {
        const promptText = prompt || '';
        const result = await model.generateContent(promptText);
        const response = await result.response;
        responseText = response.text() || '';
        usageMetadata = response.usageMetadata || {};
      }

      const latency = Date.now() - startTime;
      const inputTokens = usageMetadata.promptTokenCount || 0;
      const outputTokens = usageMetadata.candidatesTokenCount || 0;

      return normalizeResponse({
        provider: this.providerName,
        model: modelName,
        text: responseText.trim(),
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: usageMetadata.totalTokenCount || (inputTokens + outputTokens)
        },
        finishReason: 'stop',
        latency,
        inputTokens,
        outputTokens
      });
    } catch (err) {
      const errorMsg = err.message || '';
      const statusCode = err.status || err.statusCode || null;

      logger.error(`[Gemini Provider] Error: ${errorMsg}`);

      // Map to standard error types
      if (errorMsg.includes('400') || errorMsg.includes('InvalidArgument') || errorMsg.includes('API_KEY_INVALID')) {
        throw new AIRequestValidationError(errorMsg, this.providerName, err);
      }
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate limit')) {
        throw new AIRateLimitError(errorMsg, this.providerName, err);
      }
      if (errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('deadline')) {
        throw new AITimeoutError(errorMsg, this.providerName, err);
      }
      if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('connect') || errorMsg.toLowerCase().includes('dns')) {
        throw new AINetworkError(errorMsg, this.providerName, err);
      }
      if (errorMsg.includes('500') || errorMsg.includes('503') || errorMsg.includes('INTERNAL')) {
        throw new AIServerError(errorMsg, this.providerName, 500, err);
      }

      throw new AIProviderError(errorMsg, this.providerName, statusCode, err);
    }
  }
}

export default new GeminiService();
