/**
 * Subscription controller
 *
 * Backed by MongoDB Atlas. Stripe is optional — when
 * ENABLE_STRIPE_PAYMENTS is not "true", the controller falls back to a
 * direct in-DB plan switch so the free-tier upgrade flow keeps working
 * without requiring real card processing.
 */
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import AuditLog from '../models/AuditLog.js';
import ChatHistory from '../models/ChatHistory.js';
import Receipt from '../models/Receipt.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import razorpayService from '../services/razorpayService.js';

// --- Plan catalog -----------------------------------------------------------
//
// Single source of truth for plan IDs, prices, limits and feature lists.
// The frontend pulls this catalog from /api/subscriptions/plans so we only
// have to edit one place to ship a new tier.

export const PLAN_CATALOG = {
  FREE: {
    id: 'free',
    code: 'FREE',
    name: 'Free',
    price: 0,
    currency: 'USD',
    period: 'month',
    features: [
      'Up to 100 transactions/month',
      '20 receipt scans/month',
      'Basic analytics',
      'Personality insights',
      'Email support',
    ],
    limits: {
      apiCallsPerDay: 200,
      transactionsPerMonth: 100,
      mlPredictionsPerMonth: 50,
      receiptsPerMonth: 20,
    },
  },
  PRO: {
    id: 'pro',
    code: 'PRO',
    name: 'Pro',
    price: 9.99,
    priceINR: 799,
    currency: 'USD',
    period: 'month',
    popular: true,
    features: [
      'Unlimited transactions',
      'Unlimited receipt scans',
      'Advanced analytics & forecasting',
      'AI categorization & anomaly detection',
      'Investment portfolio tracking',
      'Priority email support',
    ],
    limits: {
      apiCallsPerDay: 5000,
      transactionsPerMonth: 0,
      mlPredictionsPerMonth: 1000,
      receiptsPerMonth: 0,
    },
  },
  ENTERPRISE: {
    id: 'enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 49.99,
    priceINR: 3999,
    currency: 'USD',
    period: 'month',
    features: [
      'Everything in Pro',
      'Multi-user team workspaces',
      'API key access for integrations',
      'Dedicated account manager',
      'Custom retention policies',
      'SLA-backed support',
    ],
    limits: {
      apiCallsPerDay: 50000,
      transactionsPerMonth: 0,
      mlPredictionsPerMonth: 0,
      receiptsPerMonth: 0,
    },
  },
};

const PLAN_BY_ID = Object.values(PLAN_CATALOG).reduce((acc, p) => {
  acc[p.id] = p;
  acc[p.code] = p;
  acc[p.code.toLowerCase()] = p;
  return acc;
}, {});

const stripeEnabled = () => process.env.ENABLE_STRIPE_PAYMENTS === 'true';

// Lazy-load Stripe so the controller does not crash when the SDK or
// secret key are missing in dev/free-tier setups.
async function getStripe() {
  if (!stripeEnabled()) return null;
  try {
    const mod = await import('../config/stripe.js');
    return mod.default;
  } catch (err) {
    logger.warn(`Stripe SDK unavailable: ${err.message}`);
    return null;
  }
}

// Ensure every authenticated user has a Subscription doc — the frontend
// loads the current plan on mount so we should not 404 a brand new user.
async function ensureSubscription(userId) {
  let sub = await Subscription.findOne({ userId });
  if (!sub) {
    const limits = PLAN_CATALOG.FREE.limits;
    sub = await Subscription.create({
      userId,
      plan: 'FREE',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      usage: {
        apiCalls: { current: 0, limit: limits.apiCallsPerDay, resetDate: new Date() },
        transactions: { current: 0, limit: limits.transactionsPerMonth, resetDate: new Date() },
        mlPredictions: { current: 0, limit: limits.mlPredictionsPerMonth, resetDate: new Date() },
      },
    });
  }
  return sub;
}

// Build the response shape the SubscriptionPage expects: enrich the raw
// Mongo doc with the catalog data so the UI gets price/features in one
// round trip.
function decorateSubscription(sub) {
  const plain = sub.toObject ? sub.toObject({ virtuals: true }) : sub;
  const planMeta = PLAN_CATALOG[plain.plan] || PLAN_CATALOG.FREE;
  return {
    ...plain,
    planMeta,
    daysRemaining: plain.currentPeriodEnd
      ? Math.max(0, Math.ceil((new Date(plain.currentPeriodEnd) - new Date()) / 86_400_000))
      : null,
  };
}

// --- Endpoints --------------------------------------------------------------

/**
 * GET /api/subscriptions
 * GET /api/subscriptions/current
 *
 * Returns the user's subscription, auto-creating a FREE row if needed.
 */
export const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await ensureSubscription(req.user._id);
  res.json({ success: true, data: { subscription: decorateSubscription(subscription) } });
});

export const getCurrentSubscription = getSubscription;

/**
 * GET /api/subscriptions/plans
 *
 * Public-ish catalog used by the pricing cards.
 */
export const getPlans = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      plans: Object.values(PLAN_CATALOG),
      stripeEnabled: stripeEnabled(),
      razorpayEnabled: true,
      razorpayKeyId: razorpayService.getPublicKey(),
    },
  });
});

/**
 * POST /api/subscriptions/checkout
 *
 * Creates a Stripe Checkout session when Stripe is available; otherwise
 * falls back to the direct upgrade path so the button still does
 * something useful in free-tier deployments.
 */
export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const planMeta = PLAN_BY_ID[plan];
  if (!planMeta || planMeta.code === 'FREE') {
    return res.status(400).json({ success: false, message: 'Invalid plan' });
  }

  const subscription = await ensureSubscription(req.user._id);
  const stripe = await getStripe();

  if (!stripe) {
    // Stripe-less mode: switch the plan immediately and tell the
    // frontend to skip the redirect.
    return upgradePlanInline(req.user._id, planMeta.code).then((updated) =>
      res.json({
        success: true,
        data: {
          mode: 'inline',
          subscription: decorateSubscription(updated),
        },
      })
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: planMeta.currency.toLowerCase(),
            product_data: { name: `AI Finance ${planMeta.name}` },
            unit_amount: Math.round(planMeta.price * 100),
            recurring: { interval: 'month', interval_count: 1 },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'http://localhost:5173'}/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5173'}/subscription?status=cancel`,
      metadata: { userId: req.user._id.toString(), plan: planMeta.code },
    });

    res.json({ success: true, data: { mode: 'stripe', sessionId: session.id, url: session.url } });
  } catch (error) {
    logger.error('Checkout session creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
});

// Shared inline upgrade helper used by upgrade/checkout fallback.
async function upgradePlanInline(userId, planCode) {
  const planMeta = PLAN_BY_ID[planCode];
  if (!planMeta) throw new Error('Unknown plan');
  const sub = await ensureSubscription(userId);
  sub.upgradePlan(planMeta.code, planMeta.limits);
  sub.status = 'active';
  sub.currentPeriodStart = new Date();
  sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  sub.cancelledAt = null;
  sub.cancelAtPeriodEnd = false;
  // Drop a synthetic invoice so billing history isn't perpetually empty
  // for users who never went through Stripe.
  if (planMeta.price > 0) {
    sub.invoices.push({
      stripeInvoiceId: `inline_${Date.now()}`,
      amount: planMeta.price,
      currency: planMeta.currency.toLowerCase(),
      status: 'paid',
      invoiceDate: new Date(),
      description: `${planMeta.name} plan – inline upgrade`,
    });
  }
  await sub.save();
  await User.findByIdAndUpdate(userId, { subscriptionTier: planMeta.code });
  return sub;
}

/**
 * POST /api/subscriptions/upgrade
 *
 * Accepts either { plan } or { planId } / { newPlan } from older clients.
 */
export const upgradePlan = asyncHandler(async (req, res) => {
  const planId = req.body.planId || req.body.plan || req.body.newPlan;
  const planMeta = PLAN_BY_ID[planId];
  if (!planMeta) {
    return res.status(400).json({ success: false, message: 'Unknown plan' });
  }
  const updated = await upgradePlanInline(req.user._id, planMeta.code);
  res.json({
    success: true,
    message: `Upgraded to ${planMeta.name}`,
    data: { subscription: decorateSubscription(updated) },
  });
});

/**
 * POST /api/subscriptions/downgrade
 *
 * Treats downgrade as a plan-switch. In Stripe-mode this would schedule
 * the change at period end; in inline-mode we apply it immediately.
 */
export const downgradePlan = asyncHandler(async (req, res) => {
  const planId = req.body.planId || req.body.plan;
  const planMeta = PLAN_BY_ID[planId];
  if (!planMeta) {
    return res.status(400).json({ success: false, message: 'Unknown plan' });
  }
  const updated = await upgradePlanInline(req.user._id, planMeta.code);
  res.json({
    success: true,
    message: `Switched to ${planMeta.name}`,
    data: { subscription: decorateSubscription(updated) },
  });
});

/**
 * POST /api/subscriptions/cancel
 */
export const cancelSubscription = asyncHandler(async (req, res) => {
  const { immediately = false } = req.body || {};
  const subscription = await ensureSubscription(req.user._id);
  subscription.cancel(Boolean(immediately));
  await subscription.save();
  res.json({
    success: true,
    message: immediately ? 'Subscription cancelled' : 'Subscription will not renew',
    data: { subscription: decorateSubscription(subscription) },
  });
});

/**
 * POST /api/subscriptions/resume
 *
 * Undo a pending cancellation as long as the period hasn't ended.
 */
export const resumeSubscription = asyncHandler(async (req, res) => {
  const subscription = await ensureSubscription(req.user._id);
  subscription.cancelAtPeriodEnd = false;
  subscription.cancelledAt = null;
  if (subscription.status === 'cancelled') {
    subscription.status = 'active';
  }
  await subscription.save();
  res.json({
    success: true,
    message: 'Subscription resumed',
    data: { subscription: decorateSubscription(subscription) },
  });
});

/**
 * GET /api/subscriptions/billing-history
 *
 * Returns persisted invoices plus a virtual "current period" entry that
 * always reflects the live state of the subscription so the UI never
 * looks empty for users who haven't yet been through a Stripe webhook.
 * The virtual row uses a `current_*` ID so the client can dedupe if a
 * persisted invoice for the same period later arrives.
 */
export const getBillingHistory = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const subscription = await ensureSubscription(req.user._id);
  const planMeta = PLAN_CATALOG[subscription.plan] || PLAN_CATALOG.FREE;

  const persisted = (subscription.invoices || []).map((inv) => {
    const obj = inv.toObject ? inv.toObject() : inv;
    return {
      ...obj,
      currency: obj.currency || planMeta.currency || 'USD',
      description: obj.description || `${planMeta.name} plan – billing period`,
    };
  });

  // Virtual current-period entry — keeps the table populated and useful
  // even on the FREE tier, where Stripe never writes an invoice.
  const periodStart = subscription.currentPeriodStart || new Date();
  const periodEnd = subscription.currentPeriodEnd
    || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const virtualId = `current_${planMeta.code}_${new Date(periodStart).toISOString().slice(0, 10)}`;
  const alreadyPresent = persisted.some(
    (i) => String(i.stripeInvoiceId || i._id) === virtualId
  );
  const all = [...persisted];
  if (!alreadyPresent) {
    all.push({
      _id: virtualId,
      stripeInvoiceId: virtualId,
      invoiceDate: periodStart,
      periodStart,
      periodEnd,
      amount: planMeta.price || 0,
      currency: planMeta.currency || 'USD',
      description: `${planMeta.name} plan – ${new Date(periodStart).toLocaleDateString()} → ${new Date(periodEnd).toLocaleDateString()}`,
      status: planMeta.code === 'FREE' ? 'free' : (subscription.status === 'active' ? 'paid' : 'pending'),
      pdfUrl: null,
      virtual: true,
    });
  }

  const sorted = all.sort(
    (a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0)
  );
  const start = (page - 1) * limit;
  const paged = sorted.slice(start, start + limit);
  res.json({
    success: true,
    data: {
      invoices: paged,
      total: sorted.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(sorted.length / limit)),
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/subscriptions/usage
 * GET /api/subscriptions/usage-stats
 *
 * Real-time usage. Counts derive directly from MongoDB so the meters
 * reflect actual user activity even though the legacy `trackApiUsage`
 * middleware isn't wired to every route. Sources:
 *   - apiCalls       → AuditLog rows for this user, today
 *   - transactions   → Transaction rows for this user, this month
 *   - mlPredictions  → ChatHistory rows for this user, this month
 *   - receipts       → Receipt rows for this user, this month
 * The persisted `subscription.usage` field is also kept in sync so the
 * limit-enforcement middleware sees fresh numbers if it ever runs.
 */
export const getUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscription = await ensureSubscription(userId);

  const planMeta = PLAN_CATALOG[subscription.plan] || PLAN_CATALOG.FREE;
  const limits = planMeta.limits || {};

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Live counters — gracefully degrade if any model is unavailable.
  const safeCount = (model, query) =>
    model && typeof model.countDocuments === 'function'
      ? model.countDocuments(query).catch(() => 0)
      : Promise.resolve(0);

  const [apiCallsToday, txnsThisMonth, chatThisMonth, receiptsThisMonth] = await Promise.all([
    safeCount(AuditLog, { userId, createdAt: { $gte: startOfDay } }),
    safeCount(Transaction, { userId, createdAt: { $gte: startOfMonth } }),
    safeCount(ChatHistory, { userId, createdAt: { $gte: startOfMonth } }),
    safeCount(Receipt, { userId, createdAt: { $gte: startOfMonth } }),
  ]);

  const usage = {
    apiCalls: {
      current: apiCallsToday,
      limit: limits.apiCallsPerDay || 0,
      resetDate: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
    },
    transactions: {
      current: txnsThisMonth,
      limit: limits.transactionsPerMonth || 0,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    },
    mlPredictions: {
      current: chatThisMonth,
      limit: limits.mlPredictionsPerMonth || 0,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    },
    receipts: {
      current: receiptsThisMonth,
      limit: limits.receiptsPerMonth || 0,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    },
  };

  // Persist the latest counts so other middleware sees them too — best
  // effort, never block the response on this.
  try {
    subscription.usage = {
      ...subscription.usage,
      apiCalls: usage.apiCalls,
      transactions: usage.transactions,
      mlPredictions: usage.mlPredictions,
    };
    subscription.markModified('usage');
    subscription.save().catch(() => {});
  } catch (err) {
    logger.debug(`usage write-through skipped: ${err.message}`);
  }

  const pct = (used, lim) => (!lim ? 0 : Math.min(100, Math.round((used / lim) * 100)));

  res.json({
    success: true,
    data: {
      usage,
      summary: {
        plan: subscription.plan,
        apiCallsPct: pct(usage.apiCalls.current, usage.apiCalls.limit),
        transactionsPct: pct(usage.transactions.current, usage.transactions.limit),
        mlPredictionsPct: pct(usage.mlPredictions.current, usage.mlPredictions.limit),
        receiptsPct: pct(usage.receipts.current, usage.receipts.limit),
        computedAt: now.toISOString(),
      },
    },
  });
});

/**
 * POST /api/subscriptions/payment-method
 * POST /api/subscriptions/payment-methods
 */
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethodId, brand, last4, expMonth, expYear } = req.body || {};
  const subscription = await ensureSubscription(req.user._id);
  const stripe = await getStripe();

  if (stripe && paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      subscription.updatePaymentMethod(pm.card);
    } catch (error) {
      logger.error('Payment method retrieval error:', error);
      return res.status(500).json({ success: false, message: 'Failed to validate payment method' });
    }
  } else if (brand || last4) {
    // Stripe-less mode: trust the metadata the client submits so the
    // user at least sees their card on file in the UI.
    subscription.paymentMethod = {
      id: paymentMethodId || `manual_${Date.now()}`,
      brand: brand || 'card',
      last4: String(last4 || '0000').slice(-4),
      expMonth: Number(expMonth) || undefined,
      expYear: Number(expYear) || undefined,
    };
  } else {
    return res.status(400).json({ success: false, message: 'Missing payment method details' });
  }

  await subscription.save();
  res.json({
    success: true,
    message: 'Payment method updated',
    data: { subscription: decorateSubscription(subscription) },
  });
});

/**
 * DELETE /api/subscriptions/payment-methods/:id
 */
export const removePaymentMethod = asyncHandler(async (req, res) => {
  const subscription = await ensureSubscription(req.user._id);
  if (!subscription.paymentMethod || subscription.paymentMethod.id !== req.params.id) {
    return res.status(404).json({ success: false, message: 'Payment method not found' });
  }
  subscription.paymentMethod = undefined;
  await subscription.save();
  res.json({ success: true, message: 'Payment method removed' });
});

/**
 * GET /api/subscriptions/invoices/:id
 */
export const getInvoice = asyncHandler(async (req, res) => {
  const subscription = await ensureSubscription(req.user._id);
  const inv = (subscription.invoices || []).find(
    (i) => String(i.stripeInvoiceId) === String(req.params.id) || String(i._id) === String(req.params.id)
  );
  if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
  res.json({ success: true, data: { invoice: inv } });
});

/**
 * POST /api/subscriptions/webhooks/stripe
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) return res.status(503).json({ success: false, message: 'Stripe disabled' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature error:', err.message);
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const stripeSub = event.data.object;
      const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
      if (sub) {
        sub.activate(stripeSub.id, sub.plan || 'PRO', stripeSub.current_period_start, stripeSub.current_period_end);
        await sub.save();
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const sub = await Subscription.findOne({ stripeCustomerId: invoice.customer });
      if (sub) {
        sub.addInvoice(invoice);
        await sub.save();
      }
      break;
    }
    case 'invoice.payment_failed':
      logger.warn(`Payment failed for customer ${event.data.object.customer}`);
      break;
    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object;
      const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        await sub.save();
      }
      break;
    }
  }

  res.json({ received: true });
});

/* --------------------------- Razorpay ------------------------------ */

/**
 * POST /api/subscriptions/razorpay/order
 *
 * Creates a Razorpay order for the chosen plan. The frontend should
 * then open the Razorpay Checkout widget with the returned orderId +
 * keyId and, on success, POST the resulting payment_id/signature to
 * /razorpay/verify to activate the subscription.
 */
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { plan, amount, currency } = req.body || {};
  const planMeta = PLAN_BY_ID[plan];
  if (!planMeta || planMeta.code === 'FREE') {
    return res.status(400).json({ success: false, message: 'Invalid plan' });
  }
  const inr = planMeta.priceINR || Math.round(planMeta.price * 83);
  const finalAmount = Number(amount) || inr;
  try {
    const order = await razorpayService.createOrder({
      amount: finalAmount,
      currency: currency || 'INR',
      receipt: `sub_${req.user._id}_${Date.now()}`.slice(0, 40),
      notes: {
        userId: String(req.user._id),
        plan: planMeta.code,
        email: req.user.email || '',
      },
    });
    res.json({ success: true, data: { order, plan: planMeta } });
  } catch (err) {
    logger.error(`Razorpay order creation failed: ${err.message}`);
    res.status(500).json({ success: false, message: 'Unable to create payment order', error: err.message });
  }
});

/**
 * POST /api/subscriptions/razorpay/verify
 *
 * Verifies the payment signature and activates the plan on success.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan }
 */
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
  } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing Razorpay verification fields' });
  }
  const ok = razorpayService.verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!ok) {
    logger.warn(`Invalid Razorpay signature for payment ${razorpay_payment_id}`);
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  }

  const planMeta = PLAN_BY_ID[plan];
  if (!planMeta) {
    return res.status(400).json({ success: false, message: 'Unknown plan' });
  }

  // Optional: fetch payment record to attach real payment metadata.
  let paymentMeta = null;
  try {
    paymentMeta = await razorpayService.fetchPayment(razorpay_payment_id);
  } catch (err) {
    logger.warn(`Could not fetch Razorpay payment ${razorpay_payment_id}: ${err.message}`);
  }

  const sub = await ensureSubscription(req.user._id);
  sub.upgradePlan(planMeta.code, planMeta.limits);
  sub.status = 'active';
  sub.currentPeriodStart = new Date();
  sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  sub.cancelAtPeriodEnd = false;
  sub.cancelledAt = null;
  sub.paymentMethod = {
    id: razorpay_payment_id,
    brand: paymentMeta?.method || 'razorpay',
    last4: paymentMeta?.card?.last4 || '****',
    expMonth: undefined,
    expYear: undefined,
  };
  sub.invoices.push({
    stripeInvoiceId: razorpay_payment_id,
    amount: (paymentMeta?.amount || planMeta.priceINR * 100) / 100,
    currency: (paymentMeta?.currency || 'INR').toLowerCase(),
    status: 'paid',
    invoiceDate: new Date(),
    description: `${planMeta.name} plan – Razorpay payment`,
  });
  await sub.save();
  await User.findByIdAndUpdate(req.user._id, { subscriptionTier: planMeta.code });

  res.json({
    success: true,
    message: `Payment verified. Upgraded to ${planMeta.name}.`,
    data: {
      subscription: decorateSubscription(sub),
      paymentId: razorpay_payment_id,
    },
  });
});

/**
 * POST /api/subscriptions/razorpay/webhook
 *
 * Razorpay webhook receiver. Uses raw body middleware for HMAC check.
 * Configured events: payment.captured, payment.failed, refund.created.
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;
  const ok = razorpayService.verifyWebhookSignature(rawBody, signature);
  if (!ok) {
    logger.warn('Rejected Razorpay webhook: invalid signature');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Malformed payload' });
  }

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload?.payment?.entity;
      const userId = payment?.notes?.userId;
      const plan = payment?.notes?.plan;
      if (userId && plan) {
        try {
          const sub = await ensureSubscription(userId);
          sub.invoices.push({
            stripeInvoiceId: payment.id,
            amount: payment.amount / 100,
            currency: (payment.currency || 'INR').toLowerCase(),
            status: 'paid',
            invoiceDate: new Date(payment.created_at * 1000),
            description: `${plan} plan – Razorpay webhook`,
          });
          await sub.save();
          logger.info(`Razorpay payment.captured recorded for user ${userId}`);
        } catch (err) {
          logger.error(`Webhook processing error: ${err.message}`);
        }
      }
      break;
    }
    case 'payment.failed':
      logger.warn(`Razorpay payment failed: ${event.payload?.payment?.entity?.id}`);
      break;
    case 'refund.created':
      logger.info(`Razorpay refund issued: ${event.payload?.refund?.entity?.id}`);
      break;
    default:
      logger.info(`Unhandled Razorpay event: ${event.event}`);
  }
  res.json({ received: true });
});

/**
 * GET /api/subscriptions/razorpay/key
 *
 * Returns the public Razorpay Key ID so the frontend checkout widget
 * can initialise without hard-coding it.
 */
export const getRazorpayKey = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { keyId: razorpayService.getPublicKey() } });
});
