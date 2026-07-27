import dotenv from 'dotenv';
dotenv.config();

export const validateAIConfig = () => {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.MODEL_NAME || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash');
  const temperature = parseFloat(process.env.TEMPERATURE || '0.7');
  const maxOutputTokens = parseInt(process.env.MAX_OUTPUT_TOKENS || '4096', 10);

  if (provider === 'groq' && !groqApiKey) {
    console.warn('⚠️ GROQ_API_KEY is not defined in environment variables.');
  }

  if (provider === 'gemini' && !geminiApiKey) {
    console.warn('⚠️ GEMINI_API_KEY is not defined in environment variables.');
  }

  return {
    provider,
    geminiApiKey,
    groqApiKey,
    modelName,
    temperature,
    maxOutputTokens,
  };
};

export const aiConfig = validateAIConfig();
export default aiConfig;
