import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route GET /api/analytics/trends
 * @desc Get spending trends
 * @access Private
 */
router.get('/trends', analyticsController.getSpendingTrends);

/**
 * @route GET /api/analytics/categories
 * @desc Get category breakdown
 * @access Private
 */
router.get('/categories', analyticsController.getCategoryBreakdown);

/**
 * @route GET /api/analytics/monthly
 * @desc Get monthly comparison
 * @access Private
 */
router.get('/monthly', analyticsController.getMonthlyComparison);

/**
 * @route GET /api/analytics/income-expense
 * @desc Get income vs expense
 * @access Private
 */
router.get('/income-expense', analyticsController.getIncomeVsExpense);

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard stats
 * @access Private
 */
router.get('/dashboard', analyticsController.getDashboardStats);

/**
 * @route GET /api/analytics/savings-rate
 * @desc Get savings rate analysis
 * @access Private
 */
router.get('/savings-rate', analyticsController.getSavingsRateAnalysis);

/**
 * @route GET /api/analytics/anomalies
 * @desc Get anomalies
 * @access Private
 */
router.get('/anomalies', analyticsController.getAnomalies);

/**
 * @route GET /api/analytics/financial-health
 * @desc Get dynamic financial health score (0-100)
 * @access Private
 */
router.get('/financial-health', analyticsController.getFinancialHealth);

/**
 * @route GET /api/analytics/ai-insights
 * @desc Get AI insights
 * @access Private
 */
router.get('/ai-insights', analyticsController.getAIInsights);

/**
 * @route POST /api/analytics/what-if
 * @desc Run what-if scenarios
 * @access Private
 */
router.post('/what-if', analyticsController.getWhatIfScenarios);

export default router;
