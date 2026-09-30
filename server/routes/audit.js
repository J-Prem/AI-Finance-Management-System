import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { authenticateJWT, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All audit endpoints require admin role.
router.use(authenticateJWT);
router.use(authorize('admin'));

/**
 * @route GET /api/audit
 * @desc  List audit log entries, most recent first.
 *        Supports ?userId=&action=&since=&until=&limit=&page=
 * @access admin
 */
router.get('/', async (req, res) => {
  try {
    const { userId, action, since, until, orgId } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const query = {};
    if (userId) query.userId = userId;
    if (orgId) query.orgId = orgId;
    if (action) query.action = action;
    if (since || until) {
      query.createdAt = {};
      if (since) query.createdAt.$gte = new Date(since);
      if (until) query.createdAt.$lte = new Date(until);
    }

    const entries = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        entries,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Audit list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
});

/**
 * @route GET /api/audit/summary
 * @desc  Counts per action for the last 7 days.
 * @access admin
 */
router.get('/summary', async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const byAction = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 25 },
    ]);

    const byStatus = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $cond: [{ $lt: ['$statusCode', 400] }, 'success', 'failure'] }, count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        sinceIso: since.toISOString(),
        byAction,
        byStatus,
      },
    });
  } catch (error) {
    logger.error('Audit summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute audit summary' });
  }
});

export default router;
