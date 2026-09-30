import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Plans catalog — public to the frontend so it can render pricing cards
// before the user even logs in.
router.get('/plans', subscriptionController.getPlans);

// Current subscription (auto-creates a FREE row if missing).
router.get('/', authenticateJWT, subscriptionController.getSubscription);
router.get('/current', authenticateJWT, subscriptionController.getCurrentSubscription);

// Checkout / upgrades.
router.post('/checkout', authenticateJWT, subscriptionController.createCheckoutSession);
router.post('/upgrade', authenticateJWT, subscriptionController.upgradePlan);
router.post('/downgrade', authenticateJWT, subscriptionController.downgradePlan);
router.post('/cancel', authenticateJWT, subscriptionController.cancelSubscription);
router.post('/resume', authenticateJWT, subscriptionController.resumeSubscription);

// Billing history.
router.get('/billing-history', authenticateJWT, subscriptionController.getBillingHistory);
router.get('/invoices/:id', authenticateJWT, subscriptionController.getInvoice);

// Usage stats (both legacy and frontend path).
router.get('/usage', authenticateJWT, subscriptionController.getUsageStats);
router.get('/usage-stats', authenticateJWT, subscriptionController.getUsageStats);

// Payment methods.
router.post('/payment-method', authenticateJWT, subscriptionController.updatePaymentMethod);
router.post('/payment-methods', authenticateJWT, subscriptionController.updatePaymentMethod);
router.delete('/payment-methods/:id', authenticateJWT, subscriptionController.removePaymentMethod);

// Stripe webhook — raw body required for signature verification.
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleWebhook
);

// Razorpay — public key for the checkout widget.
router.get('/razorpay/key', subscriptionController.getRazorpayKey);

// Razorpay — create order, verify payment signature.
router.post('/razorpay/order', authenticateJWT, subscriptionController.createRazorpayOrder);
router.post('/razorpay/verify', authenticateJWT, subscriptionController.verifyRazorpayPayment);

// Razorpay webhook — raw body required for signature verification.
router.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleRazorpayWebhook
);

export default router;
