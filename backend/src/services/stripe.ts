/**
 * Stripe Service
 *
 * Handles all Stripe-related operations for FlowNote Pro subscriptions.
 *
 * Security considerations:
 * - Stripe secret key stored only in environment variables
 * - Webhook signatures verified to prevent spoofing
 * - Price ID hardcoded server-side (never from client)
 * - No payment data stored locally (PCI compliance)
 */

import Stripe from 'stripe';
import { config } from '../config/index.js';

// Initialize Stripe client with API key
// Only initialized when needed to allow for testing/mocking
let stripeClient: Stripe | null = null;

/**
 * Get or create the Stripe client instance
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

/**
 * Reset the Stripe client (for testing purposes)
 */
export function resetStripeClient(): void {
  stripeClient = null;
}

/**
 * Create a Stripe Checkout session for Pro subscription
 *
 * @param userId - The Firebase user ID
 * @param userEmail - The user's email address
 * @param successUrl - URL to redirect on successful payment
 * @param cancelUrl - URL to redirect on cancelled payment
 * @returns The checkout session with ID and URL
 *
 * Security: Price ID is hardcoded server-side - never accept from client
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();

  if (!config.stripe.priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        // SECURITY: Price ID is hardcoded, never from client
        price: config.stripe.priceId,
        quantity: 1,
      },
    ],
    // Store user ID in metadata for webhook processing
    metadata: {
      userId,
    },
    customer_email: userEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Allow promotion codes for marketing
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Create a Stripe Customer Portal session
 *
 * Allows users to manage their subscription, update payment methods,
 * view invoices, and cancel their subscription.
 *
 * @param stripeCustomerId - The Stripe customer ID
 * @param returnUrl - URL to redirect when user exits portal
 * @returns The portal session URL
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return {
    url: session.url,
  };
}

/**
 * Construct and verify a Stripe webhook event
 *
 * @param payload - The raw request body (must be raw, not parsed JSON)
 * @param signature - The stripe-signature header value
 * @returns The verified Stripe event
 * @throws Error if signature verification fails
 *
 * Security: Always verify webhook signatures to prevent event spoofing
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();

  if (!config.stripe.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  // This will throw if signature is invalid
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  );

  return event;
}

/**
 * Webhook event types we handle
 */
export type HandledEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.deleted'
  | 'customer.subscription.updated'
  | 'invoice.payment_failed';

/**
 * Check if we handle this event type
 */
export function isHandledEventType(type: string): type is HandledEventType {
  return [
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.updated',
    'invoice.payment_failed',
  ].includes(type);
}

/**
 * Extract user ID from checkout session completed event
 */
export function extractUserIdFromCheckoutSession(
  session: Stripe.Checkout.Session
): string | null {
  return session.metadata?.userId || null;
}

/**
 * Extract customer ID from subscription event
 */
export function extractCustomerIdFromSubscription(
  subscription: Stripe.Subscription
): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}
