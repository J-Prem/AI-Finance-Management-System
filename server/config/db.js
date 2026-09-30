/**
 * MongoDB connection. Real mode only — no demo fallback.
 * Retries briefly on network blips, then throws so the caller can exit cleanly.
 */
import mongoose from 'mongoose';
import dns from 'dns';
import logger from '../utils/logger.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4,1.1.1.1')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

let retryCount = 0;
let dnsConfigured = false;

function configureDns() {
  if (dnsConfigured || !DNS_SERVERS.length) return;
  dnsConfigured = true;
  try {
    dns.setServers(DNS_SERVERS);
    logger.info(`[db] DNS servers configured for Atlas SRV lookup: ${DNS_SERVERS.join(', ')}`);
  } catch (error) {
    logger.warn(`[db] Could not configure DNS servers: ${error.message}`);
  }
}

const connectDB = async () => {
  configureDns();
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<')) {
    throw new Error('MONGODB_URI is not configured. See SETUP_REAL.md.');
  }
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    logger.info('[db] MongoDB connected successfully');
    retryCount = 0;

    mongoose.connection.on('disconnected', () => logger.warn('[db] MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('[db] MongoDB reconnected'));
    mongoose.connection.on('error', (err) => logger.error(`[db] MongoDB error: ${err.message}`));

    return mongoose.connection;
  } catch (error) {
    logger.error(`[db] MongoDB connection error: ${error.message}`);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      logger.info(`[db] Retrying in ${RETRY_DELAY}ms (${retryCount}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return connectDB();
    }
    throw new Error('MongoDB connection failed after retries — check MONGODB_URI, IP allowlist, credentials.');
  }
};

export default connectDB;
