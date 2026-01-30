/**
 * Seed script for Firebase Firestore emulator
 *
 * This script populates the Firestore emulator with test data
 * for local development and testing.
 *
 * Usage:
 *   node scripts/seed-firestore.js
 *
 * Requirements:
 *   - Firebase emulator must be running (docker compose up)
 *   - Environment variables:
 *     - FIRESTORE_EMULATOR_HOST (default: localhost:8080)
 *     - AUTH_EMULATOR_HOST (default: localhost:9099)
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth';

// Firebase config for emulator (these values don't matter for emulator)
const firebaseConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: 'flownote-dev',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const authHost = process.env.AUTH_EMULATOR_HOST || 'http://localhost:9099';

const [firestoreHostname, firestorePort] = firestoreHost.split(':');
connectFirestoreEmulator(db, firestoreHostname, parseInt(firestorePort));
connectAuthEmulator(auth, authHost, { disableWarnings: true });

// Test users data
const testUsers = [
  {
    id: 'test-user-free',
    email: 'free@example.com',
    displayName: 'Free User',
    avatarUrl: null,
    provider: 'google',
    tier: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    noteCount: 3,
  },
  {
    id: 'test-user-pro',
    email: 'pro@example.com',
    displayName: 'Pro User',
    avatarUrl: 'https://example.com/avatar.png',
    provider: 'github',
    tier: 'pro',
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test456',
    noteCount: 10,
  },
  {
    id: 'test-user-at-limit',
    email: 'atlimit@example.com',
    displayName: 'At Limit User',
    avatarUrl: null,
    provider: 'google',
    tier: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    noteCount: 5,
  },
];

// Sample notes for each user
const sampleNotes = {
  'test-user-free': [
    {
      id: 'note-1',
      name: 'Trip Budget',
      content: `Planning trip to Seattle

flights = 450
hotel.perNight = 180
hotel.nights = 4
hotel.total = hotel.perNight * hotel.nights

food.budget = 75 * hotel.nights
activities = 200

total = sum(flights, hotel.total, food.budget, activities)`,
      order: 0,
    },
    {
      id: 'note-2',
      name: 'Grocery List',
      content: `Weekly groceries

milk = 4.99
bread = 3.50
eggs = 5.99
cheese = 7.49

total = sum(milk, bread, eggs, cheese)`,
      order: 1,
    },
    {
      id: 'note-3',
      name: 'Quick Notes',
      content: `Meeting at 3pm
Call dentist
Pick up dry cleaning

expenses = 45 + 30 + 15`,
      order: 2,
    },
  ],
  'test-user-pro': [
    {
      id: 'note-1',
      name: 'Project Budget',
      content: `Q1 Project Budget

dev.hours = 160
dev.rate = 150
dev.total = dev.hours * dev.rate

design.hours = 40
design.rate = 125
design.total = design.hours * design.rate

pm.hours = 20
pm.rate = 100
pm.total = pm.hours * pm.rate

subtotal = sum(dev.total, design.total, pm.total)
overhead = subtotal * 0.15
total = subtotal + overhead`,
      order: 0,
    },
  ],
  'test-user-at-limit': [
    { id: 'note-1', name: 'Note 1', content: 'First note', order: 0 },
    { id: 'note-2', name: 'Note 2', content: 'Second note', order: 1 },
    { id: 'note-3', name: 'Note 3', content: 'Third note', order: 2 },
    { id: 'note-4', name: 'Note 4', content: 'Fourth note', order: 3 },
    { id: 'note-5', name: 'Note 5', content: 'Fifth note (at limit)', order: 4 },
  ],
};

// Sample settings
const defaultSettings = {
  theme: 'light',
  globalVariables: {},
};

async function seedDatabase() {
  console.log('Starting database seed...');
  const now = Timestamp.now();

  for (const user of testUsers) {
    console.log(`Creating user: ${user.displayName} (${user.id})`);

    // Create user document
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      tier: user.tier,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      noteCount: user.noteCount,
      createdAt: now,
      updatedAt: now,
    });

    // Create notes for user
    const notes = sampleNotes[user.id] || [];
    for (const note of notes) {
      console.log(`  Creating note: ${note.name}`);
      const noteRef = doc(db, 'users', user.id, 'notes', note.id);
      await setDoc(noteRef, {
        name: note.name,
        content: note.content,
        order: note.order,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create settings for user
    console.log('  Creating settings');
    const settingsRef = doc(db, 'users', user.id, 'settings', 'preferences');
    await setDoc(settingsRef, {
      ...defaultSettings,
      updatedAt: now,
    });
  }

  console.log('\nSeed completed successfully!');
  console.log('\nTest users created:');
  console.log('  - free@example.com (free tier, 3 notes)');
  console.log('  - pro@example.com (pro tier, 1 note)');
  console.log('  - atlimit@example.com (free tier, 5 notes - at limit)');
  console.log('\nNote: To authenticate in tests, use the test user IDs directly');
  console.log('      with the Auth emulator (e.g., test-user-free)');

  process.exit(0);
}

seedDatabase().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
