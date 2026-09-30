import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

let transporter;

/**
 * Initialize email service
 */
const initEmailService = async () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: use real email service
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: use test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  logger.info('Email service initialized');
};

/**
 * Send email
 */
export const sendEmail = async (to, subject, html, text = '') => {
  try {
    if (!transporter) {
      await initEmailService();
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@aifinance.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent to ${to}: ${info.messageId}`);

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (user) => {
  const html = `
    <h1>Welcome to AI Finance Management!</h1>
    <p>Hi ${user.name},</p>
    <p>Thank you for creating an account. We're excited to help you manage your finances with AI-powered insights.</p>
    <p>To get started:</p>
    <ol>
      <li>Add your transactions</li>
      <li>Set up budgets</li>
      <li>View AI-powered analytics</li>
    </ol>
    <a href="${process.env.APP_URL}/verify?token=${user.emailVerificationToken}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Welcome to AI Finance Management!', html);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

  const html = `
    <h1>Password Reset Request</h1>
    <p>Hi ${user.name},</p>
    <p>You requested to reset your password. Click the link below to set a new password:</p>
    <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Reset Your Password', html);
};

/**
 * Send budget alert email
 */
export const sendBudgetAlertEmail = async (user, budget, threshold) => {
  const percentSpent = Math.round((budget.spent / budget.amount) * 100);

  const html = `
    <h1>Budget Alert</h1>
    <p>Hi ${user.name},</p>
    <p>You've reached ${percentSpent}% of your <strong>${budget.name}</strong> budget.</p>
    <p>
      <strong>Budget Details:</strong><br/>
      Category: ${budget.category}<br/>
      Total Budget: $${budget.amount.toFixed(2)}<br/>
      Spent: $${budget.spent.toFixed(2)}<br/>
      Remaining: $${Math.max(0, budget.amount - budget.spent).toFixed(2)}
    </p>
    <a href="${process.env.APP_URL}/budgets/${budget._id}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Budget</a>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, `Budget Alert: ${budget.name} at ${percentSpent}%`, html);
};

/**
 * Send anomaly detected email
 */
export const sendAnomalyDetectedEmail = async (user, transaction, anomalyScore) => {
  const html = `
    <h1>Unusual Spending Detected</h1>
    <p>Hi ${user.name},</p>
    <p>We detected an unusual transaction that might be worth investigating:</p>
    <p>
      <strong>Transaction Details:</strong><br/>
      Description: ${transaction.description}<br/>
      Amount: $${transaction.amount.toFixed(2)}<br/>
      Category: ${transaction.category}<br/>
      Date: ${new Date(transaction.date).toLocaleDateString()}<br/>
      Anomaly Score: ${(anomalyScore * 100).toFixed(0)}%
    </p>
    <a href="${process.env.APP_URL}/transactions/${transaction._id}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Review Transaction</a>
    <p>If this looks incorrect, you can edit or delete the transaction from your dashboard.</p>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Unusual Spending Detected', html);
};

/**
 * Send weekly digest email
 */
export const sendWeeklyDigestEmail = async (user, weeklyStats) => {
  const { totalSpent, totalIncome, transactions, byCategory } = weeklyStats;

  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, amount]) => `<li>${category}: $${amount.toFixed(2)}</li>`)
    .join('');

  const html = `
    <h1>Weekly Finance Digest</h1>
    <p>Hi ${user.name},</p>
    <p>Here's a summary of your finances this week:</p>
    <p>
      <strong>Summary:</strong><br/>
      Total Income: $${totalIncome.toFixed(2)}<br/>
      Total Spending: $${totalSpent.toFixed(2)}<br/>
      Net: $${(totalIncome - totalSpent).toFixed(2)}<br/>
      Transactions: ${transactions.length}
    </p>
    <p>
      <strong>Spending by Category:</strong><br/>
      <ul>${categoryBreakdown}</ul>
    </p>
    <a href="${process.env.APP_URL}/analytics" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Analytics</a>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Weekly Finance Digest', html);
};

/**
 * Send team invitation email
 */
export const sendTeamInvitationEmail = async (inviteeEmail, team, inviteCode) => {
  const acceptUrl = `${process.env.APP_URL}/accept-invitation?code=${inviteCode}`;

  const html = `
    <h1>Team Invitation</h1>
    <p>You've been invited to join <strong>${team.name}</strong> on AI Finance Management.</p>
    <p>Click the link below to accept the invitation:</p>
    <a href="${acceptUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Accept Invitation</a>
    <p>This invitation will expire in 7 days.</p>
    <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(inviteeEmail, `You're invited to join ${team.name}`, html);
};

/**
 * Send payment failed email
 */
export const sendPaymentFailedEmail = async (user, subscription) => {
  const html = `
    <h1>Payment Failed</h1>
    <p>Hi ${user.name},</p>
    <p>We were unable to process your payment for your subscription.</p>
    <p>
      <strong>Subscription Details:</strong><br/>
      Plan: ${subscription.plan}<br/>
      Amount: ${(subscription.invoices[subscription.invoices.length - 1]?.amount || 0) / 100}
    </p>
    <p>Please update your payment method to avoid service interruption.</p>
    <a href="${process.env.APP_URL}/billing" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Update Payment Method</a>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Payment Failed', html);
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (user, verificationToken) => {
  const verifyUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;

  const html = `
    <h1>Verify Your Email</h1>
    <p>Hi ${user.name},</p>
    <p>Please verify your email address to complete your account setup:</p>
    <a href="${verifyUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
    <p>Best regards,<br/>The AI Finance Team</p>
  `;

  await sendEmail(user.email, 'Verify Your Email', html);
};

export { initEmailService };
