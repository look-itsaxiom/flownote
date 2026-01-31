import type { AppConfig } from '../types/index.js';

/**
 * Application configuration loaded from environment variables.
 * Never store secrets directly in code - always use environment variables.
 */
export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'flownote-dev',
    // Set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 for local development
    // When set, Firebase Admin SDK automatically uses the emulator
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined,
  },
  stripe: {
    // REQUIRED: Stripe secret key - starts with sk_test_ or sk_live_
    // Never commit or expose this key
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    // REQUIRED: Webhook endpoint secret for signature verification
    // Get this from Stripe Dashboard > Webhooks
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // REQUIRED: The price ID for the $0.99/mo Pro subscription
    // Create this in Stripe Dashboard > Products
    priceId: process.env.STRIPE_PRICE_ID || '',
  },
};
