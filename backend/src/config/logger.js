import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

const transports = [];

if (config.isDevelopment) {
  transports.push(
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logsDir, 'development.log'),
      format: logFormat,
    })
  );
}

if (config.isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'production.log'),
      format: logFormat,
    })
  );
}

transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
  })
);

const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : 'info',
  transports,
  exitOnError: false,
});

export default logger;
