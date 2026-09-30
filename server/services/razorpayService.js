/**
 * Razorpay integration service.
 *
 * Creates orders, verifies checkout signatures, and handles webhook
 * events. Keys come from env vars RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
 * but will fall back to hard-coded test credentials when unset so local
 * development works without an .env file.
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

// Fallback test credentials supplied by the product team.
const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_SfQrr3XqTwUvJH';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'fXpwFsbFOLtgCNct02e76zQ5';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || KEY_SECRET;

let client = null;
async function getClient() {
  if (client) return client;
  try {
    const { default: Razorpay } = await import('razorpay');
    client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
    return client;
  } catch (err) {
    logger.error(`Razorpay SDK init failed: ${err.message}`);
    throw err;
  }
}

/**
 * Create a one-time order for a subscription plan. Razorpay's
 * "subscription" API requires pre-created Plan IDs in their dashboard;
 * for maximum flexibility we use single-payment orders and manage the
 * recurrence ourselves.
 */
export async function createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const rz = await getClient();
  const amountInPaise = Math.round(Number(amount) * 100);
  if (!amountInPaise || amountInPaise < 100) {
    throw new Error('Amount must be at least ₹1');
  }
  const order = await rz.orders.create({
    amount: amountInPaise,
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
    payment_capture: 1,
  });
  return {
    id: order.id,
    amount: order.amount,
    amountFormatted: order.amount / 100,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
    keyId: KEY_ID,
    notes,
    createdAt: new Date(order.created_at * 1000),
  };
}

/**
 * Verify the signature Razorpay returns after a successful checkout:
 *   HMAC-SHA256(order_id + "|" + payment_id, keySecret) === signature
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    // timingSafeEqual requires equal-length buffers.
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}

/**
 * Verify the signature from a Razorpay webhook request.
 * `body` must be the raw request body (Buffer or string).
 */
export function verifyWebhookSignature(body, signature) {
  if (!signature) return false;
  const raw = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}

/** Fetch a payment by id (for server-side reconciliation). */
export async function fetchPayment(paymentId) {
  const rz = await getClient();
  return rz.payments.fetch(paymentId);
}

export function getPublicKey() {
  return KEY_ID;
}

export default {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  getPublicKey,
  KEY_ID,
};
