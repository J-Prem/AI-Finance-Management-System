import { getRedis } from '../config/redis.js';
import * as emailService from './emailService.js';
import cacheService, { cacheKeys } from './cacheService.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import logger from '../utils/logger.js';

class NotificationService {
  constructor() {
    this.redis = null;
  }

  /**
   * Initialize service with Redis
   */
  async initialize(io) {
    this.io = io;
  }

  /**
   * Send budget alert notification
   */
  async sendBudgetAlert(userId, budget, percentUsed, io) {
    try {
      const severity =
        percentUsed >= 100
          ? 'critical'
          : percentUsed >= 90
            ? 'warning'
            : percentUsed >= 75
              ? 'info'
              : 'low';

      const notification = {
        userId,
        type: NOTIFICATION_TYPES.BUDGET_ALERT,
        severity,
        title: `Budget Alert: ${budget.category}`,
        message: `You have used ${percentUsed.toFixed(1)}% of your ${budget.category} budget`,
        data: {
          budgetId: budget._id,
          category: budget.category,
          budgetAmount: budget.amount,
          percentUsed,
          severity,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email for critical alerts
      if (severity === 'critical' || severity === 'warning') {
        await this._sendEmailNotification(userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error(`Error sending budget alert for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send anomaly alert notification
   */
  async sendAnomalyAlert(userId, transaction, anomalyDetails, io) {
    try {
      const notification = {
        userId,
        type: NOTIFICATION_TYPES.ANOMALY_DETECTED,
        severity: 'warning',
        title: 'Unusual Transaction Detected',
        message: `A transaction of ${transaction.currency} ${transaction.amount} in ${transaction.category} seems unusual`,
        data: {
          transactionId: transaction._id,
          category: transaction.category,
          amount: transaction.amount,
          description: transaction.description,
          anomalyScore: transaction.anomalyScore,
          details: anomalyDetails,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email notification
      await this._sendEmailNotification(userId, notification);

      return notification;
    } catch (error) {
      logger.error(`Error sending anomaly alert for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send weekly digest notification
   */
  async sendWeeklyDigest(userId, weeklyData, io) {
    try {
      const notification = {
        userId,
        type: NOTIFICATION_TYPES.INSIGHT_GENERATED,
        severity: 'info',
        title: 'Your Weekly Financial Summary',
        message: `You spent ${weeklyData.totalSpent} this week across ${weeklyData.categoryCount} categories`,
        data: {
          weekData: weeklyData,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email notification
      await this._sendEmailNotification(userId, notification);

      return notification;
    } catch (error) {
      logger.error(`Error sending weekly digest for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send bill reminder notification
   */
  async sendBillReminder(userId, bill, daysUntilDue, io) {
    try {
      const notification = {
        userId,
        type: NOTIFICATION_TYPES.INSIGHT_GENERATED,
        severity: daysUntilDue <= 3 ? 'warning' : 'info',
        title: `Bill Reminder: ${bill.name}`,
        message: `Your ${bill.name} bill of ${bill.currency || 'INR'} ${bill.amount} is due in ${daysUntilDue} days`,
        data: {
          billId: bill._id,
          billName: bill.name,
          amount: bill.amount,
          dueDate: bill.dueDate,
          daysUntilDue,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email for bills due within 3 days
      if (daysUntilDue <= 3) {
        await this._sendEmailNotification(userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error(`Error sending bill reminder for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send subscription renewal reminder
   */
  async sendSubscriptionReminder(userId, subscription, daysUntilRenewal, io) {
    try {
      const notification = {
        userId,
        type: NOTIFICATION_TYPES.SUBSCRIPTION_UPDATE,
        severity: 'info',
        title: `Subscription Renewal: ${subscription.name}`,
        message: `Your ${subscription.name} subscription renews in ${daysUntilRenewal} days`,
        data: {
          subscriptionId: subscription._id,
          subscriptionName: subscription.name,
          amount: subscription.amount,
          renewalDate: subscription.renewalDate,
          daysUntilRenewal,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email for upcoming renewals
      if (daysUntilRenewal <= 7) {
        await this._sendEmailNotification(userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error(
        `Error sending subscription reminder for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send price drop alert
   */
  async sendPriceDropAlert(userId, subscription, savings, io) {
    try {
      const notification = {
        userId,
        type: NOTIFICATION_TYPES.INSIGHT_GENERATED,
        severity: 'info',
        title: `Price Drop Alert: ${subscription.name}`,
        message: `${subscription.name} price has dropped by ${savings.currency || 'INR'} ${savings.amount}`,
        data: {
          subscriptionId: subscription._id,
          subscriptionName: subscription.name,
          savingsAmount: savings.amount,
          previousPrice: savings.previousPrice,
          newPrice: savings.newPrice,
          savingsPercentage: savings.percentage,
        },
        isRead: false,
        createdAt: new Date(),
      };

      // Send in-app notification
      this._sendInAppNotification(userId, notification, io);

      // Send email notification
      await this._sendEmailNotification(userId, notification);

      return notification;
    } catch (error) {
      logger.error(`Error sending price drop alert for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send in-app notification via Socket.IO
   * @private
   */
  _sendInAppNotification(userId, notification, io) {
    try {
      if (io) {
        io.to(`user:${userId}`).emit('notification:new', notification);
      }
      logger.debug(`In-app notification sent to user ${userId}`);
    } catch (error) {
      logger.error(`Error sending in-app notification:`, error);
    }
  }

  /**
   * Send email notification
   * @private
   */
  async _sendEmailNotification(userId, notification) {
    try {
      // Get user email
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(userId);

      if (!user || !user.email) {
        logger.warn(`User ${userId} has no email address`);
        return;
      }

      // Map notification type to email template
      const templateMapping = {
        [NOTIFICATION_TYPES.BUDGET_ALERT]: 'budget_alert',
        [NOTIFICATION_TYPES.ANOMALY_DETECTED]: 'anomaly_detected',
        [NOTIFICATION_TYPES.INSIGHT_GENERATED]: 'weekly_digest',
        [NOTIFICATION_TYPES.SUBSCRIPTION_UPDATE]: 'weekly_digest',
      };

      const template = templateMapping[notification.type] || 'weekly_digest';

      // emailService.sendEmail is positional: (to, subject, html, text?)
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${notification.title}</h2>
          <p style="color: #555;">Hi ${user.name || 'there'},</p>
          <p style="color: #555;">${notification.message || ''}</p>
          <p style="color: #999; font-size: 12px;">Template: ${template}</p>
        </div>
      `;
      await emailService.sendEmail(user.email, notification.title, html);

      logger.debug(`Email notification sent to ${user.email}`);
    } catch (error) {
      logger.error('Error sending email notification:', error);
      // Don't throw - email failures shouldn't prevent the app from working
    }
  }

  /**
   * Get user notifications
   */
  async getNotifications(userId, limit = 20, page = 1) {
    try {
      const Notification = (await import('../models/Notification.js')).default;

      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments({ userId });

      return {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error fetching notifications for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    try {
      const Notification = (await import('../models/Notification.js')).default;

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error) {
      logger.error(`Error marking notification as read:`, error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const Notification = (await import('../models/Notification.js')).default;

      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true }
      );

      return result;
    } catch (error) {
      logger.error(`Error marking all notifications as read:`, error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId, notificationId) {
    try {
      const Notification = (await import('../models/Notification.js')).default;

      const result = await Notification.deleteOne({
        _id: notificationId,
        userId,
      });

      return result;
    } catch (error) {
      logger.error(`Error deleting notification:`, error);
      throw error;
    }
  }
}

export default new NotificationService();
