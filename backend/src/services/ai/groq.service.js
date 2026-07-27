import Groq from 'groq-sdk';
import { aiConfig } from '../../config/ai.config.js';
import logger from '../../config/logger.js';

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || aiConfig.groqApiKey;
    this.modelName = process.env.MODEL_NAME || aiConfig.modelName || 'llama-3.3-70b-versatile';
    if (this.apiKey) {
      this.groq = new Groq({ apiKey: this.apiKey });
    }
  }

  async generateResponse({ messages, systemInstruction }) {
    if (!this.apiKey) {
      this.apiKey = process.env.GROQ_API_KEY || aiConfig.groqApiKey;
    }

    if (!this.groq && this.apiKey) {
      this.groq = new Groq({ apiKey: this.apiKey });
    }

    if (!this.groq) {
      throw new Error('Groq API key is not configured.');
    }

    const systemPrompt = systemInstruction || 
      'You are MindSync AI, an expert, encouraging, and clear AI learning co-pilot. ' +
      'Your role is to explain concepts clearly, simplify complex ideas, teach step-by-step, ' +
      'provide practical examples, answer student questions, and foster an active learning environment.';

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }))
    ];

    const modelsToTry = [
      process.env.MODEL_NAME || this.modelName || 'llama-3.3-70b-versatile',
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama3-70b-8192',
      'mixtral-8x7b-32768'
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        logger.info(`[Groq Service] Sending request using model: ${modelName}`);
        const chatCompletion = await this.groq.chat.completions.create({
          messages: formattedMessages,
          model: modelName,
          temperature: aiConfig.temperature || 0.7,
          max_tokens: aiConfig.maxOutputTokens || 4096,
        });

        const responseText = chatCompletion.choices[0]?.message?.content;

        if (responseText && responseText.trim()) {
          return responseText.trim();
        }
      } catch (err) {
        lastError = err;
        logger.warn(`[Groq Service] Groq model ${modelName} call failed: ${err.message}. Trying fallback...`);
      }
    }

    throw new Error(lastError ? lastError.message : 'Failed to obtain response from Groq API.');
  }
}

export default new GroqService();
