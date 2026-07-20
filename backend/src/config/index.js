import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from './validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

validateEnv();

const parsePort = (value) => {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT: "${value}"`);
  }
  return port;
};

const config = Object.freeze({
  env: process.env.NODE_ENV,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  port: parsePort(process.env.PORT),
  clientUrl: process.env.CLIENT_URL,

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpire: process.env.ACCESS_TOKEN_EXPIRE,
    refreshExpire: process.env.REFRESH_TOKEN_EXPIRE,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_NAME || '',
    apiKey: process.env.CLOUDINARY_KEY || '',
    apiSecret: process.env.CLOUDINARY_SECRET || '',
    isConfigured: Boolean(
      process.env.CLOUDINARY_NAME &&
        process.env.CLOUDINARY_KEY &&
        process.env.CLOUDINARY_SECRET
    ),
  },

  email: {
    host: process.env.EMAIL_HOST || '',
    port: Number.parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD,
      isConfigured: Boolean(
        process.env.EMAIL_HOST &&
          process.env.EMAIL_USER &&
          process.env.EMAIL_PASSWORD
      ),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      isConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REDIRECT_URI
      ),
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      redirectUri: process.env.APPLE_REDIRECT_URI,
      isConfigured: Boolean(
        process.env.APPLE_CLIENT_ID &&
          process.env.APPLE_TEAM_ID &&
          process.env.APPLE_KEY_ID &&
          process.env.APPLE_PRIVATE_KEY &&
          process.env.APPLE_REDIRECT_URI
      ),
    },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    authMax: 10,
  },

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: {
      access: 15 * 60 * 1000,
      refresh: 7 * 24 * 60 * 60 * 1000,
    },
  },

  app: {
    name: 'MindSync',
    version: '1.0.0',
  },
});

export default config;
