import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import ApiKey from '../models/ApiKey.js';
import logger from '../utils/logger.js';

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

/**
 * JWT Authentication Middleware
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'User account has been banned',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('JWT Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * API Key Authentication Middleware
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    let apiKey;

    // Check header first
    if (req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'];
    }

    // Fallback to query parameter
    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key;
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required',
      });
    }

    // Find API key
    const keyRecord = await ApiKey.findByKeyHash(
      crypto.createHash('sha256').update(apiKey).digest('hex')
    );

    if (!keyRecord || !keyRecord.isValid()) {
      logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 10)}...`);
      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
      });
    }

    // Check IP restriction
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!keyRecord.checkIpRestriction(clientIp)) {
      logger.warn(`API key IP restriction violation: ${clientIp}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: IP not whitelisted',
      });
    }

    // Check origin restriction
    const origin = req.get('origin');
    if (origin && !keyRecord.checkOriginRestriction(origin)) {
      logger.warn(`API key origin restriction violation: ${origin}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: Origin not allowed',
      });
    }

    // Update usage
    keyRecord.updateUsage(clientIp, req.get('user-agent'));
    await keyRecord.save();

    const user = await User.findById(keyRecord.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    req.user = user;
    req.apiKey = keyRecord;
    next();
  } catch (error) {
    logger.error('API Key authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'API key authentication failed',
    });
  }
};

/**
 * Optional authentication (accepts both JWT and API key)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    let apiKey;

    // Try JWT first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    // Try API key
    if (req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.id);
      if (user && user.isActive) {
        req.user = user;
      }
    } else if (apiKey) {
      const keyRecord = await ApiKey.findByKeyHash(
        crypto.createHash('sha256').update(apiKey).digest('hex')
      );
      if (keyRecord && keyRecord.isValid()) {
        const user = await User.findById(keyRecord.userId);
        if (user && user.isActive) {
          req.user = user;
          req.apiKey = keyRecord;
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

/**
 * Role-based access control
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user ${req.user._id}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Check subscription tier
 */
export const checkSubscriptionTier = (...allowedTiers) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedTiers.includes(req.user.subscriptionTier)) {
      return res.status(403).json({
        success: false,
        message: 'This feature requires a higher subscription tier',
        requiredTier: allowedTiers,
      });
    }

    next();
  };
};

/**
 * Verify API key permissions
 */
export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      // JWT authentication doesn't require permission check
      return next();
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.apiKey.hasPermission(perm)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: 'API key does not have required permissions',
        requiredPermissions,
      });
    }

    next();
  };
};

export { AuthError };
