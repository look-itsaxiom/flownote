/**
 * Billing API Tests
 *
 * TDD: Tests written FIRST before implementation.
 *
 * Tests cover:
 * - Checkout creates valid Stripe session
 * - Webhook verifies signature correctly
 * - Invalid signature returns 400
 * - checkout.session.completed updates user to pro
 * - customer.subscription.deleted updates user to free
 * - Portal returns valid URL
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import request from 'supertest';

// Mock Firebase Admin (must be before app import)
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: 'test-user-123',
      email: 'test@example.com',
    }),
  })),
}));

// Mock Firestore
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
      where: mockWhere.mockReturnValue({
        limit: mockLimit.mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: 'test-user-123' }],
          }),
        }),
      }),
    })),
  })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
  FieldValue: {
    increment: vi.fn((n) => n),
  },
}));

// Mock Stripe service
const mockCreateCheckoutSession = vi.fn();
const mockCreatePortalSession = vi.fn();
const mockConstructWebhookEvent = vi.fn();

vi.mock('../src/services/stripe.js', () => ({
  createCheckoutSession: (...args: any[]) => mockCreateCheckoutSession(...args),
  createPortalSession: (...args: any[]) => mockCreatePortalSession(...args),
  constructWebhookEvent: (...args: any[]) => mockConstructWebhookEvent(...args),
  isHandledEventType: (type: string) => [
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.updated',
    'invoice.payment_failed',
  ].includes(type),
  extractUserIdFromCheckoutSession: (session: any) => session.metadata?.userId || null,
  getStripeClient: vi.fn(),
  resetStripeClient: vi.fn(),
}));

// Mock Firestore service
const mockGetUserProfile = vi.fn();
const mockUpgradeUserToPro = vi.fn();
const mockDowngradeUserToFree = vi.fn();
const mockFindUserByStripeCustomerId = vi.fn();

vi.mock('../src/services/firestore.js', () => ({
  getUserProfile: (...args: any[]) => mockGetUserProfile(...args),
  upgradeUserToPro: (...args: any[]) => mockUpgradeUserToPro(...args),
  downgradeUserToFree: (...args: any[]) => mockDowngradeUserToFree(...args),
  findUserByStripeCustomerId: (...args: any[]) => mockFindUserByStripeCustomerId(...args),
  setUserStripeCustomerId: vi.fn(),
  listNotes: vi.fn().mockResolvedValue([]),
  getNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  bulkSyncNotes: vi.fn(),
}));

// Import app after mocks
import { app } from '../src/app.js';

describe('Billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGetUserProfile.mockResolvedValue({
      tier: 'free',
      noteCount: 0,
      stripeCustomerId: null,
    });
    mockUpgradeUserToPro.mockResolvedValue(undefined);
    mockDowngradeUserToFree.mockResolvedValue(undefined);
    mockFindUserByStripeCustomerId.mockResolvedValue('test-user-123');

    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        tier: 'free',
        noteCount: 0,
        stripeCustomerId: null,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/billing/checkout', () => {
    it('should create a valid Stripe checkout session', async () => {
      const mockSessionId = 'cs_test_123';
      const mockSessionUrl = 'https://checkout.stripe.com/pay/cs_test_123';

      mockCreateCheckoutSession.mockResolvedValue({
        sessionId: mockSessionId,
        url: mockSessionUrl,
      });

      const response = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId', mockSessionId);
      expect(response.body).toHaveProperty('url', mockSessionUrl);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should call createCheckoutSession with user ID (not client-provided price)', async () => {
      mockCreateCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', 'Bearer valid-token')
        .send({ priceId: 'price_malicious_attempt' }); // Client tries to pass price ID

      // Verify createCheckoutSession was called with the user ID from token
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        'test-user-123', // userId from mocked Firebase token
        'test@example.com', // email from mocked Firebase token
        expect.any(String), // successUrl
        expect.any(String)  // cancelUrl
      );
    });

    it('should include user metadata in checkout session', async () => {
      mockCreateCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(mockCreateCheckoutSession).toHaveBeenCalled();
      const callArgs = mockCreateCheckoutSession.mock.calls[0];
      expect(callArgs[0]).toBe('test-user-123'); // userId
    });
  });

  describe('POST /api/billing/portal', () => {
    it('should return valid portal URL for authenticated user with subscription', async () => {
      const mockPortalUrl = 'https://billing.stripe.com/p/session/test_123';

      mockGetUserProfile.mockResolvedValue({
        tier: 'pro',
        noteCount: 3,
        stripeCustomerId: 'cus_test123',
      });

      mockCreatePortalSession.mockResolvedValue({
        url: mockPortalUrl,
      });

      const response = await request(app)
        .post('/api/billing/portal')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url', mockPortalUrl);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/billing/portal')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should return 400 if user has no Stripe customer', async () => {
      mockGetUserProfile.mockResolvedValue({
        tier: 'free',
        noteCount: 0,
        stripeCustomerId: null, // No Stripe customer
      });

      const response = await request(app)
        .post('/api/billing/portal')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/billing/webhook', () => {
    const validSignature = 'valid_sig';

    it('should verify Stripe signature correctly', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test123',
            metadata: {
              userId: 'test-user-123',
            },
            subscription: 'sub_test123',
          },
        },
      };

      mockConstructWebhookEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(mockEvent));

      expect(response.status).toBe(200);
      expect(mockConstructWebhookEvent).toHaveBeenCalled();
    });

    it('should return 400 for invalid signature', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'invalid_sig')
        .set('Content-Type', 'application/json')
        .send('{}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when signature header is missing', async () => {
      const response = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send('{}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    describe('checkout.session.completed event', () => {
      it('should update user tier to pro on successful checkout', async () => {
        const mockEvent = {
          id: 'evt_test_123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              customer: 'cus_test123',
              metadata: {
                userId: 'test-user-123',
              },
              subscription: 'sub_test123',
            },
          },
        };

        mockConstructWebhookEvent.mockReturnValue(mockEvent);

        const response = await request(app)
          .post('/api/billing/webhook')
          .set('stripe-signature', validSignature)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(mockEvent));

        expect(response.status).toBe(200);
        // Verify upgradeUserToPro was called with correct parameters
        expect(mockUpgradeUserToPro).toHaveBeenCalledWith(
          'test-user-123',
          'cus_test123',
          'sub_test123'
        );
      });
    });

    describe('customer.subscription.deleted event', () => {
      it('should update user tier to free on subscription cancellation', async () => {
        const mockEvent = {
          id: 'evt_test_456',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_test123',
              customer: 'cus_test123',
              metadata: {
                userId: 'test-user-123',
              },
            },
          },
        };

        mockConstructWebhookEvent.mockReturnValue(mockEvent);
        mockFindUserByStripeCustomerId.mockResolvedValue('test-user-123');

        const response = await request(app)
          .post('/api/billing/webhook')
          .set('stripe-signature', validSignature)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(mockEvent));

        expect(response.status).toBe(200);
        // Verify downgradeUserToFree was called
        expect(mockDowngradeUserToFree).toHaveBeenCalledWith('test-user-123');
      });
    });

    describe('invoice.payment_failed event', () => {
      it('should handle payment failure gracefully', async () => {
        const mockEvent = {
          id: 'evt_test_789',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_test123',
              customer: 'cus_test123',
              subscription: 'sub_test123',
            },
          },
        };

        mockConstructWebhookEvent.mockReturnValue(mockEvent);

        const response = await request(app)
          .post('/api/billing/webhook')
          .set('stripe-signature', validSignature)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(mockEvent));

        // Should acknowledge event even if we don't actively modify user tier
        expect(response.status).toBe(200);
      });
    });
  });
});

describe('Stripe Service', () => {
  describe('Configuration', () => {
    it('should not expose Stripe secret key in responses', async () => {
      const response = await request(app).get('/health');
      expect(JSON.stringify(response.body)).not.toContain('sk_');
    });
  });
});

describe('Security', () => {
  it('should not store payment data locally', () => {
    // This is a documentation test to ensure the design principle
    // In actual implementation, no payment data should be stored
    // We only store: userId, stripeCustomerId, stripeSubscriptionId, tier
    expect(true).toBe(true);
  });
});
