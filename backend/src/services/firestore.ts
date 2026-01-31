/**
 * Firestore Service
 *
 * Handles all Firestore operations for notes and user profiles.
 * Data structure:
 *   users/{userId}                - User profile document
 *   users/{userId}/notes/{noteId} - Note documents
 */

import { getFirestore, Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from './firebase.js';
import type { Note, NoteInput, NoteUpdateInput, UserProfile, UserTier, SyncResponse, NOTE_LIMITS } from '../types/index.js';

let db: Firestore | null = null;

/**
 * Get Firestore instance (lazy initialization)
 */
function getDb(): Firestore {
  if (!db) {
    initializeFirebase();
    db = getFirestore();
  }
  return db;
}

/**
 * Get user profile from Firestore
 * Creates a default free tier profile if not exists
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const firestore = getDb();
  const userDoc = await firestore.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    // Create default profile for new users
    const defaultProfile: UserProfile = {
      tier: 'free',
      noteCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await firestore.collection('users').doc(userId).set(defaultProfile);
    return defaultProfile;
  }

  return userDoc.data() as UserProfile;
}

/**
 * List all notes for a user
 */
export async function listNotes(userId: string): Promise<Note[]> {
  const firestore = getDb();
  const notesSnapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection('notes')
    .orderBy('order', 'asc')
    .get();

  return notesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
  })) as Note[];
}

/**
 * Get a single note by ID
 * Returns null if note doesn't exist
 */
export async function getNote(userId: string, noteId: string): Promise<Note | null> {
  const firestore = getDb();
  const noteDoc = await firestore
    .collection('users')
    .doc(userId)
    .collection('notes')
    .doc(noteId)
    .get();

  if (!noteDoc.exists) {
    return null;
  }

  const data = noteDoc.data()!;
  return {
    id: noteDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
  } as Note;
}

/**
 * Create a new note
 * Enforces free tier limit of 5 notes
 * @throws Error with code 'LIMIT_EXCEEDED' if free tier limit reached
 */
export async function createNote(
  userId: string,
  input: NoteInput
): Promise<Note> {
  const firestore = getDb();

  return await firestore.runTransaction(async (transaction) => {
    // Get user profile to check tier and note count
    const userRef = firestore.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    let profile: UserProfile;
    if (!userDoc.exists) {
      profile = { tier: 'free', noteCount: 0 };
    } else {
      profile = userDoc.data() as UserProfile;
    }

    // Check free tier limit
    if (profile.tier === 'free' && profile.noteCount >= 5) {
      const error = new Error('Free tier note limit reached. Upgrade to Pro for unlimited notes.');
      (error as any).code = 'LIMIT_EXCEEDED';
      throw error;
    }

    // Create the note
    const noteRef = firestore
      .collection('users')
      .doc(userId)
      .collection('notes')
      .doc();

    const now = Timestamp.now();
    const noteData = {
      name: input.name,
      content: input.content || '',
      order: input.order ?? profile.noteCount,
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(noteRef, noteData);

    // Update user's note count
    transaction.set(
      userRef,
      {
        noteCount: FieldValue.increment(1),
        updatedAt: now,
        tier: profile.tier || 'free',
      },
      { merge: true }
    );

    return {
      id: noteRef.id,
      ...noteData,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };
  });
}

/**
 * Update an existing note
 * @throws Error if note doesn't exist
 */
export async function updateNote(
  userId: string,
  noteId: string,
  input: NoteUpdateInput
): Promise<Note> {
  const firestore = getDb();

  const noteRef = firestore
    .collection('users')
    .doc(userId)
    .collection('notes')
    .doc(noteId);

  const noteDoc = await noteRef.get();
  if (!noteDoc.exists) {
    const error = new Error('Note not found');
    (error as any).code = 'NOT_FOUND';
    throw error;
  }

  const now = Timestamp.now();
  const updateData: Record<string, any> = {
    updatedAt: now,
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.content !== undefined) {
    updateData.content = input.content;
  }
  if (input.order !== undefined) {
    updateData.order = input.order;
  }

  await noteRef.update(updateData);

  const updatedDoc = await noteRef.get();
  const data = updatedDoc.data()!;

  return {
    id: noteId,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
  } as Note;
}

/**
 * Delete a note
 * @returns true if deleted successfully
 */
export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const firestore = getDb();

  return await firestore.runTransaction(async (transaction) => {
    const noteRef = firestore
      .collection('users')
      .doc(userId)
      .collection('notes')
      .doc(noteId);

    const noteDoc = await transaction.get(noteRef);
    if (!noteDoc.exists) {
      return false;
    }

    // Delete the note
    transaction.delete(noteRef);

    // Decrement user's note count
    const userRef = firestore.collection('users').doc(userId);
    transaction.update(userRef, {
      noteCount: FieldValue.increment(-1),
      updatedAt: Timestamp.now(),
    });

    return true;
  });
}

/**
 * Bulk sync notes
 * Creates, updates, and deletes notes in a single transaction
 * @throws Error with code 'LIMIT_EXCEEDED' if operation would exceed free tier limit
 */
export async function bulkSyncNotes(
  userId: string,
  notes: Array<{ id?: string; name: string; content: string; order: number }>,
  deletedIds: string[]
): Promise<SyncResponse> {
  const firestore = getDb();

  return await firestore.runTransaction(async (transaction) => {
    // Get user profile
    const userRef = firestore.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    let profile: UserProfile;
    if (!userDoc.exists) {
      profile = { tier: 'free', noteCount: 0 };
    } else {
      profile = userDoc.data() as UserProfile;
    }

    const notesRef = firestore.collection('users').doc(userId).collection('notes');

    // Determine which notes are new vs updates
    const existingNoteIds = new Set<string>();
    const notesToCheck = notes.filter((n) => n.id);

    for (const note of notesToCheck) {
      if (note.id) {
        const noteDoc = await transaction.get(notesRef.doc(note.id));
        if (noteDoc.exists) {
          existingNoteIds.add(note.id);
        }
      }
    }

    const notesToCreate = notes.filter((n) => !n.id || !existingNoteIds.has(n.id));
    const notesToUpdate = notes.filter((n) => n.id && existingNoteIds.has(n.id));

    // Calculate new note count
    const newNoteCount =
      profile.noteCount + notesToCreate.length - deletedIds.length;

    // Check free tier limit
    if (profile.tier === 'free' && newNoteCount > 5) {
      const error = new Error('Free tier note limit reached. Upgrade to Pro for unlimited notes.');
      (error as any).code = 'LIMIT_EXCEEDED';
      throw error;
    }

    const now = Timestamp.now();
    const created: Note[] = [];
    const updated: Note[] = [];

    // Create new notes
    for (const note of notesToCreate) {
      const noteRef = note.id ? notesRef.doc(note.id) : notesRef.doc();
      const noteData = {
        name: note.name,
        content: note.content,
        order: note.order,
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(noteRef, noteData);
      created.push({
        id: noteRef.id,
        ...noteData,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      });
    }

    // Update existing notes
    for (const note of notesToUpdate) {
      const noteRef = notesRef.doc(note.id!);
      const updateData = {
        name: note.name,
        content: note.content,
        order: note.order,
        updatedAt: now,
      };
      transaction.update(noteRef, updateData);
      updated.push({
        id: note.id!,
        ...updateData,
        createdAt: '', // Will be populated from existing doc
        updatedAt: now.toDate().toISOString(),
      });
    }

    // Delete notes
    for (const noteId of deletedIds) {
      const noteRef = notesRef.doc(noteId);
      transaction.delete(noteRef);
    }

    // Update user's note count
    transaction.set(
      userRef,
      {
        noteCount: newNoteCount,
        updatedAt: now,
        tier: profile.tier || 'free',
      },
      { merge: true }
    );

    return {
      created,
      updated,
      deleted: deletedIds,
    };
  });
}

/**
 * Update user's tier to Pro after successful Stripe checkout
 * Also stores the Stripe customer and subscription IDs
 */
export async function upgradeUserToPro(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  const firestore = getDb();
  const userRef = firestore.collection('users').doc(userId);

  await userRef.update({
    tier: 'pro' as UserTier,
    stripeCustomerId,
    stripeSubscriptionId,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Downgrade user's tier to Free after subscription cancellation
 * Clears the subscription ID but keeps customer ID for future resubscription
 */
export async function downgradeUserToFree(userId: string): Promise<void> {
  const firestore = getDb();
  const userRef = firestore.collection('users').doc(userId);

  await userRef.update({
    tier: 'free' as UserTier,
    stripeSubscriptionId: null,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Find user by Stripe customer ID
 * Used for webhook processing when we need to find user by customer ID
 * @returns User ID if found, null otherwise
 */
export async function findUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<string | null> {
  const firestore = getDb();
  const usersSnapshot = await firestore
    .collection('users')
    .where('stripeCustomerId', '==', stripeCustomerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return null;
  }

  return usersSnapshot.docs[0].id;
}

/**
 * Update user's Stripe customer ID
 * Used when creating a new customer during checkout
 */
export async function setUserStripeCustomerId(
  userId: string,
  stripeCustomerId: string
): Promise<void> {
  const firestore = getDb();
  const userRef = firestore.collection('users').doc(userId);

  await userRef.set(
    {
      stripeCustomerId,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}
