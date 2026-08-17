import dotenv from 'dotenv';
dotenv.config();

export const aiRouterConfig = {
  // Global priority sequence. Providers will be tried in this order.
  priority: ['groq', 'gemini', 'openrouter'],
  
  // Tuning parameters for routing, queue, and cache
  tuning: {
    priorityWeights: {
      successRate: 10,       // score weight per % of success rate
      latency: -0.2,        // score weight per ms of average latency (negative)
      failures: -50,         // penalty score weight per failure count (negative)
      healthy: 500,          // bonus score if provider is healthy
      halfOpen: 100          // bonus score if provider is in half-open probe state
    },
    retryLimit: 1,           // max retries per provider
    cacheTTL: 30 * 60 * 1000, // 30 minutes in ms
    queueSize: 3,            // max concurrent AI requests
    failureThreshold: 3,     // max consecutive failures before opening circuit
    cooldownDuration: 60 * 1000 // circuit breaker cooldown before half-open state (1 minute)
  },

  // Provider detailed specs
  providers: {
    groq: {
      name: 'Groq',
      enabled: () => process.env.GROQ_ENABLED !== 'false' && !!process.env.GROQ_API_KEY,
      apiKey: () => process.env.GROQ_API_KEY,
      model: () => process.env.MODEL_NAME || 'llama-3.3-70b-versatile',
      metadata: {
        supportsJSON: true,
        supportsStreaming: true,
        supportsLongContext: false,
        supportsVision: false,
        supportsPdfExtraction: false,
        supportsOcr: false,
        supportsDocumentInput: false,
        supportsTextGeneration: true,
        maxContext: 32768,
        maxOutputTokens: 4096,
        preferredForQuiz: true,
        preferredForSummary: false,
        preferredForTutor: false,
        preferredForRAG: false,
        preferredForChat: true
      }
    },
    gemini: {
      name: 'Gemini',
      enabled: () => process.env.GEMINI_ENABLED !== 'false' && !!process.env.GEMINI_API_KEY,
      apiKey: () => process.env.GEMINI_API_KEY,
      model: () => process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      metadata: {
        supportsJSON: true,
        supportsStreaming: true,
        supportsLongContext: true,
        supportsVision: true,
        supportsPdfExtraction: true,
        supportsOcr: true,
        supportsDocumentInput: true,
        supportsTextGeneration: true,
        maxContext: 1048576,
        maxOutputTokens: 8192,
        preferredForQuiz: false,
        preferredForSummary: true,
        preferredForTutor: true,
        preferredForRAG: true,
        preferredForChat: true
      }
    },
    openrouter: {
      name: 'OpenRouter',
      enabled: () => process.env.OPENROUTER_ENABLED !== 'false' && !!process.env.OPENROUTER_API_KEY,
      apiKey: () => process.env.OPENROUTER_API_KEY,
      model: () => process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash',
      metadata: {
        supportsJSON: true,
        supportsStreaming: true,
        supportsLongContext: true,
        supportsVision: true,
        supportsPdfExtraction: true,
        supportsOcr: true,
        supportsDocumentInput: true,
        supportsTextGeneration: true,
        maxContext: 1048576,
        maxOutputTokens: 8192,
        preferredForQuiz: false,
        preferredForSummary: false,
        preferredForTutor: false,
        preferredForRAG: false,
        preferredForChat: false
      }
    }
  }
};

export default aiRouterConfig;
