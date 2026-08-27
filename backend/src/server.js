import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';
import { connectDB, disconnectDB } from './database/connection.js';
import { verifyEmailConnection } from './config/email.js';
import { logEvent } from './utils/auditLogger.js';
import { runChunkCountBackfill } from './knowledge/scripts/backfillChunkCounts.js';
import { initStudyRoomRealtime } from './studyRooms/realtime/studyRoom.socket.js';
import { startRoomScheduler, stopRoomScheduler } from './studyRooms/utils/scheduler.js';

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

    server = app.listen(config.port, async () => {
      logger.info(`MindSync server running in ${config.env} mode on port ${config.port}`);
      logger.info(`Health check: http://localhost:${config.port}/api/v1/health`);

      // Initialize realtime ws layer for Study Rooms
      initStudyRoomRealtime(server);

      // Start the scheduled rooms auto-start cron/reconciler
      startRoomScheduler();

      // Asynchronously trigger legacy chunk count backfill migration
      setImmediate(() => {
        runChunkCountBackfill().catch((error) => {
          logger.error('Chunk count backfill failed', { error: error.message });
        });
      });

      // Log system initialization events
      await logEvent({
        category: 'system_event',
        action: 'Server Start',
        description: `MindSync server started successfully on port ${config.port} in ${config.env} mode.`,
        status: 'success',
        role: 'SYSTEM'
      });

      if (emailReady) {
        await logEvent({
          category: 'system_event',
          action: 'Email Connected',
          description: 'Nodemailer SMTP mail transporter connected successfully.',
          status: 'success',
          role: 'SYSTEM'
        });
      }

      if (config.cloudinary?.cloudName && config.cloudinary?.apiKey && config.cloudinary?.apiSecret) {
        await logEvent({
          category: 'system_event',
          action: 'Cloudinary Connected',
          description: 'Cloudinary media upload service credentials verified.',
          status: 'success',
          role: 'SYSTEM'
        });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  try {
    await logEvent({
      category: 'system_event',
      action: 'Server Shutdown',
      description: `Graceful server shutdown initiated via ${signal} signal.`,
      status: 'warning',
      role: 'SYSTEM'
    });
  } catch (err) {}

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        stopRoomScheduler();
      } catch (err) {}
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
