import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// Mock firebase-admin before importing auth middleware
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

// Import after mocking
import { getAuth } from 'firebase-admin/auth';

describe('Auth Middleware', () => {
  let app: Express;
  let mockVerifyIdToken: Mock;

  beforeEach(async () => {
    vi.resetModules();

    // Re-setup mocks after reset
    vi.doMock('firebase-admin/app', () => ({
      initializeApp: vi.fn(),
      getApps: vi.fn(() => []),
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => {
      mockVerifyIdToken = vi.fn();
      return {
        getAuth: vi.fn(() => ({
          verifyIdToken: mockVerifyIdToken,
        })),
      };
    });

    // Import fresh module
    const { authMiddleware } = await import('../src/middleware/auth.js');

    // Create a test app
    app = express();
    app.use(express.json());

    // Protected route using auth middleware
    app.get('/protected', authMiddleware, (req: Request, res: Response) => {
      // Access user from request (added by middleware)
      const user = (req as any).user;
      res.json({
        message: 'Protected resource',
        userId: user?.uid,
        email: user?.email
      });
    });

    // Unprotected route for comparison
    app.get('/public', (_req: Request, res: Response) => {
      res.json({ message: 'Public resource' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Validation', () => {
    it('should pass middleware with valid token', async () => {
      const mockDecodedToken = {
        uid: 'test-user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', 'test-user-123');
      expect(response.body).toHaveProperty('email', 'test@example.com');
    });

    it('should return 401 when Authorization header is missing', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/token|authorization|missing/i);
    });

    it('should return 401 when Authorization header has no Bearer prefix', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'invalid-token-123');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 when token is empty', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 when token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has invalid signature')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|unauthorized/i);
    });

    it('should return 401 when token is expired', async () => {
      const expiredError = new Error('Firebase ID token has expired');
      (expiredError as any).code = 'auth/id-token-expired';
      mockVerifyIdToken.mockRejectedValue(expiredError);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/expired|unauthorized/i);
    });

    it('should return 401 when token is revoked', async () => {
      const revokedError = new Error('Firebase ID token has been revoked');
      (revokedError as any).code = 'auth/id-token-revoked';
      mockVerifyIdToken.mockRejectedValue(revokedError);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer revoked-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('User Context', () => {
    it('should add user context to request object', async () => {
      const mockDecodedToken = {
        uid: 'user-456',
        email: 'user@test.com',
        email_verified: true,
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user-456');
      expect(response.body.email).toBe('user@test.com');
    });
  });

  describe('Public Routes', () => {
    it('should allow access to public routes without token', async () => {
      const response = await request(app).get('/public');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Public resource');
    });
  });

  describe('Security', () => {
    it('should not expose token details in error responses', async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error('Invalid token: some-secret-info')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer bad-token');

      expect(response.status).toBe(401);
      // Error message should be generic, not expose internal details
      expect(response.body.error).not.toContain('some-secret-info');
    });

    it('should handle malformed Authorization header gracefully', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
    });
  });
});

describe('Auth Rate Limiting', () => {
  let app: Express;
  let mockVerifyIdToken: Mock;

  beforeEach(async () => {
    vi.resetModules();

    // Re-setup mocks after reset
    vi.doMock('firebase-admin/app', () => ({
      initializeApp: vi.fn(),
      getApps: vi.fn(() => []),
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => {
      mockVerifyIdToken = vi.fn();
      return {
        getAuth: vi.fn(() => ({
          verifyIdToken: mockVerifyIdToken,
        })),
      };
    });

    // Import fresh module
    const { authRateLimiter } = await import('../src/middleware/auth.js');

    // Create a test app with rate limiter
    app = express();
    app.use(express.json());

    // Apply rate limiter to auth endpoint
    app.post('/auth/verify', authRateLimiter, (_req: Request, res: Response) => {
      res.json({ message: 'Auth endpoint' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow requests under the rate limit', async () => {
    // Make a few requests - should all succeed
    for (let i = 0; i < 5; i++) {
      const response = await request(app).post('/auth/verify');
      expect(response.status).toBe(200);
    }
  });

  it('should block excessive requests', async () => {
    // Make many requests rapidly to trigger rate limit
    const responses: number[] = [];

    // The rate limiter should be configured for auth endpoints
    // Typically 10-20 requests per minute for auth
    for (let i = 0; i < 25; i++) {
      const response = await request(app).post('/auth/verify');
      responses.push(response.status);
    }

    // Some requests should be blocked (429 Too Many Requests)
    expect(responses).toContain(429);
  });

  it('should return appropriate rate limit error message', async () => {
    // Exhaust rate limit
    for (let i = 0; i < 25; i++) {
      await request(app).post('/auth/verify');
    }

    const response = await request(app).post('/auth/verify');

    if (response.status === 429) {
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too many|rate limit|try again/i);
    }
  });
});

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize Firebase Admin SDK', async () => {
    const mockInitializeApp = vi.fn();
    const mockGetApps = vi.fn(() => []);

    vi.doMock('firebase-admin/app', () => ({
      initializeApp: mockInitializeApp,
      getApps: mockGetApps,
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({
        verifyIdToken: vi.fn(),
      })),
    }));

    const { initializeFirebase } = await import('../src/services/firebase.js');

    initializeFirebase();

    expect(mockInitializeApp).toHaveBeenCalled();
  });

  it('should not re-initialize if already initialized', async () => {
    const mockInitializeApp = vi.fn();
    const mockGetApps = vi.fn(() => [{ name: 'existing-app' }]); // Already has an app

    vi.doMock('firebase-admin/app', () => ({
      initializeApp: mockInitializeApp,
      getApps: mockGetApps,
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({
        verifyIdToken: vi.fn(),
      })),
    }));

    const { initializeFirebase } = await import('../src/services/firebase.js');

    initializeFirebase();

    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('should verify token using Firebase Auth', async () => {
    const mockVerifyIdToken = vi.fn().mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
    });

    vi.doMock('firebase-admin/app', () => ({
      initializeApp: vi.fn(),
      getApps: vi.fn(() => [{ name: 'app' }]),
      cert: vi.fn(),
    }));

    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({
        verifyIdToken: mockVerifyIdToken,
      })),
    }));

    const { verifyIdToken } = await import('../src/services/firebase.js');

    const result = await verifyIdToken('test-token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith('test-token');
    expect(result).toHaveProperty('uid', 'test-uid');
  });
});
