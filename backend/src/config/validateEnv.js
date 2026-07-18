const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ACCESS_TOKEN_EXPIRE',
  'REFRESH_TOKEN_EXPIRE',
  'CLIENT_URL',
];

const optionalEnvVars = [
  'CLOUDINARY_NAME',
  'CLOUDINARY_KEY',
  'CLOUDINARY_SECRET',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
];

/**
 * Validates required environment variables at startup.
 * Throws early if critical configuration is missing.
 */
export const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.'
    );
  }

  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(process.env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: "${process.env.NODE_ENV}". Must be one of: ${validEnvironments.join(', ')}`
    );
  }

  optionalEnvVars.forEach((key) => {
    if (!process.env[key]) {
      console.warn(`[config] Optional environment variable not set: ${key}`);
    }
  });
};
