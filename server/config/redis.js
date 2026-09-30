import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client = null;

const createMockRedis = () => ({
  on: () => {},
  connect: async () => {},
  quit: async () => {},
  get: async () => null,
  set: async () => {},
  setEx: async () => {},
  del: async () => {},
  incr: async () => 1,
  expire: async () => {},
  scanIterator: async function* () {},
  ping: async () => 'PONG'
});

const initRedis = async () => {
  try {
    client = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      socket: {
        reconnectStrategy: false
      }
    });

    client.on('error', () => {}); // silence errors
    client.on('connect', () => logger.info('Redis client connected'));
    client.on('ready', () => logger.info('Redis client ready'));

    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 2000)
    );
    await Promise.race([connectPromise, timeoutPromise]);

    logger.info('Redis initialized successfully');
    return client;
  } catch (error) {
    logger.warn('Redis unavailable, falling back to Mock Redis to prevent crash.');
    client = createMockRedis();
    return client;
  }
};

const getRedis = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call initRedis first.');
  }
  return client;
};

const closeRedis = async () => {
  if (client && client.ping) {
    try { await client.quit(); } catch(e){}
    logger.info('Redis connection closed');
  }
};

export { initRedis, getRedis, closeRedis };
