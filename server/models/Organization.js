import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Organization — multi-tenant container. Every user belongs to exactly one
 * organization. Every data record (Transaction, Budget, Investment, Bill,
 * Team, ApiKey, etc.) should carry orgId for tenant isolation.
 *
 * Organizations are created lazily when a user signs up (if they don't
 * already belong to one via invite), or explicitly by the admin.
 */
const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9][a-z0-9-]{1,60}$/, 'Invalid slug'],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      default: 'FREE',
      index: true,
    },
    planSource: {
      type: String,
      enum: ['individual', 'team_override', 'enterprise_contract'],
      default: 'individual',
    },
    // Per-org usage — aggregated from all members. Reset monthly.
    usage: {
      transactionsThisMonth: { type: Number, default: 0 },
      apiCallsThisMonth: { type: Number, default: 0 },
      mlPredictionsThisMonth: { type: Number, default: 0 },
      lastResetAt: { type: Date, default: () => new Date() },
    },
    // Feature flags overridable per-org (for enterprise deals etc.)
    featureOverrides: {
      mlEnabled: { type: Boolean, default: true },
      auditLogRetentionDays: { type: Number, default: 90 },
      ssoEnabled: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false },
    },
    billing: {
      stripeCustomerId: { type: String, sparse: true },
      taxId: String,
      billingEmail: String,
      country: { type: String, default: 'US' },
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

organizationSchema.pre('save', function (next) {
  if (this.isNew && !this.slug) {
    this.slug = `${this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${uuidv4().slice(0, 6)}`;
  }
  next();
});

organizationSchema.methods.incrementUsage = function (kind, amount = 1) {
  const keyMap = {
    transaction: 'transactionsThisMonth',
    api: 'apiCallsThisMonth',
    ml: 'mlPredictionsThisMonth',
  };
  const field = keyMap[kind];
  if (!field) return;
  // Reset monthly if crossed the boundary
  const last = this.usage.lastResetAt || new Date(0);
  const now = new Date();
  if (last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth()) {
    this.usage.transactionsThisMonth = 0;
    this.usage.apiCallsThisMonth = 0;
    this.usage.mlPredictionsThisMonth = 0;
    this.usage.lastResetAt = now;
  }
  this.usage[field] = (this.usage[field] || 0) + amount;
};

/**
 * Check if a usage action is allowed under the org's current plan.
 * Returns { allowed: boolean, limit, current, reason }.
 */
organizationSchema.methods.checkUsage = function (kind, tierLimits) {
  const keyMap = {
    transaction: ['transactionsPerMonth', 'transactionsThisMonth'],
    api: ['apiCallsPerDay', 'apiCallsThisMonth'],
    ml: ['mlPredictionsPerMonth', 'mlPredictionsThisMonth'],
  };
  const pair = keyMap[kind];
  if (!pair) return { allowed: true };
  const [limitKey, usageKey] = pair;
  const limit = tierLimits[limitKey];
  const current = this.usage[usageKey] || 0;
  if (limit === null || limit === undefined) return { allowed: true, current, limit: null };
  return {
    allowed: current < limit,
    current,
    limit,
    reason: current >= limit ? `${kind} limit of ${limit} reached for this billing period` : undefined,
  };
};

// Create a default personal org for a user on signup
organizationSchema.statics.createForUser = async function (user) {
  const slug = `${String(user.email || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${uuidv4().slice(0, 6)}`;
  return this.create({
    name: `${user.name || user.email}'s Workspace`,
    slug,
    ownerId: user._id,
    plan: user.subscriptionTier || 'FREE',
    planSource: 'individual',
  });
};

organizationSchema.index({ ownerId: 1 });

const Organization = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);

export default Organization;
