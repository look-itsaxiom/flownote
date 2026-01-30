# Firebase Emulator Setup

This document describes how to use the Firebase emulators for local development.

## Overview

FlowNote uses Firebase for authentication and data storage:
- **Firebase Auth** - User authentication (Google, GitHub OAuth)
- **Cloud Firestore** - Database for users, notes, and settings

For local development, we run Firebase emulators instead of connecting to production Firebase. This allows:
- Offline development
- Fast iteration without affecting production data
- Testing security rules
- Creating test users and data

## Quick Start

### Starting the Emulators

```bash
# Start all services (frontend + firebase emulators)
docker compose up

# Or start just the Firebase emulators
docker compose up firebase
```

### Accessing the Emulator UI

Once running, access the Firebase Emulator UI at:

**http://localhost:4001**

The UI provides:
- Authentication - View and create test users
- Firestore - Browse and edit data
- Logs - View emulator activity

### Emulator Ports

| Service | Port | URL |
|---------|------|-----|
| Emulator UI | 4001 | http://localhost:4001 |
| Auth Emulator | 9099 | http://localhost:9099 |
| Firestore Emulator | 8080 | http://localhost:8080 |

## Seeding Test Data

To populate the emulator with test data:

```bash
# Install dependencies (first time only)
cd scripts
npm install

# Run the seed script (emulators must be running)
npm run seed
```

This creates three test users:

| Email | Tier | Notes | User ID |
|-------|------|-------|---------|
| free@example.com | Free | 3 | test-user-free |
| pro@example.com | Pro | 1 | test-user-pro |
| atlimit@example.com | Free | 5 (at limit) | test-user-at-limit |

## Testing Security Rules

The security rules tests verify that:
- Users can only access their own data
- Free tier users are limited to 5 notes
- Pro tier users have unlimited notes
- Unauthenticated users cannot access any data

### Running Tests

```bash
# Start emulators first
docker compose up firebase

# In another terminal, run tests
cd tests/firebase
npm install  # First time only
npm test
```

### Test Coverage

The tests cover:

1. **Emulator Connection** - Verifies connectivity
2. **User Document Rules**
   - Read own document (allowed)
   - Read other's document (denied)
   - Write own document (allowed)
   - Write other's document (denied)
3. **Notes Subcollection**
   - Read own notes (allowed)
   - Read other's notes (denied)
   - Create note under limit (allowed)
   - Create note at limit (denied for free tier)
   - Create unlimited notes (allowed for pro tier)
   - Update own notes (allowed)
   - Delete own notes (allowed)
   - Delete other's notes (denied)
4. **Settings Subcollection**
   - Read/write own settings (allowed)
   - Read/write other's settings (denied)
5. **Unauthenticated Access** - All operations denied

## Connecting from Frontend/Backend

### Frontend Configuration

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'fake-api-key',  // Not validated by emulator
  authDomain: 'localhost',
  projectId: 'flownote-dev',
});

const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators in development
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

### Backend Configuration

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// For emulator, we can use a simple app initialization
const app = initializeApp({
  projectId: 'flownote-dev',
});

// Set emulator environment variables before importing firebase-admin
// FIRESTORE_EMULATOR_HOST=localhost:8080
// FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

## Data Persistence

Emulator data is persisted between restarts using a Docker volume (`firebase-data`). To clear all data:

```bash
# Stop containers and remove volume
docker compose down -v

# Restart
docker compose up
```

## Troubleshooting

### Emulator won't start

1. Check if ports are already in use:
   ```bash
   netstat -an | grep -E '(4001|8080|9099)'
   ```

2. Check Docker logs:
   ```bash
   docker compose logs firebase
   ```

### Tests fail to connect

1. Ensure emulators are running: `docker compose up firebase`
2. Check emulator health: `curl http://localhost:4001`
3. Verify Firestore is responding: `curl http://localhost:8080`

### Security rules not applying

1. Verify `firestore.rules` file exists in project root
2. Check for syntax errors in rules file
3. Restart the emulators after rule changes:
   ```bash
   docker compose restart firebase
   ```

## Security Rules Reference

The security rules enforce:

### User Documents (`/users/{userId}`)
- Only the authenticated user matching `userId` can read/write

### Notes (`/users/{userId}/notes/{noteId}`)
- Only the owning user can read, update, delete
- Create is allowed if:
  - User is authenticated
  - User owns the path
  - User is pro tier OR noteCount < 5

### Settings (`/users/{userId}/settings/{doc}`)
- Only the owning user can read/write

See `firestore.rules` for the complete implementation.
