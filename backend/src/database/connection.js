import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../config/logger.js';

let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

mongoose.set('strictQuery', true);

const connectionOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
};

const handleConnectionError = (error) => {
  isConnected = false;
  logger.error('MongoDB connection error', { error: error.message });

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts += 1;
    logger.warn(`Attempting MongoDB reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    setTimeout(() => {
      connectDB().catch(() => {});
    }, RECONNECT_DELAY_MS);
  } else {
    logger.error('Max MongoDB reconnect attempts reached');
  }
};

const registerEventHandlers = () => {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    reconnectAttempts = 0;
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', handleConnectionError);

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    reconnectAttempts = 0;
    logger.info('MongoDB reconnected');
  });
};

export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    registerEventHandlers();
    await mongoose.connect(config.mongodb.uri, connectionOptions);
    return mongoose.connection;
  } catch (error) {
    handleConnectionError(error);
    throw error;
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed gracefully');
  }
};

export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: states[mongoose.connection.readyState] || 'unknown',
    isConnected: mongoose.connection.readyState === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

export default connectDB;
