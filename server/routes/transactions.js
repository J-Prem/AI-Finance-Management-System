import express from 'express';
import * as transactionController from '../controllers/transactionController.js';
import * as transactionValidator from '../validators/transactionValidator.js';
import { authenticateJWT, authenticateApiKey } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/transactions
 * @desc Create transaction
 * @access Private
 */
router.post(
  '/',
  authenticateJWT,
  transactionValidator.validateCreateTransaction,
  transactionValidator.handleValidationErrors,
  transactionController.createTransaction
);

/**
 * @route GET /api/transactions
 * @desc Get all transactions
 * @access Private
 */
router.get(
  '/',
  authenticateJWT,
  transactionValidator.validateListTransactions,
  transactionValidator.handleValidationErrors,
  transactionController.getTransactions
);

/**
 * @route GET /api/transactions/:id
 * @desc Get single transaction
 * @access Private
 */
router.get(
  '/:id',
  authenticateJWT,
  transactionController.getTransaction
);

/**
 * @route PATCH /api/transactions/:id
 * @desc Update transaction
 * @access Private
 */
router.patch(
  '/:id',
  authenticateJWT,
  transactionValidator.validateUpdateTransaction,
  transactionValidator.handleValidationErrors,
  transactionController.updateTransaction
);

/**
 * @route DELETE /api/transactions/:id
 * @desc Delete transaction
 * @access Private
 */
router.delete(
  '/:id',
  authenticateJWT,
  transactionController.deleteTransaction
);

/**
 * @route GET /api/transactions/summary/overview
 * @desc Get spending summary
 * @access Private
 */
router.get('/summary/overview', authenticateJWT, transactionController.getSpendingSummary);

/**
 * @route GET /api/transactions/category/breakdown
 * @desc Get category breakdown
 * @access Private
 */
router.get('/category/breakdown', authenticateJWT, transactionController.getCategoryBreakdown);

/**
 * @route POST /api/transactions/bulk-import
 * @desc Bulk import transactions
 * @access Private
 */
router.post(
  '/bulk-import',
  authenticateJWT,
  transactionValidator.validateBulkImport,
  transactionValidator.handleValidationErrors,
  transactionController.bulkImportTransactions
);

/**
 * @route GET /api/transactions/export
 * @desc Export transactions
 * @access Private
 */
router.get(
  '/export',
  authenticateJWT,
  transactionValidator.validateExportTransactions,
  transactionValidator.handleValidationErrors,
  transactionController.exportTransactions
);

export default router;
