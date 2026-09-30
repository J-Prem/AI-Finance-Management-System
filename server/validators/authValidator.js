import { body, validationResult } from 'express-validator';
import { isStrongPassword } from '../utils/helpers.js';

export const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').custom((value) => {
    if (!isStrongPassword(value)) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
    return true;
  }),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const validatePasswordResetRequest = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
];

export const validatePasswordReset = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').custom((value) => {
    if (!isStrongPassword(value)) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
    return true;
  }),
];

export const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters').custom((value) => {
    if (!isStrongPassword(value)) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

export const validateUpdateProfile = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('preferences').optional().isObject().withMessage('Preferences must be an object'),
  body('preferences.currency').optional().isIn(['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','MXN','BRL']).withMessage('Invalid currency'),
  body('preferences.timezone').optional().notEmpty().withMessage('Timezone is required'),
  body('preferences.language').optional().isIn(['en','es','fr','de','it','pt','ja','zh']).withMessage('Invalid language'),
];

export const validateRefreshToken = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

export const validateEmailVerification = [
  body('token').notEmpty().withMessage('Verification token is required'),
];

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  next();
};
