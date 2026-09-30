import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';
import { generateToken } from '../utils/helpers.js';

/**
 * Register user
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'Email already registered',
    });
  }

  // Create user
  const user = await User.create({
    email,
    password,
    name,
    subscriptionTier: 'FREE',
  });

  // Generate verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // Send verification email
  try {
    await sendWelcomeEmail(user);
    await sendVerificationEmail(user, verificationToken);
  } catch (error) {
    logger.error('Failed to send registration emails:', error);
  }

  // Create default subscription
  await Subscription.create({
    userId: user._id,
    plan: 'FREE',
    status: 'active',
  });

  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
      },
      tokens: {
        accessToken: token,
        refreshToken,
      },
    },
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password field
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Check if account is active
  if (!user.isActive || user.isBanned) {
    return res.status(403).json({
      success: false,
      message: 'Account is inactive or banned',
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
      },
      tokens: {
        accessToken: token,
        refreshToken,
      },
    },
  });
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req, res) => {
  // Token invalidation would typically be handled by frontend
  // Optionally, you could add the token to a blacklist in Redis

  res.json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * Refresh token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  try {
    const jwt = await import('jsonwebtoken').then((m) => m.default);
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret');

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const newAccessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
});

/**
 * Forgot password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists
    return res.json({
      success: true,
      message: 'If an account exists, a password reset email has been sent',
    });
  }

  const resetToken = user.generatePasswordResetToken();
  await user.save();

  try {
    await sendPasswordResetEmail(user, resetToken);
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  }

  res.json({
    success: true,
    message: 'Password reset email sent',
  });
});

/**
 * Reset password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token',
    });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.lastPasswordChange = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successful',
  });
});

/**
 * Verify email
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification token',
    });
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
});

/**
 * Update profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, preferences } = req.body;

  const user = await User.findById(req.user._id);

  if (name) {
    user.name = name;
  }

  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
      },
    },
  });
});

/**
 * Change password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  user.password = newPassword;
  user.lastPasswordChange = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Get current user
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        preferences: user.preferences,
        usageStats: user.usageStats,
      },
    },
  });
});

/**
 * Generate API key
 */
export const generateApiKey = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  const apiKey = user.generateApiKey();
  await user.save();

  res.json({
    success: true,
    message: 'API key generated successfully',
    data: {
      apiKey,
    },
  });
});

/**
 * Resend verification email
 */
export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email already verified',
    });
  }

  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  try {
    await sendVerificationEmail(user, verificationToken);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
  }

  res.json({
    success: true,
    message: 'Verification email sent',
  });
});
