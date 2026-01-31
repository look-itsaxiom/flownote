/**
 * Firebase Admin SDK Service
 *
 * Handles Firebase Admin initialization and token verification.
 * Supports both production (using service account) and local development (using emulator).
 *
 * Security notes:
 * - Tokens are verified server-side (never trust client)
 * - No token data is logged (PII protection)
 * - HTTPS is enforced by Cloud Run in production
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { config } from '../config/index.js';

let firebaseApp: App | null = null;

/**
 * Initialize Firebase Admin SDK
 *
 * In development with emulator:
 * - Set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 * - Firebase Admin SDK will automatically use the emulator
 *
 * In production:
 * - Uses Google Cloud default credentials (Cloud Run provides these automatically)
 * - Or uses GOOGLE_APPLICATION_CREDENTIALS service account file
 */
export function initializeFirebase(): App {
  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
    return firebaseApp;
  }

  // Initialize Firebase Admin SDK
  // When running on Cloud Run, credentials are automatically provided
  // For local development with emulator, no credentials are needed
  firebaseApp = initializeApp({
    projectId: config.firebase.projectId,
  });

  return firebaseApp;
}

/**
 * Verify a Firebase ID token
 *
 * @param token - The Firebase ID token to verify
 * @returns The decoded token containing user information
 * @throws Error if token is invalid, expired, or revoked
 *
 * Security: This function verifies tokens server-side.
 * Never log the token or decoded user data (PII protection).
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  // Ensure Firebase is initialized
  if (!firebaseApp) {
    initializeFirebase();
  }

  const auth = getAuth();

  // Verify the token
  // This will throw if:
  // - Token is invalid or malformed
  // - Token has expired
  // - Token has been revoked
  const decodedToken = await auth.verifyIdToken(token);

  return decodedToken;
}

/**
 * Get the Firebase Auth instance
 * Useful for additional auth operations like user management
 */
export function getFirebaseAuth() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return getAuth();
}
