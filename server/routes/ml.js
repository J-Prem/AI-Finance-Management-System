import express from 'express';
import * as mlController from '../controllers/mlController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route POST /api/ml/categorize
 * @desc Categorize transaction
 * @access Private
 */
router.post('/categorize', mlController.categorizeTransaction);

/**
 * @route POST /api/ml/anomalies
 * @desc Detect anomalies
 * @access Private
 */
router.post('/anomalies', mlController.detectAnomalies);

/**
 * @route GET /api/ml/predictions
 * @desc Get spending predictions
 * @access Private
 */
router.get('/predictions', mlController.getSpendingPredictions);

/**
 * @route GET /api/ml/personality
 * @desc Get spending personality
 * @access Private
 */
router.get('/personality', mlController.getSpendingPersonality);

/**
 * @route GET /api/ml/health
 * @desc Get financial health score
 * @access Private
 */
router.get('/health', mlController.getFinancialHealth);

/**
 * @route GET /api/ml/dna
 * @desc Get spending DNA
 * @access Private
 */
router.get('/dna', mlController.getSpendingDNA);

/**
 * @route POST /api/ml/what-if
 * @desc Run what-if simulation
 * @access Private
 */
router.post('/what-if', mlController.runWhatIfSimulation);

/**
 * @route POST /api/ml/recurring
 * @desc Detect recurring transactions
 * @access Private
 */
router.post('/recurring', mlController.detectRecurringTransactions);

/**
 * @route GET /api/ml/patterns
 * @desc Get behavioral patterns
 * @access Private
 */
router.get('/patterns', mlController.getBehavioralPatterns);

/**
 * @route GET /api/ml/opportunities
 * @desc Get saving opportunities
 * @access Private
 */
router.get('/opportunities', mlController.getSavingOpportunities);

/**
 * @route POST /api/ml/subscriptions
 * @desc Detect subscriptions
 * @access Private
 */
router.post('/subscriptions', mlController.detectSubscriptions);

/**
 * @route GET /api/ml/merchant/:merchant
 * @desc Get merchant insights
 * @access Private
 */
router.get('/merchant/:merchant', mlController.getMerchantInsights);

/**
 * @route POST /api/ml/optimize-budgets
 * @desc Optimize budgets
 * @access Private
 */
router.post('/optimize-budgets', mlController.optimizeBudgets);

/**
 * @route POST /api/ml/cache/clear
 * @desc Clear ML cache
 * @access Private
 */
router.post('/cache/clear', mlController.clearCache);

/**
 * @route GET /api/ml/health-check
 * @desc Health check
 * @access Private
 */
router.get('/health-check', mlController.healthCheck);

export default router;
