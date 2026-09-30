import express from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticateJWT, checkSubscriptionTier } from '../middleware/auth.js';
import { SUBSCRIPTION_TIERS } from '../config/constants.js';

const router = express.Router();

// All report endpoints require authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Generate and export financial reports
 */

/**
 * @swagger
 * /api/reports/monthly/{year}/{month}:
 *   get:
 *     tags: [Reports]
 *     summary: Generate monthly report
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly report generated
 */
router.get('/monthly/:year/:month', reportController.getMonthlyReport);

/**
 * @swagger
 * /api/reports/annual/{year}:
 *   get:
 *     tags: [Reports]
 *     summary: Generate annual tax report
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Annual tax report generated
 */
router.get(
  '/annual/:year',
  checkSubscriptionTier(SUBSCRIPTION_TIERS.PRO.name, SUBSCRIPTION_TIERS.ENTERPRISE.name),
  reportController.getAnnualReport
);

/**
 * @swagger
 * /api/reports/budget:
 *   get:
 *     tags: [Reports]
 *     summary: Generate budget vs actual report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget report generated
 */
router.get('/budget', reportController.getBudgetReport);

/**
 * @swagger
 * /api/reports/tax/{year}:
 *   get:
 *     tags: [Reports]
 *     summary: Generate tax report
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax report generated
 */
router.get(
  '/tax/:year',
  checkSubscriptionTier(SUBSCRIPTION_TIERS.PRO.name, SUBSCRIPTION_TIERS.ENTERPRISE.name),
  reportController.getTaxReport
);

/**
 * @swagger
 * /api/reports/custom:
 *   get:
 *     tags: [Reports]
 *     summary: Generate custom date range report
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Custom report generated
 */
router.get('/custom', reportController.getCustomReport);

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     tags: [Reports]
 *     summary: Export report as JSON or CSV
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [monthly, annual, budget]
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report exported
 */
router.post('/export', reportController.exportReport);

export default router;
