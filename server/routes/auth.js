import express from 'express';
import * as authController from '../controllers/authController.js';
import * as authValidator from '../validators/authValidator.js';
import { authenticateJWT } from '../middleware/auth.js';
import { loginRateLimiter, registrationRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post(
  '/register',
  registrationRateLimiter,
  authValidator.validateRegister,
  authValidator.handleValidationErrors,
  authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  loginRateLimiter,
  authValidator.validateLogin,
  authValidator.handleValidationErrors,
  authController.login
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticateJWT, authController.logout);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post(
  '/refresh',
  authValidator.validateRefreshToken,
  authValidator.handleValidationErrors,
  authController.refreshToken
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  authValidator.validatePasswordResetRequest,
  authValidator.handleValidationErrors,
  authController.forgotPassword
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password
 * @access Public
 */
router.post(
  '/reset-password',
  authValidator.validatePasswordReset,
  authValidator.handleValidationErrors,
  authController.resetPassword
);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email address
 * @access Public
 */
router.post(
  '/verify-email',
  authValidator.validateEmailVerification,
  authValidator.handleValidationErrors,
  authController.verifyEmail
);

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend verification email
 * @access Public
 */
router.post(
  '/resend-verification',
  authValidator.validatePasswordResetRequest,
  authValidator.handleValidationErrors,
  authController.resendVerificationEmail
);

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', authenticateJWT, authController.getCurrentUser);

/**
 * @route PATCH /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.patch(
  '/profile',
  authenticateJWT,
  authValidator.validateUpdateProfile,
  authValidator.handleValidationErrors,
  authController.updateProfile
);

/**
 * @route POST /api/auth/change-password
 * @desc Change password
 * @access Private
 */
router.post(
  '/change-password',
  authenticateJWT,
  authValidator.validateChangePassword,
  authValidator.handleValidationErrors,
  authController.changePassword
);

/**
 * @route POST /api/auth/generate-api-key
 * @desc Generate API key
 * @access Private
 */
router.post(
  '/generate-api-key',
  authenticateJWT,
  authController.generateApiKey
);

export default router;
