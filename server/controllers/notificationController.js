import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get notifications
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, read, type } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {
    userId: req.user._id,
    archived: false,
  };

  if (read !== undefined) {
    query.read = read === 'true';
  }

  if (type) {
    query.type = type;
  }

  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

/**
 * Get single notification
 */
export const getNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  res.json({
    success: true,
    data: { notification },
  });
});

/**
 * Mark notification as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  notification.markAsRead();
  await notification.save();

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification },
  });
});

/**
 * Mark notification as unread
 */
export const markAsUnread = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  notification.markAsUnread();
  await notification.save();

  res.json({
    success: true,
    message: 'Notification marked as unread',
    data: { notification },
  });
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user._id);

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

/**
 * Archive notification
 */
export const archiveNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  notification.archive();
  await notification.save();

  res.json({
    success: true,
    message: 'Notification archived',
  });
});

/**
 * Unarchive notification
 */
export const unarchiveNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  notification.unarchive();
  await notification.save();

  res.json({
    success: true,
    message: 'Notification unarchived',
  });
});

/**
 * Delete notification
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  await Notification.deleteOne({ _id: notification._id });

  res.json({
    success: true,
    message: 'Notification deleted',
  });
});

/**
 * Get unread count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.findUnreadCount(req.user._id);

  res.json({
    success: true,
    data: { unreadCount: count },
  });
});

/**
 * Get notification preferences
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const { User } = await import('../models/User.js');
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    data: {
      preferences: user.preferences.emailNotifications,
    },
  });
});

/**
 * Update notification preferences
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { User } = await import('../models/User.js');
  const user = await User.findById(req.user._id);

  const { budgetAlerts, weeklyDigest, anomalies, promotions } = req.body;

  user.preferences.emailNotifications = {
    budgetAlerts: budgetAlerts !== undefined ? budgetAlerts : user.preferences.emailNotifications.budgetAlerts,
    weeklyDigest: weeklyDigest !== undefined ? weeklyDigest : user.preferences.emailNotifications.weeklyDigest,
    anomalies: anomalies !== undefined ? anomalies : user.preferences.emailNotifications.anomalies,
    promotions: promotions !== undefined ? promotions : user.preferences.emailNotifications.promotions,
  };

  await user.save();

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: { preferences: user.preferences.emailNotifications },
  });
});
