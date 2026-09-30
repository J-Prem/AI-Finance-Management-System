import express from 'express';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import stripe from '../config/stripe.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route POST /api/webhooks/stripe
 * @desc Handle Stripe webhook events
 * @access Public
 */
router.post('/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(400).json({ received: false });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    logger.error('Webhook signature verification error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          const subscription = await Subscription.findOne({ userId });
          if (subscription) {
            subscription.activate(
              session.subscription,
              session.metadata?.plan || 'PRO',
              new Date(session.current_period_start * 1000),
              new Date(session.current_period_end * 1000)
            );
            subscription.stripeCustomerId = session.customer;
            await subscription.save();

            // Update user tier
            await User.findByIdAndUpdate(userId, {
              subscriptionTier: session.metadata?.plan || 'PRO',
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSubscription = event.data.object;
        const subscription = await Subscription.findOne({
          stripeSubscriptionId: stripeSubscription.id,
        });

        if (subscription) {
          subscription.status = stripeSubscription.status === 'active' ? 'active' : 'inactive';
          subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
          subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
          await subscription.save();
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscription = await Subscription.findOne({
          stripeCustomerId: invoice.customer,
        });

        if (subscription) {
          subscription.addInvoice(invoice);
          await subscription.save();

          logger.info(`Invoice paid: ${invoice.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscription = await Subscription.findOne({
          stripeCustomerId: invoice.customer,
        });

        if (subscription) {
          subscription.status = 'past_due';
          await subscription.save();

          logger.warn(`Payment failed for subscription: ${subscription._id}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object;
        const subscription = await Subscription.findOne({
          stripeSubscriptionId: stripeSubscription.id,
        });

        if (subscription) {
          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
          await subscription.save();

          // Downgrade user to FREE
          await User.findByIdAndUpdate(subscription.userId, {
            subscriptionTier: 'FREE',
          });

          logger.info(`Subscription cancelled: ${subscription._id}`);
        }
        break;
      }

      case 'charge.failed': {
        logger.warn(`Charge failed: ${event.data.object.id}`);
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
