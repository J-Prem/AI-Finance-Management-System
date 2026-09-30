/**
 * Idempotent bootstrap — creates the admin user on first boot only.
 * Controlled by ADMIN_EMAIL and ADMIN_PASSWORD env vars. No fake seed data.
 */
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    logger.info('[bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap.');
    return;
  }

  try {
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      logger.info(`[bootstrap] Admin user ${email} already exists.`);
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      email,
      password: hashed,
      name: process.env.ADMIN_NAME || 'Administrator',
      role: 'admin',
      subscriptionTier: 'ENTERPRISE',
      emailVerified: true,
      isActive: true,
    });
    logger.info(`[bootstrap] Created admin user: ${email}`);
  } catch (e) {
    logger.warn(`[bootstrap] Admin bootstrap failed: ${e.message}`);
  }
}

export default { bootstrapAdmin };
