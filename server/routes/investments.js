import express from 'express';
import * as investmentController from '../controllers/investmentController.js';
import { authenticateJWT, checkSubscriptionTier } from '../middleware/auth.js';
import { SUBSCRIPTION_TIERS } from '../config/constants.js';

const router = express.Router();

// All investment endpoints require authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: Investments
 *   description: Manage investments and portfolio
 */

/**
 * @swagger
 * /api/investments:
 *   post:
 *     tags: [Investments]
 *     summary: Create new investment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [stock, mutual_fund, crypto, gold, fd, ppf, bond]
 *               name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               quantity:
 *                 type: number
 *               buyPrice:
 *                 type: number
 *               buyDate:
 *                 type: string
 *                 format: date
 *               currency:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Investment created
 */
router.post('/', investmentController.createInvestment);

/**
 * @swagger
 * /api/investments:
 *   get:
 *     tags: [Investments]
 *     summary: Get all investments
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *         description: List of investments
 */
router.get('/', investmentController.getInvestments);

/**
 * @swagger
 * /api/investments/{id}:
 *   get:
 *     tags: [Investments]
 *     summary: Get investment by ID
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
 *         description: Investment details
 */
router.get('/:id', investmentController.getInvestment);

/**
 * @swagger
 * /api/investments/{id}:
 *   put:
 *     tags: [Investments]
 *     summary: Update investment
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
 *               quantity:
 *                 type: number
 *               currentPrice:
 *                 type: number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Investment updated
 */
router.put('/:id', investmentController.updateInvestment);

/**
 * @swagger
 * /api/investments/{id}:
 *   delete:
 *     tags: [Investments]
 *     summary: Delete investment
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
 *         description: Investment deleted
 */
router.delete('/:id', investmentController.deleteInvestment);

/**
 * @swagger
 * /api/investments/portfolio/summary:
 *   get:
 *     tags: [Investments]
 *     summary: Get portfolio summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio summary
 */
router.get('/portfolio/summary', investmentController.getPortfolioSummary);

/**
 * @swagger
 * /api/investments/portfolio/diversification:
 *   get:
 *     tags: [Investments]
 *     summary: Get portfolio diversification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio diversification analysis
 */
router.get(
  '/portfolio/diversification',
  investmentController.getPortfolioDiversification
);

/**
 * @swagger
 * /api/investments/portfolio/value:
 *   get:
 *     tags: [Investments]
 *     summary: Get portfolio value
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current portfolio value
 */
router.get('/portfolio/value', investmentController.getPortfolioValue);

/**
 * @swagger
 * /api/investments/{id}/price:
 *   put:
 *     tags: [Investments]
 *     summary: Update investment price
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
 *               currentPrice:
 *                 type: number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Price updated
 */
router.put('/:id/price', investmentController.updateInvestmentPrice);

/**
 * @swagger
 * /api/investments/{id}/sell:
 *   post:
 *     tags: [Investments]
 *     summary: Sell investment
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
 *               quantity:
 *                 type: number
 *               sellPrice:
 *                 type: number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Investment sold
 */
router.post('/:id/sell', investmentController.sellInvestment);

export default router;
