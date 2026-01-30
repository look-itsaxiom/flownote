/**
 * Firestore Security Rules Tests
 *
 * Tests for verifying Firestore security rules work correctly.
 *
 * Prerequisites:
 *   - Firebase emulators must be running
 *   - Run: docker compose up firebase
 *
 * Run tests:
 *   cd tests/firebase && npm test
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

let testEnv;
const PROJECT_ID = 'flownote-test';

// Read the rules file
const rules = readFileSync('../../firestore.rules', 'utf8');

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('Emulator Connection', () => {
    it('should connect to the Firestore emulator successfully', async () => {
      // This test verifies we can connect and perform basic operations
      const adminContext = testEnv.authenticatedContext('admin-user');
      const adminDb = adminContext.firestore();

      // Should be able to write with admin context
      await assertSucceeds(
        setDoc(doc(adminDb, 'users', 'admin-user'), {
          email: 'admin@test.com',
          displayName: 'Admin User',
          tier: 'pro',
          noteCount: 0,
        })
      );
    });
  });

  describe('User Document Rules', () => {
    it('should allow authenticated user to read their own user document', async () => {
      const userId = 'user-123';

      // Set up data as admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          displayName: 'Test User',
          tier: 'free',
          noteCount: 0,
        });
      });

      // Test authenticated access
      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(getDoc(doc(authenticatedDb, 'users', userId)));
    });

    it('should deny authenticated user from reading another user document', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Set up data as admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', otherUserId), {
          email: 'other@test.com',
          displayName: 'Other User',
          tier: 'free',
          noteCount: 0,
        });
      });

      // Test that user-123 cannot read user-456's document
      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(getDoc(doc(authenticatedDb, 'users', otherUserId)));
    });

    it('should deny unauthenticated user from reading user document', async () => {
      const userId = 'user-123';

      // Set up data as admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          displayName: 'Test User',
          tier: 'free',
          noteCount: 0,
        });
      });

      // Test unauthenticated access
      const unauthenticatedContext = testEnv.unauthenticatedContext();
      const unauthenticatedDb = unauthenticatedContext.firestore();

      await assertFails(getDoc(doc(unauthenticatedDb, 'users', userId)));
    });

    it('should allow authenticated user to write their own user document', async () => {
      const userId = 'user-123';

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        setDoc(doc(authenticatedDb, 'users', userId), {
          email: 'user@test.com',
          displayName: 'Test User',
          tier: 'free',
          noteCount: 0,
        })
      );
    });

    it('should deny authenticated user from writing another user document', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(
        setDoc(doc(authenticatedDb, 'users', otherUserId), {
          email: 'hacked@test.com',
          displayName: 'Hacked User',
          tier: 'pro',
          noteCount: 0,
        })
      );
    });
  });

  describe('Notes Subcollection Rules', () => {
    it('should allow user to read their own notes', async () => {
      const userId = 'user-123';

      // Set up user and note as admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', userId, 'notes', 'note-1'), {
          name: 'Test Note',
          content: 'Hello world',
          order: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(getDoc(doc(authenticatedDb, 'users', userId, 'notes', 'note-1')));
    });

    it('should deny user from reading another user notes', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Set up other user's note
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', otherUserId), {
          email: 'other@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', otherUserId, 'notes', 'note-1'), {
          name: 'Private Note',
          content: 'Secret content',
          order: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(getDoc(doc(authenticatedDb, 'users', otherUserId, 'notes', 'note-1')));
    });

    it('should allow free tier user to create note when under limit', async () => {
      const userId = 'user-123';

      // Set up user with 3 notes (under 5 limit)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 3,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        setDoc(doc(authenticatedDb, 'users', userId, 'notes', 'note-new'), {
          name: 'New Note',
          content: 'New content',
          order: 3,
        })
      );
    });

    it('should deny free tier user from creating note when at limit', async () => {
      const userId = 'user-123';

      // Set up user with 5 notes (at limit)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 5,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(
        setDoc(doc(authenticatedDb, 'users', userId, 'notes', 'note-new'), {
          name: 'New Note',
          content: 'This should fail',
          order: 5,
        })
      );
    });

    it('should allow pro tier user to create unlimited notes', async () => {
      const userId = 'user-123';

      // Set up pro user with many notes
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'pro',
          noteCount: 100,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        setDoc(doc(authenticatedDb, 'users', userId, 'notes', 'note-101'), {
          name: 'Note 101',
          content: 'Pro users can have unlimited notes',
          order: 100,
        })
      );
    });

    it('should allow user to update their own notes', async () => {
      const userId = 'user-123';

      // Set up user and note
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', userId, 'notes', 'note-1'), {
          name: 'Original Name',
          content: 'Original content',
          order: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        setDoc(
          doc(authenticatedDb, 'users', userId, 'notes', 'note-1'),
          {
            name: 'Updated Name',
            content: 'Updated content',
            order: 0,
          },
          { merge: true }
        )
      );
    });

    it('should allow user to delete their own notes', async () => {
      const userId = 'user-123';

      // Set up user and note
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', userId, 'notes', 'note-1'), {
          name: 'To Delete',
          content: 'This will be deleted',
          order: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(deleteDoc(doc(authenticatedDb, 'users', userId, 'notes', 'note-1')));
    });

    it('should deny user from deleting another user notes', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Set up other user's note
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', otherUserId), {
          email: 'other@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', otherUserId, 'notes', 'note-1'), {
          name: 'Private Note',
          content: 'Should not be deleted by others',
          order: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(deleteDoc(doc(authenticatedDb, 'users', otherUserId, 'notes', 'note-1')));
    });
  });

  describe('Settings Subcollection Rules', () => {
    it('should allow user to read their own settings', async () => {
      const userId = 'user-123';

      // Set up user and settings
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 0,
        });
        await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
          theme: 'dark',
          globalVariables: {},
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        getDoc(doc(authenticatedDb, 'users', userId, 'settings', 'preferences'))
      );
    });

    it('should allow user to write their own settings', async () => {
      const userId = 'user-123';

      // Set up user
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertSucceeds(
        setDoc(doc(authenticatedDb, 'users', userId, 'settings', 'preferences'), {
          theme: 'light',
          globalVariables: { taxRate: 0.08 },
        })
      );
    });

    it('should deny user from reading another user settings', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Set up other user's settings
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', otherUserId), {
          email: 'other@test.com',
          tier: 'free',
          noteCount: 0,
        });
        await setDoc(doc(db, 'users', otherUserId, 'settings', 'preferences'), {
          theme: 'dark',
          globalVariables: { secretKey: 'secret' },
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(
        getDoc(doc(authenticatedDb, 'users', otherUserId, 'settings', 'preferences'))
      );
    });

    it('should deny user from writing another user settings', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Set up other user
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', otherUserId), {
          email: 'other@test.com',
          tier: 'free',
          noteCount: 0,
        });
      });

      const authenticatedContext = testEnv.authenticatedContext(userId);
      const authenticatedDb = authenticatedContext.firestore();

      await assertFails(
        setDoc(doc(authenticatedDb, 'users', otherUserId, 'settings', 'preferences'), {
          theme: 'hacked',
          globalVariables: {},
        })
      );
    });
  });

  describe('Unauthenticated Access', () => {
    it('should deny all operations for unauthenticated users', async () => {
      const userId = 'user-123';

      // Set up data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', userId), {
          email: 'user@test.com',
          tier: 'free',
          noteCount: 1,
        });
        await setDoc(doc(db, 'users', userId, 'notes', 'note-1'), {
          name: 'Note',
          content: 'Content',
          order: 0,
        });
        await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
          theme: 'light',
          globalVariables: {},
        });
      });

      const unauthenticatedContext = testEnv.unauthenticatedContext();
      const db = unauthenticatedContext.firestore();

      // Test all operations fail
      await assertFails(getDoc(doc(db, 'users', userId)));
      await assertFails(getDoc(doc(db, 'users', userId, 'notes', 'note-1')));
      await assertFails(getDoc(doc(db, 'users', userId, 'settings', 'preferences')));
      await assertFails(
        setDoc(doc(db, 'users', 'new-user'), {
          email: 'new@test.com',
          tier: 'free',
          noteCount: 0,
        })
      );
    });
  });
});
