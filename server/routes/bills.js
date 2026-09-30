import express from 'express';
import * as billController from '../controllers/billController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// All bill endpoints require authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: Bills
 *   description: Manage recurring bills and payments
 */

/**
 * @swagger
 * /api/bills:
 *   post:
 *     tags: [Bills]
 *     summary: Create new bill
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               name:
 *                 type: string
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, biweekly, monthly, quarterly, yearly]
 *               dueDate:
 *                 type: integer
 *               remindDaysBefore:
 *                 type: integer
 *               merchant:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Bill created
 */
router.post('/', billController.createBill);

/**
 * @swagger
 * /api/bills:
 *   get:
 *     tags: [Bills]
 *     summary: Get all bills
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bills
 */
router.get('/', billController.getBills);

/**
 * @swagger
 * /api/bills/{id}:
 *   get:
 *     tags: [Bills]
 *     summary: Get bill by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill details
 */
router.get('/:id', billController.getBill);

/**
 * @swagger
 * /api/bills/{id}:
 *   put:
 *     tags: [Bills]
 *     summary: Update bill
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               name:
 *                 type: string
 *               amount:
 *                 type: number
 *               dueDate:
 *                 type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill updated
 */
router.put('/:id', billController.updateBill);

/**
 * @swagger
 * /api/bills/{id}:
 *   delete:
 *     tags: [Bills]
 *     summary: Delete bill
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill deleted
 */
router.delete('/:id', billController.deleteBill);

/**
 * @swagger
 * /api/bills/upcoming:
 *   get:
 *     tags: [Bills]
 *     summary: Get upcoming bills
 *     parameters:
 *       - in: query
 *         name: daysAhead
 *         schema:
 *           type: integer
 *           default: 7
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming bills
 */
router.get('/upcoming', billController.getUpcomingBills);

/**
 * @swagger
 * /api/bills/overdue:
 *   get:
 *     tags: [Bills]
 *     summary: Get overdue bills
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue bills
 */
router.get('/overdue', billController.getOverdueBills);

/**
 * @swagger
 * /api/bills/{id}/mark-paid:
 *   post:
 *     tags: [Bills]
 *     summary: Mark bill as paid
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               paymentMethod:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill marked as paid
 */
router.post('/:id/mark-paid', billController.markBillAsPaid);

/**
 * @swagger
 * /api/bills/calendar:
 *   get:
 *     tags: [Bills]
 *     summary: Get bill calendar
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill calendar
 */
router.get('/calendar', billController.getBillCalendar);

/**
 * @swagger
 * /api/bills/statistics:
 *   get:
 *     tags: [Bills]
 *     summary: Get bill statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill statistics
 */
router.get('/statistics', billController.getBillStatistics);

/**
 * @swagger
 * /api/bills/derive-from-receipts:
 *   post:
 *     tags: [Bills]
 *     summary: Auto-detect recurring bills from uploaded receipts and transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of newly created bills
 */
router.post('/derive-from-receipts', billController.deriveBillsFromReceipts);

export default router;
