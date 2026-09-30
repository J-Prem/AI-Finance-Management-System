import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route GET /api/notifications
 * @desc Get notifications
 * @access Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route GET /api/notifications/:id
 * @desc Get single notification
 * @access Private
 */
router.get('/:id', notificationController.getNotification);

/**
 * @route POST /api/notifications/:id/read
 * @desc Mark as read
 * @access Private
 */
router.post('/:id/read', notificationController.markAsRead);

/**
 * @route POST /api/notifications/:id/unread
 * @desc Mark as unread
 * @access Private
 */
router.post('/:id/unread', notificationController.markAsUnread);

/**
 * @route POST /api/notifications/read-all
 * @desc Mark all as read
 * @access Private
 */
router.post('/read-all', notificationController.markAllAsRead);

/**
 * @route POST /api/notifications/:id/archive
 * @desc Archive notification
 * @access Private
 */
router.post('/:id/archive', notificationController.archiveNotification);

/**
 * @route POST /api/notifications/:id/unarchive
 * @desc Unarchive notification
 * @access Private
 */
router.post('/:id/unarchive', notificationController.unarchiveNotification);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * @route GET /api/notifications/unread/count
 * @desc Get unread count
 * @access Private
 */
router.get('/unread/count', notificationController.getUnreadCount);

/**
 * @route GET /api/notifications/preferences
 * @desc Get preferences
 * @access Private
 */
router.get('/preferences', notificationController.getPreferences);

/**
 * @route PATCH /api/notifications/preferences
 * @desc Update preferences
 * @access Private
 */
router.patch('/preferences', notificationController.updatePreferences);

export default router;
