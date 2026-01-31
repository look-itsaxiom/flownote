/**
 * FlowNote Backend Type Definitions
 */

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version?: string;
}

export interface FirebaseConfig {
  projectId: string;
  authEmulatorHost?: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  firebase: FirebaseConfig;
  stripe: StripeConfig;
}

// User types with subscription support
export type UserTier = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  tier: UserTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * User profile stored in Firestore at users/{userId}
 */
export interface UserProfile {
  tier: UserTier;
  noteCount: number;
  email?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Note stored in Firestore at users/{userId}/notes/{noteId}
 */
export interface Note {
  id: string;
  name: string;
  content: string;
  order: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Note input for create operations
 */
export interface NoteInput {
  name: string;
  content?: string;
  order?: number;
}

/**
 * Note update input (all fields optional)
 */
export interface NoteUpdateInput {
  name?: string;
  content?: string;
  order?: number;
}

/**
 * Bulk sync request payload
 */
export interface SyncRequest {
  notes: Array<{
    id?: string;
    name: string;
    content: string;
    order: number;
  }>;
  deletedIds: string[];
}

/**
 * Bulk sync response
 */
export interface SyncResponse {
  created: Note[];
  updated: Note[];
  deleted: string[];
}

/**
 * Constants for validation
 */
export const NOTE_LIMITS = {
  MAX_NAME_LENGTH: 255,
  MAX_CONTENT_LENGTH: 100000, // 100KB
  MAX_ID_LENGTH: 128,
  FREE_TIER_NOTE_LIMIT: 5,
} as const;
