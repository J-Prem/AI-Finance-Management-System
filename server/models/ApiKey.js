import mongoose from 'mongoose';
import crypto from 'crypto';

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'Key is required'],
      unique: true,
      select: false,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    keyPreview: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    permissions: {
      type: [String],
      enum: [
        // Generic scopes — friendly aliases used by the client UI
        'read',
        'write',
        'admin',
        // Granular resource scopes
        'transactions:read',
        'transactions:write',
        'transactions:delete',
        'budgets:read',
        'budgets:write',
        'budgets:delete',
        'analytics:read',
        'subscriptions:read',
        'subscriptions:write',
        'team:read',
        'team:write',
        'notifications:read',
        'notifications:write',
        'investments:read',
        'investments:write',
        'reports:read',
        'ml:predict',
        'ml:analyze',
      ],
      default: ['read'],
    },
    rateLimit: {
      requestsPerMinute: {
        type: Number,
        default: 60,
      },
      requestsPerHour: {
        type: Number,
        default: 3600,
      },
      requestsPerDay: {
        type: Number,
        default: 86400,
      },
    },
    restrictions: {
      ipWhitelist: {
        type: [String],
        default: [],
      },
      allowedOrigins: {
        type: [String],
        default: [],
      },
      expiresAt: Date,
    },
    lastUsed: Date,
    lastIpAddress: String,
    lastUserAgent: String,
    usageStats: {
      totalRequests: {
        type: Number,
        default: 0,
      },
      requestsThisMonth: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rotatedAt: Date,
    rotationHistory: [
      {
        key: String,
        keyHash: String,
        rotatedAt: Date,
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
apiKeySchema.index({ userId: 1 });
// NOTE: keyHash index already declared via 'unique: true' above
apiKeySchema.index({ isActive: 1 });

// Virtual for display
apiKeySchema.virtual('displayKey').get(function () {
  return this.keyPreview + '...';
});

// Virtual for expired
apiKeySchema.virtual('isExpired').get(function () {
  if (!this.restrictions.expiresAt) return false;
  return new Date() > new Date(this.restrictions.expiresAt);
});

// Pre-validate: hash the key BEFORE validation runs
function deriveKeyFields(next) {
  try {
    if (!this.key) return next();
    if (this.isModified && !this.isModified('key') && this.keyHash && this.keyPreview) {
      return next();
    }
    const hash = crypto.createHash('sha256').update(String(this.key)).digest('hex');
    this.keyHash = hash;
    const keyStr = String(this.key);
    this.keyPreview = keyStr.substring(0, 8) + '...' + keyStr.substring(keyStr.length - 4);
    next();
  } catch (e) {
    next(e);
  }
}

apiKeySchema.pre('validate', deriveKeyFields);
apiKeySchema.pre('save', deriveKeyFields);

// Method to verify key
apiKeySchema.methods.verifyKey = function (providedKey) {
  const hash = crypto.createHash('sha256').update(providedKey).digest('hex');
  return this.keyHash === hash;
};

// Method to check if valid
apiKeySchema.methods.isValid = function () {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  return true;
};

// Method to check IP whitelist
apiKeySchema.methods.checkIpRestriction = function (ipAddress) {
  if (this.restrictions.ipWhitelist.length === 0) return true;
  return this.restrictions.ipWhitelist.includes(ipAddress);
};

// Method to check origin restriction
apiKeySchema.methods.checkOriginRestriction = function (origin) {
  if (this.restrictions.allowedOrigins.length === 0) return true;
  return this.restrictions.allowedOrigins.includes(origin);
};

// Method to update usage
apiKeySchema.methods.updateUsage = function (ipAddress, userAgent) {
  this.lastUsed = new Date();
  this.lastIpAddress = ipAddress;
  this.lastUserAgent = userAgent;
  this.usageStats.totalRequests += 1;
  this.usageStats.requestsThisMonth += 1;
  return this;
};

// Method to reset monthly usage
apiKeySchema.methods.resetMonthlyUsage = function () {
  this.usageStats.requestsThisMonth = 0;
  this.usageStats.lastResetDate = new Date();
  return this;
};

// Method to rotate key
apiKeySchema.methods.rotateKey = function (newKey, reason = 'manual rotation') {
  // Store old key in history
  this.rotationHistory.push({
    key: this.key,
    keyHash: this.keyHash,
    rotatedAt: new Date(),
    reason,
  });

  // Set new key
  this.key = newKey;
  this.rotatedAt = new Date();

  // Key will be hashed in pre-save
  return this;
};

// Method to add permission
apiKeySchema.methods.addPermission = function (permission) {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
  }
  return this;
};

// Method to remove permission
apiKeySchema.methods.removePermission = function (permission) {
  this.permissions = this.permissions.filter((p) => p !== permission);
  return this;
};

// Method to check permission
apiKeySchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

// Method to revoke
apiKeySchema.methods.revoke = function () {
  this.isActive = false;
  return this;
};

// Statics
apiKeySchema.statics.findByUser = function (userId) {
  return this.find({ userId });
};

apiKeySchema.statics.findActiveByUser = function (userId) {
  return this.find({ userId, isActive: true });
};

apiKeySchema.statics.findByKeyHash = function (keyHash) {
  return this.findOne({ keyHash });
};

export default mongoose.model('ApiKey', apiKeySchema);
