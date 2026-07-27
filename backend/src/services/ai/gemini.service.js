import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiConfig } from '../../config/ai.config.js';
import logger from '../../config/logger.js';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || aiConfig.geminiApiKey;
    this.modelName = process.env.MODEL_NAME || aiConfig.modelName || 'gemini-2.5-flash';
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  async generateResponse({ messages, systemInstruction }) {
    if (!this.apiKey) {
      this.apiKey = process.env.GEMINI_API_KEY || aiConfig.geminiApiKey;
    }

    if (!this.genAI && this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    if (!this.genAI || !this.apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const systemPrompt = systemInstruction || 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot. ' +
      'Your role is to explain concepts clearly, simplify complex ideas, teach step-by-step, ' +
      'provide practical examples, answer student questions, and foster an active learning environment.';

    const formattedHistory = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const currentTurn = formattedHistory.pop();
    const promptText = currentTurn?.parts[0]?.text || '';

    const modelsToTry = [
      this.modelName,
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-pro'
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        logger.info(`[Gemini Service] Sending request using model: ${modelName}`);
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: aiConfig.temperature || 0.7,
            maxOutputTokens: aiConfig.maxOutputTokens || 4096,
          },
        });

        const chat = model.startChat({
          history: formattedHistory,
        });

        const result = await chat.sendMessage(promptText);
        const response = await result.response;
        const responseText = response.text();

        if (responseText && responseText.trim()) {
          return responseText.trim();
        }
      } catch (err) {
        lastError = err;
        logger.warn(`[Gemini Service] Gemini model ${modelName} call failed: ${err.message}. Trying fallback...`);
      }
    }

    throw new Error(lastError ? lastError.message : 'Failed to obtain response from Gemini API.');
  }
}

export default new GeminiService();
