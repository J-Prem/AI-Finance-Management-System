import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import logger from '../utils/logger.js';

/**
 * Track API usage and enforce subscription limits
 */
export const trackApiUsage = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id;

    // Get or create subscription
    let subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      subscription = await Subscription.create({
        userId,
        plan: req.user.subscriptionTier,
        status: 'active',
      });
    }

    // Check subscription limits
    const tierInfo = req.user.getSubscriptionInfo();

    // Check API call limit
    if (tierInfo.limits.apiCallsPerDay) {
      if (subscription.usage.apiCalls.current >= tierInfo.limits.apiCallsPerDay) {
        logger.warn(`API call limit exceeded for user ${userId}`);
        return res.status(429).json({
          success: false,
          message: 'API call limit exceeded for your subscription tier',
          limit: tierInfo.limits.apiCallsPerDay,
          usage: subscription.usage.apiCalls.current,
          resetDate: subscription.usage.apiCalls.resetDate,
        });
      }
    }

    // Check transaction limit
    if (tierInfo.limits.transactionsPerMonth) {
      if (req.user.usageStats.transactionsAdded >= tierInfo.limits.transactionsPerMonth) {
        logger.warn(`Transaction limit exceeded for user ${userId}`);
        return res.status(429).json({
          success: false,
          message: 'Transaction limit exceeded for your subscription tier',
          limit: tierInfo.limits.transactionsPerMonth,
          usage: req.user.usageStats.transactionsAdded,
          resetDate: req.user.usageStats.lastUsageReset,
        });
      }
    }

    // Attach subscription to request for later use
    req.subscription = subscription;

    // Wrap res.json to track usage
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // Only track successful requests
      if (res.statusCode >= 200 && res.statusCode < 300) {
        trackUsageAsync(userId, subscription);
      }
      return originalJson(data);
    };

    next();
  } catch (error) {
    logger.error('Usage tracker error:', error);
    next();
  }
};

/**
 * Async function to track usage without blocking response
 */
async function trackUsageAsync(userId, subscription) {
  try {
    subscription.incrementApiCalls();
    await subscription.save();
  } catch (error) {
    logger.error('Failed to track API usage:', error);
  }
}

/**
 * Track transaction creation
 */
export const trackTransactionCreation = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const tierInfo = req.user.getSubscriptionInfo();

    // Check if user can add more transactions
    if (tierInfo.limits.transactionsPerMonth) {
      if (req.user.usageStats.transactionsAdded >= tierInfo.limits.transactionsPerMonth) {
        return res.status(429).json({
          success: false,
          message: 'Transaction limit exceeded for your subscription tier',
          limit: tierInfo.limits.transactionsPerMonth,
          usage: req.user.usageStats.transactionsAdded,
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Transaction tracking error:', error);
    next();
  }
};

/**
 * Increment transaction count
 */
export const incrementTransactionCount = async (userId, count = 1) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { 'usageStats.transactionsAdded': count },
      },
      { new: true }
    );

    if (user && user.subscription) {
      user.subscription.incrementTransactions(count);
      await user.subscription.save();
    }

    return user;
  } catch (error) {
    logger.error('Failed to increment transaction count:', error);
    throw error;
  }
};

/**
 * Check and reset monthly usage counters
 */
export const resetMonthlyUsage = async (userId) => {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const user = await User.findById(userId);
    if (!user) return;

    // Reset if last reset was in a different month
    const lastReset = new Date(user.usageStats.lastUsageReset);
    if (lastReset < currentMonth) {
      user.usageStats.apiCallsThisMonth = 0;
      user.usageStats.mlPredictionsThisMonth = 0;
      user.usageStats.lastUsageReset = now;
      await user.save();
    }

    // Also reset subscription usage
    const subscription = await Subscription.findOne({ userId });
    if (subscription) {
      const subLastReset = new Date(subscription.usage.apiCalls.resetDate || 0);
      if (subLastReset < currentMonth) {
        subscription.resetUsageCounters();
        await subscription.save();
      }
    }

    return user;
  } catch (error) {
    logger.error('Failed to reset monthly usage:', error);
    throw error;
  }
};

/**
 * Get usage stats
 */
export const getUsageStats = async (userId) => {
  try {
    const user = await User.findById(userId);
    const subscription = await Subscription.findOne({ userId });

    if (!user) {
      throw new Error('User not found');
    }

    const tierInfo = user.getSubscriptionInfo();

    return {
      user: {
        tier: user.subscriptionTier,
        transactionsAdded: user.usageStats.transactionsAdded,
        apiCallsThisMonth: user.usageStats.apiCallsThisMonth,
        mlPredictionsThisMonth: user.usageStats.mlPredictionsThisMonth,
      },
      subscription: subscription ? {
        status: subscription.status,
        apiCalls: subscription.usage.apiCalls.current,
        transactions: subscription.usage.transactions.current,
        mlPredictions: subscription.usage.mlPredictions.current,
      } : null,
      limits: {
        transactionsPerMonth: tierInfo.limits.transactionsPerMonth,
        apiCallsPerDay: tierInfo.limits.apiCallsPerDay,
        mlPredictionsPerMonth: tierInfo.limits.mlPredictionsPerMonth,
      },
      remaining: {
        transactions: tierInfo.limits.transactionsPerMonth
          ? tierInfo.limits.transactionsPerMonth - user.usageStats.transactionsAdded
          : null,
        apiCalls: tierInfo.limits.apiCallsPerDay
          ? tierInfo.limits.apiCallsPerDay - user.usageStats.apiCallsThisMonth
          : null,
        mlPredictions: tierInfo.limits.mlPredictionsPerMonth
          ? tierInfo.limits.mlPredictionsPerMonth - user.usageStats.mlPredictionsThisMonth
          : null,
      },
    };
  } catch (error) {
    logger.error('Failed to get usage stats:', error);
    throw error;
  }
};
