/**
 * Seed script - creates the initial admin user
 * Run: node scripts/seed-admin.js
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_finance';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' },
  subscription: {
    plan: { type: String, default: 'enterprise' },
    status: { type: String, default: 'active' }
  },
  isVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', userSchema);

    const existing = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@aifinance.com' });
    if (existing) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', salt);

    await User.create({
      name: 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@aifinance.com',
      password: hashedPassword,
      role: 'superadmin',
      subscription: { plan: 'enterprise', status: 'active' },
      isVerified: true
    });

    console.log('Admin user created successfully!');
    console.log('Email:', process.env.ADMIN_EMAIL || 'admin@aifinance.com');
    console.log('Password:', process.env.ADMIN_PASSWORD || 'Admin@123');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
