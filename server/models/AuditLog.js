import mongoose from 'mongoose';

/**
 * Audit log — one document per mutating action.
 * Captures who did what, when, on which resource, from where.
 *
 * Written by the auditLog middleware on every non-GET /api/* request
 * (plus a few explicit calls for security events like login failures).
 */
const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    actor: {
      email: String,
      role: String,
      apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey' },
    },
    action: {
      type: String,
      required: true,
      index: true,
      // Freeform but we prefer dotted verbs e.g. "transaction.create",
      // "budget.update", "auth.login", "auth.login_failed", "apiKey.revoke"
    },
    resource: {
      type: { type: String }, // 'transaction' | 'budget' | 'user' | ...
      id: String,
    },
    method: String,
    path: String,
    ip: String,
    userAgent: String,
    requestId: { type: String, index: true },
    statusCode: Number,
    metadata: { type: mongoose.Schema.Types.Mixed },
    success: Boolean,
    durationMs: Number,
    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
      // Mongo TTL — retained at org level but a reasonable default of 90 days.
      expires: 60 * 60 * 24 * 90,
    },
  },
  { timestamps: false }
);

auditLogSchema.index({ orgId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Static convenience writers — don't throw if DB is unavailable
auditLogSchema.statics.record = async function (entry) {
  try {
    return await this.create(entry);
  } catch {
    return null;
  }
};

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
