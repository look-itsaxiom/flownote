/**
 * Billing API Routes
 *
 * Handles Stripe payment integration for Pro subscriptions.
 *
 * Endpoints:
 * - POST /api/billing/checkout - Create checkout session
 * - POST /api/billing/portal - Create customer portal session
 * - POST /api/billing/webhook - Handle Stripe webhook events
 *
 * Security:
 * - Stripe webhook signature verified
 * - Price ID hardcoded server-side (not from client)
 * - Stripe secret key in environment only
 * - No payment data stored locally
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  isHandledEventType,
  extractUserIdFromCheckoutSession,
} from '../services/stripe.js';
import {
  getUserProfile,
  upgradeUserToPro,
  downgradeUserToFree,
  findUserByStripeCustomerId,
} from '../services/firestore.js';

const router = Router();

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the Pro subscription.
 * Requires authentication.
 *
 * Response: { sessionId: string, url: string }
 */
router.post(
  '/api/billing/checkout',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get user's email from Firebase token or profile
      const userEmail = user.email || '';

      // Construct success and cancel URLs
      const baseUrl = config.corsOrigin;
      const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/billing/cancel`;

      // Create checkout session with hardcoded price (not from client)
      const session = await createCheckoutSession(
        user.uid,
        userEmail,
        successUrl,
        cancelUrl
      );

      res.json({
        sessionId: session.sessionId,
        url: session.url,
      });
    } catch (error) {
      console.error('Checkout session creation failed:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }
);

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing subscription.
 * Requires authentication and existing Stripe customer.
 *
 * Response: { url: string }
 */
router.post(
  '/api/billing/portal',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get user profile to retrieve Stripe customer ID
      const profile = await getUserProfile(user.uid);

      if (!profile.stripeCustomerId) {
        res.status(400).json({
          error: 'No subscription found. Please subscribe first.',
        });
        return;
      }

      // Construct return URL
      const returnUrl = `${config.corsOrigin}/settings`;

      // Create portal session
      const session = await createPortalSession(
        profile.stripeCustomerId,
        returnUrl
      );

      res.json({
        url: session.url,
      });
    } catch (error) {
      console.error('Portal session creation failed:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }
);

/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events.
 * Must receive raw body for signature verification.
 *
 * Events handled:
 * - checkout.session.completed: User completed checkout -> upgrade to Pro
 * - customer.subscription.deleted: Subscription cancelled -> downgrade to Free
 * - invoice.payment_failed: Payment failed (logged for monitoring)
 */
router.post(
  '/api/billing/webhook',
  // Raw body middleware is applied at app level (before JSON parsing)
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = constructWebhookEvent(req.body, signature as string);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    // Handle the event
    try {
      if (isHandledEventType(event.type)) {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
            break;
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentFailed(invoice);
            break;
          }
        }
      }

      // Return 200 to acknowledge receipt
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      // Still return 200 to prevent Stripe from retrying
      // The error is logged for investigation
      res.json({ received: true, error: 'Handler error logged' });
    }
  }
);

/**
 * Handle checkout.session.completed event
 * Updates user tier to Pro
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = extractUserIdFromCheckoutSession(session);

  if (!userId) {
    console.error('No userId in checkout session metadata:', session.id);
    return;
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!customerId || !subscriptionId) {
    console.error('Missing customer or subscription in session:', session.id);
    return;
  }

  // Upgrade user to Pro
  await upgradeUserToPro(userId, customerId, subscriptionId);
  console.log(`User ${userId} upgraded to Pro`);
}

/**
 * Handle customer.subscription.deleted event
 * Downgrades user to Free tier
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Find user by Stripe customer ID
  const userId = await findUserByStripeCustomerId(customerId);

  if (!userId) {
    console.error('No user found for Stripe customer:', customerId);
    return;
  }

  // Downgrade user to Free
  await downgradeUserToFree(userId);
  console.log(`User ${userId} downgraded to Free`);
}

/**
 * Handle customer.subscription.updated event
 * Check if subscription status changed and update accordingly
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Find user by Stripe customer ID
  const userId = await findUserByStripeCustomerId(customerId);

  if (!userId) {
    console.error('No user found for Stripe customer:', customerId);
    return;
  }

  // If subscription is cancelled or unpaid, downgrade to free
  if (
    subscription.status === 'canceled' ||
    subscription.status === 'unpaid'
  ) {
    await downgradeUserToFree(userId);
    console.log(`User ${userId} downgraded to Free due to ${subscription.status}`);
  }
}

/**
 * Handle invoice.payment_failed event
 * Log the failure for monitoring - Stripe will retry automatically
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  console.warn(`Payment failed for customer ${customerId}, invoice ${invoice.id}`);
  // Stripe will automatically retry - we just log for monitoring
  // User will be downgraded when subscription is eventually deleted
}

export default router;
