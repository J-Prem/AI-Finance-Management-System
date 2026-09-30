import { SUBSCRIPTION_TIERS } from '../config/constants.js';
import logger from '../utils/logger.js';

const TIER_ORDER = ['FREE', 'PRO', 'ENTERPRISE'];

/**
 * requireTier('PRO') — block the request unless the user's effective tier is
 * at least PRO. Effective tier comes from req.user.subscriptionTier or, if
 * req.org is loaded, the org's plan (org plan wins).
 */
export const requireTier = (minTier) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const effective = (req.org && req.org.plan) || req.user.subscriptionTier || 'FREE';
    if (TIER_ORDER.indexOf(effective) < TIER_ORDER.indexOf(minTier)) {
      return res.status(403).json({
        success: false,
        message: `${minTier} plan required`,
        currentTier: effective,
        requiredTier: minTier,
      });
    }
    next();
  };
};

/**
 * enforceUsageLimit('transaction' | 'api' | 'ml')
 *
 * Soft-attaches the org (if available) and checks/increments the monthly
 * counter against the tier's limit. Returns 429 on breach.
 *
 * Works without an Organization document too: when there's no org, we fall
 * back to the user's own usageStats.
 */
export const enforceUsageLimit = (kind) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();
      const tier = (req.org && req.org.plan) || req.user.subscriptionTier || 'FREE';
      const tierInfo = SUBSCRIPTION_TIERS[tier];
      if (!tierInfo) return next();
      const limits = tierInfo.limits;

      const limitMap = {
        transaction: limits.transactionsPerMonth,
        api: limits.apiCallsPerDay,
        ml: limits.mlPredictionsPerMonth,
      };
      const limit = limitMap[kind];
      if (limit === null || limit === undefined) return next(); // unlimited

      // Prefer org usage if present, else fall back to user.usageStats
      let current = 0;
      if (req.org?.usage) {
        const usageMap = {
          transaction: req.org.usage.transactionsThisMonth,
          api: req.org.usage.apiCallsThisMonth,
          ml: req.org.usage.mlPredictionsThisMonth,
        };
        current = usageMap[kind] || 0;
      } else if (req.user.usageStats) {
        const usageMap = {
          transaction: req.user.usageStats.transactionsAdded,
          api: req.user.usageStats.apiCallsThisMonth,
          ml: req.user.usageStats.mlPredictionsThisMonth,
        };
        current = usageMap[kind] || 0;
      }

      if (current >= limit) {
        return res.status(429).json({
          success: false,
          message: `${kind} limit reached for ${tier} plan`,
          limit,
          current,
          upgradeTo: tier === 'FREE' ? 'PRO' : tier === 'PRO' ? 'ENTERPRISE' : null,
        });
      }

      next();
    } catch (error) {
      logger.error('enforceUsageLimit error:', error);
      next(); // fail-open
    }
  };
};

export default { requireTier, enforceUsageLimit };
