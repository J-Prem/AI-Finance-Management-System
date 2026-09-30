import { body, query, validationResult } from 'express-validator';
import { TRANSACTION_CATEGORIES, PAYMENT_METHODS, CURRENCY_CODES } from '../config/constants.js';

/**
 * Create transaction validation
 */
export const validateCreateTransaction = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage('Invalid category'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('paymentMethod')
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('merchant')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Merchant cannot exceed 100 characters'),
  body('currency')
    .optional()
    .isIn(CURRENCY_CODES)
    .withMessage('Invalid currency code'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('isRecurring must be a boolean'),
  body('recurringPattern')
    .optional()
    .isIn(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Invalid recurring pattern'),
];

/**
 * Update transaction validation
 */
export const validateUpdateTransaction = [
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('category')
    .optional()
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage('Invalid category'),
  body('type')
    .optional()
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('paymentMethod')
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('merchant')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Merchant cannot exceed 100 characters'),
  body('currency')
    .optional()
    .isIn(CURRENCY_CODES)
    .withMessage('Invalid currency code'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

/**
 * List transactions validation
 */
export const validateListTransactions = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['date', 'amount', 'category', 'merchant', 'createdAt'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  query('category')
    .optional()
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage('Invalid category'),
  query('type')
    .optional()
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  query('merchant')
    .optional()
    .trim(),
  query('search')
    .optional()
    .trim(),
];

/**
 * Bulk import validation
 */
export const validateBulkImport = [
  body('transactions')
    .notEmpty()
    .withMessage('Transactions array is required')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Transactions must be an array with 1-1000 items'),
  body('transactions.*.amount')
    .notEmpty()
    .isFloat({ min: 0 })
    .withMessage('Each transaction must have a valid amount'),
  body('transactions.*.category')
    .notEmpty()
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage('Each transaction must have a valid category'),
  body('transactions.*.type')
    .notEmpty()
    .isIn(['income', 'expense'])
    .withMessage('Each transaction must have a valid type'),
  body('transactions.*.date')
    .notEmpty()
    .isISO8601()
    .withMessage('Each transaction must have a valid date'),
];

/**
 * Export transactions validation
 */
export const validateExportTransactions = [
  query('format')
    .optional()
    .isIn(['csv', 'json', 'pdf'])
    .withMessage('Invalid export format'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  query('category')
    .optional()
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage('Invalid category'),
];

/**
 * Transaction ID validation
 */
export const validateTransactionId = [
  body('id')
    .notEmpty()
    .isMongoId()
    .withMessage('Invalid transaction ID'),
];

/**
 * Validation error handler middleware
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map((err) => ({
        field: err.param,
        value: err.value,
        message: err.msg,
      })),
    });
  }
  next();
};
