import express from 'express';
import * as budgetController from '../controllers/budgetController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route POST /api/budgets
 * @desc Create budget
 * @access Private
 */
router.post('/', budgetController.createBudget);

/**
 * @route GET /api/budgets
 * @desc Get all budgets
 * @access Private
 */
router.get('/', budgetController.getBudgets);

/**
 * @route GET /api/budgets/:id
 * @desc Get single budget
 * @access Private
 */
router.get('/:id', budgetController.getBudget);

/**
 * @route PATCH /api/budgets/:id
 * @desc Update budget
 * @access Private
 */
router.patch('/:id', budgetController.updateBudget);

/**
 * @route DELETE /api/budgets/:id
 * @desc Delete budget
 * @access Private
 */
router.delete('/:id', budgetController.deleteBudget);

/**
 * @route GET /api/budgets/status/all
 * @desc Get budget status
 * @access Private
 */
router.get('/status/all', budgetController.getBudgetStatus);

/**
 * @route GET /api/budgets/alerts/pending
 * @desc Get budget alerts
 * @access Private
 */
router.get('/alerts/pending', budgetController.getBudgetAlerts);

/**
 * @route POST /api/budgets/:id/reset
 * @desc Reset budget spending
 * @access Private
 */
router.post('/:id/reset', budgetController.resetBudgetSpending);

/**
 * @route GET /api/budgets/:id/comparison
 * @desc Compare budget vs actual
 * @access Private
 */
router.get('/:id/comparison', budgetController.compareBudgetVsActual);

/**
 * @route POST /api/budgets/:id/alerts
 * @desc Add budget alert
 * @access Private
 */
router.post('/:id/alerts', budgetController.addBudgetAlert);

/**
 * @route POST /api/budgets/:id/share
 * @desc Share budget with team
 * @access Private
 */
router.post('/:id/share', budgetController.shareBudget);

export default router;
