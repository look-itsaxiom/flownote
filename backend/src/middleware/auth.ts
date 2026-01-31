/**
 * Authentication Middleware
 *
 * Verifies Firebase ID tokens and protects API routes.
 *
 * Security considerations:
 * - Tokens verified server-side (never trust client)
 * - No token data logged (PII protection)
 * - Rate limiting prevents brute force attacks
 * - HTTPS enforced by Cloud Run in production
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyIdToken } from '../services/firebase.js';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Extended Request interface with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

/**
 * Auth middleware to verify Firebase ID tokens
 *
 * Extracts Bearer token from Authorization header and verifies it.
 * On success, adds decoded user to request object.
 * On failure, returns 401 Unauthorized.
 *
 * Usage:
 *   app.get('/protected', authMiddleware, (req, res) => {
 *     const user = (req as AuthenticatedRequest).user;
 *     // ...
 *   });
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    // Check for Authorization header
    if (!authHeader) {
      res.status(401).json({
        error: 'Missing authorization token',
      });
      return;
    }

    // Check for Bearer prefix
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Invalid authorization format. Expected: Bearer <token>',
      });
      return;
    }

    // Extract token
    const token = authHeader.substring(7).trim();

    // Check for empty token
    if (!token) {
      res.status(401).json({
        error: 'Missing authorization token',
      });
      return;
    }

    // Verify token with Firebase
    const decodedToken = await verifyIdToken(token);

    // Add user to request object
    (req as AuthenticatedRequest).user = decodedToken;

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    // Handle specific Firebase Auth errors
    // Important: Don't expose internal error details (security)
    const firebaseError = error as { code?: string };

    if (firebaseError.code === 'auth/id-token-expired') {
      res.status(401).json({
        error: 'Token expired. Please sign in again.',
      });
      return;
    }

    if (firebaseError.code === 'auth/id-token-revoked') {
      res.status(401).json({
        error: 'Token revoked. Please sign in again.',
      });
      return;
    }

    // Generic unauthorized response for all other errors
    // Don't expose internal error details (security)
    res.status(401).json({
      error: 'Invalid or unauthorized token',
    });
  }
}

/**
 * Rate limiter for auth endpoints
 *
 * Protects against brute force attacks by limiting:
 * - 10 requests per 15 minutes per IP for auth endpoints
 *
 * This is stricter than the general API rate limit
 * because auth endpoints are common attack targets.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
  },
  // Skip successful requests from the count
  // This way, legitimate users aren't penalized for successful logins
  skipSuccessfulRequests: false,
});

/**
 * Optional auth middleware
 *
 * Similar to authMiddleware but doesn't reject requests without tokens.
 * Useful for routes that work with or without authentication,
 * providing enhanced features for authenticated users.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, but that's okay for optional auth
      next();
      return;
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      next();
      return;
    }

    // Try to verify token
    const decodedToken = await verifyIdToken(token);
    (req as AuthenticatedRequest).user = decodedToken;

    next();
  } catch {
    // Token invalid, but continue anyway for optional auth
    // User just won't have authenticated access
    next();
  }
}
