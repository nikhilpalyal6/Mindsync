import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { connectDB, disconnectDB } from './database/connection.js';
import { verifyEmailConnection } from './config/email.js';

let server;

const startServer = async () => {
  try {
    await connectDB();

    const emailReady = await verifyEmailConnection();
    if (emailReady) {
      logger.info('Email service is configured and ready');
    } else {
      logger.warn('Email service is not ready. Verification and reset emails may fail.');
    }

    server = app.listen(config.port, () => {
      logger.info(`MindSync server running in ${config.env} mode on port ${config.port}`);
      logger.info(`Health check: http://localhost:${config.port}/api/v1/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
  if (config.isProduction) {
    gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

startServer();
