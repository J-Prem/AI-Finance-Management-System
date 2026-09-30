import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../config/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: [true, 'Type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    icon: {
      type: String,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    data: {
      transactionId: mongoose.Schema.Types.ObjectId,
      budgetId: mongoose.Schema.Types.ObjectId,
      teamId: mongoose.Schema.Types.ObjectId,
      anomalyScore: Number,
      budgetPercentage: Number,
      amount: Number,
      category: String,
      customData: mongoose.Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    archived: {
      type: Boolean,
      default: false,
    },
    channels: {
      email: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
      push: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
      inApp: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
      sms: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 });

// TTL Index for automatic deletion
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for is expired
notificationSchema.virtual('isExpired').get(function () {
  return new Date() > new Date(this.expiresAt);
});

// Virtual for time since creation
notificationSchema.virtual('createdAtFormatted').get(function () {
  const now = new Date();
  const diff = now - new Date(this.createdAt);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
});

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this;
};

// Method to mark as unread
notificationSchema.methods.markAsUnread = function () {
  this.read = false;
  this.readAt = null;
  return this;
};

// Method to archive
notificationSchema.methods.archive = function () {
  this.archived = true;
  return this;
};

// Method to unarchive
notificationSchema.methods.unarchive = function () {
  this.archived = false;
  return this;
};

// Method to mark channel as sent
notificationSchema.methods.markChannelSent = function (channel) {
  if (this.channels[channel]) {
    this.channels[channel].sent = true;
    this.channels[channel].sentAt = new Date();
  }
  return this;
};

// Method to get icon based on type
notificationSchema.methods.getIcon = function () {
  const iconMap = {
    [NOTIFICATION_TYPES.BUDGET_ALERT]: '💰',
    [NOTIFICATION_TYPES.ANOMALY_DETECTED]: '⚠️',
    [NOTIFICATION_TYPES.SUBSCRIPTION_UPDATE]: '📦',
    [NOTIFICATION_TYPES.INSIGHT_GENERATED]: '💡',
    [NOTIFICATION_TYPES.PAYMENT_FAILED]: '❌',
    [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: '✅',
    [NOTIFICATION_TYPES.TEAM_INVITE]: '👥',
    [NOTIFICATION_TYPES.TRANSACTION_ADDED]: '📝',
  };
  return iconMap[this.type] || '📬';
};

// Statics
notificationSchema.statics.findUnread = function (userId) {
  return this.find({ userId, read: false, archived: false }).sort({ createdAt: -1 });
};

notificationSchema.statics.findByType = function (userId, type) {
  return this.find({ userId, type }).sort({ createdAt: -1 });
};

notificationSchema.statics.findUnreadCount = function (userId) {
  return this.countDocuments({ userId, read: false, archived: false });
};

notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
};

notificationSchema.statics.deleteExpired = function () {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Pre-save hook
notificationSchema.pre('save', function (next) {
  // Auto-set icon if not provided
  if (!this.icon) {
    this.icon = this.getIcon();
  }
  next();
});

export default mongoose.model('Notification', notificationSchema);
