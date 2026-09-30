import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { SUBSCRIPTION_TIERS, USER_ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    subscriptionTier: {
      type: String,
      enum: Object.keys(SUBSCRIPTION_TIERS),
      default: 'FREE',
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastPasswordChange: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    preferences: {
      currency: {
        type: String,
        default: 'USD',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      language: {
        type: String,
        default: 'en',
      },
      emailNotifications: {
        budgetAlerts: {
          type: Boolean,
          default: true,
        },
        weeklyDigest: {
          type: Boolean,
          default: true,
        },
        anomalies: {
          type: Boolean,
          default: true,
        },
        promotions: {
          type: Boolean,
          default: false,
        },
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
    },
    usageStats: {
      transactionsAdded: {
        type: Number,
        default: 0,
      },
      apiCallsThisMonth: {
        type: Number,
        default: 0,
      },
      mlPredictionsThisMonth: {
        type: Number,
        default: 0,
      },
      lastUsageReset: {
        type: Date,
        default: Date.now,
      },
    },
    socialAuth: {
      googleId: {
        type: String,
        sparse: true,
      },
      googleEmail: String,
      githubId: {
        type: String,
        sparse: true,
      },
      githubEmail: String,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate API key
userSchema.methods.generateApiKey = function () {
  const apiKey = `sk_${uuidv4()}`;
  this.apiKey = apiKey;
  return apiKey;
};

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      id: this._id,
      email: this.email,
      subscriptionTier: this.subscriptionTier,
      role: this.role,
    },
    process.env.JWT_SECRET || 'your-secret-key',
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
  return token;
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
  const token = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    }
  );
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = uuidv4();
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const token = uuidv4();
  this.emailVerificationToken = token;
  return token;
};

// Get subscription tier info
userSchema.methods.getSubscriptionInfo = function () {
  return SUBSCRIPTION_TIERS[this.subscriptionTier];
};

// Check if limit exceeded
userSchema.methods.checkTransactionLimit = function () {
  const tierInfo = this.getSubscriptionInfo();
  const limit = tierInfo.limits.transactionsPerMonth;
  if (limit === null) return true; // unlimited
  return this.usageStats.transactionsAdded < limit;
};

userSchema.methods.checkApiCallLimit = function () {
  const tierInfo = this.getSubscriptionInfo();
  const limit = tierInfo.limits.apiCallsPerDay;
  if (limit === null) return true; // unlimited
  return this.usageStats.apiCallsThisMonth < limit;
};

// Virtual for subscription plan details
userSchema.virtual('subscriptionDetails').get(function () {
  return SUBSCRIPTION_TIERS[this.subscriptionTier];
});

// Create indexes
userSchema.index({ email: 1 });
userSchema.index({ apiKey: 1 });
userSchema.index({ teamId: 1 });
userSchema.index({ createdAt: 1 });

export default mongoose.model('User', userSchema);
