import geminiService from './gemini.service.js';
import groqService from './groq.service.js';
import { aiConfig } from '../../config/ai.config.js';
import logger from '../../config/logger.js';

class AIProviderService {
  getProvider() {
    return (process.env.AI_PROVIDER || aiConfig.provider || 'groq').toLowerCase();
  }

  getModel() {
    const provider = this.getProvider();
    return process.env.MODEL_NAME || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash');
  }

  async generateAIResponse({ messages, systemInstruction }) {
    const activeProvider = this.getProvider();
    const activeModel = this.getModel();

    logger.info(`[AI Provider Router] Selected AI Provider: ${activeProvider.toUpperCase()}`);
    logger.info(`[AI Provider Router] Selected Model: ${activeModel}`);

    switch (activeProvider) {
      case 'groq':
        logger.info('[AI Provider Router] Provider implementation called: groqService.generateResponse');
        return await groqService.generateResponse({ messages, systemInstruction });

      case 'gemini':
        logger.info('[AI Provider Router] Provider implementation called: geminiService.generateResponse');
        return await geminiService.generateResponse({ messages, systemInstruction });

      default:
        logger.info('[AI Provider Router] Provider implementation called: groqService.generateResponse (default)');
        return await groqService.generateResponse({ messages, systemInstruction });
    }
  }
}

export default new AIProviderService();
