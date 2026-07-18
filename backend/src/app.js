import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

import config from './config/index.js';
import logger from './config/logger.js';
import './config/cloudinary.js';
import './config/email.js';

import apiRoutes from './routes/index.js';
import { API_VERSION } from './constants/index.js';
import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction,
    crossOriginEmbedderPolicy: config.isProduction,
  })
);

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(mongoSanitize());
app.use(xss());

app.use(globalRateLimiter);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to MindSync API',
    version: config.app.version,
    documentation: `/api/${API_VERSION}`,
  });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
