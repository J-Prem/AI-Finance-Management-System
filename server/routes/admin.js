import express from 'express';
import { authenticateJWT, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateJWT, authorize('admin', 'superadmin'));

/**
 * @route GET /api/admin/users
 * @desc List all users
 * @access Private/Admin
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await User.countDocuments();
    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Admin users list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
});

/**
 * @route GET /api/admin/users/:id
 * @desc Get user details
 * @access Private/Admin
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const subscription = await Subscription.findOne({ userId: user._id });

    res.json({
      success: true,
      data: {
        user,
        subscription,
      },
    });
  } catch (error) {
    logger.error('Admin user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
});

/**
 * @route POST /api/admin/users/:id/ban
 * @desc Ban user
 * @access Private/Admin
 */
router.post('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    logger.info(`User ${user._id} banned by admin ${req.user._id}`);

    res.json({
      success: true,
      message: 'User banned successfully',
      data: { user },
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban user',
    });
  }
});

/**
 * @route POST /api/admin/users/:id/unban
 * @desc Unban user
 * @access Private/Admin
 */
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User unbanned successfully',
      data: { user },
    });
  } catch (error) {
    logger.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban user',
    });
  }
});

/**
 * @route GET /api/admin/stats
 * @desc Get system stats
 * @access Private/Admin
 */
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });

    const usersByTier = await User.aggregate([
      {
        $group: {
          _id: '$subscriptionTier',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalTransactions,
          activeSubscriptions,
          usersByTier,
        },
      },
    });
  } catch (error) {
    logger.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

/**
 * @route GET /api/admin/revenue
 * @desc Get revenue analytics
 * @access Private/Admin
 */
router.get('/revenue', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'active' });

    const totalMRR = subscriptions.reduce((sum, sub) => {
      const plan = sub.plan;
      const rates = { FREE: 0, PRO: 2999, ENTERPRISE: 9999 };
      return sum + (rates[plan] || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        revenue: {
          totalMRR: totalMRR / 100, // Convert cents to dollars
          activeSubscriptions: subscriptions.length,
        },
      },
    });
  } catch (error) {
    logger.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue data',
    });
  }
});

export default router;
