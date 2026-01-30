# FlowNote Micro SaaS: Auth & Sync Design

**Date:** 2026-01-30
**Status:** Approved
**Focus:** TDD, Security, Parallel Implementation

---

## 1. Product Overview

FlowNote becomes a micro SaaS with cloud sync and freemium monetization.

### Pricing Tiers

| | **Free** | **Pro ($0.99/mo)** |
|---|----------|-------------------|
| Notes | 5 max | Unlimited |
| Sync across devices | ✓ | ✓ |
| Ads | Yes | No |
| Export (PDF/MD/CSV) | — | Roadmap |
| Custom themes | — | Roadmap |
| Note sharing | — | Roadmap |
| Version history | — | Roadmap |

---

## 2. Architecture (GCP Free Tier)

```
┌──────────────────────────────────────────────────────────┐
│                        GCP                               │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Cloud     │    │  Cloud Run  │    │  Firestore  │  │
│  │  Storage    │    │  (Backend)  │    │  (Database) │  │
│  │ (Frontend)  │    │             │    │             │  │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘  │
│         │                  │                    ▲        │
│         │    ┌─────────────┴────────────────────┘        │
│         │    │                                           │
│  ┌──────┴────┴──┐    ┌─────────────┐                    │
│  │ Cloud Load   │    │  Firebase   │                    │
│  │  Balancer    │    │    Auth     │                    │
│  └──────────────┘    └─────────────┘                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
              │
              ▼
       ┌─────────────┐         ┌─────────────┐
       │   Stripe    │         │  AdSense    │
       │ (Payments)  │         │   (Ads)     │
       └─────────────┘         └─────────────┘
```

### Services

| Component | GCP Service | Free Tier Limit |
|-----------|-------------|-----------------|
| Frontend | Cloud Storage + CDN | 5GB storage |
| Backend | Cloud Run | 2M requests/month |
| Database | Firestore | 1GB, 50K reads/day |
| Auth | Firebase Auth | Unlimited users |
| Container Registry | Artifact Registry | 500MB |
| Payments | Stripe | 2.9% + $0.30 per txn |
| Ads | Google AdSense | Revenue share |

---

## 3. Data Model (Firestore)

```
users/
  {userId}/
    email: string
    displayName: string
    avatarUrl: string (nullable)
    provider: "google" | "github"
    tier: "free" | "pro"
    stripeCustomerId: string (nullable)
    stripeSubscriptionId: string (nullable)
    createdAt: timestamp
    updatedAt: timestamp

    notes/  (subcollection)
      {noteId}/
        name: string
        content: string
        order: number
        createdAt: timestamp
        updatedAt: timestamp

    settings/  (subcollection)
      preferences/
        theme: "light" | "dark"
        globalVariables: map<string, any>
```

### Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /notes/{noteId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create: if request.auth != null
                      && request.auth.uid == userId
                      && noteCountUnderLimit();
        allow update, delete: if request.auth != null && request.auth.uid == userId;
      }

      match /settings/{doc} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Helper: check note limit for free users
    function noteCountUnderLimit() {
      let user = get(/databases/$(database)/documents/users/$(request.auth.uid));
      let tier = user.data.tier;
      let noteCount = user.data.noteCount;
      return tier == 'pro' || noteCount < 5;
    }
  }
}
```

---

## 4. API Endpoints

### Auth
```
GET  /auth/google          → Redirect to Google OAuth
GET  /auth/github          → Redirect to GitHub OAuth
GET  /auth/callback        → Handle OAuth return, create session
POST /auth/logout          → Clear session
```

### Notes (authenticated)
```
GET    /api/notes          → List user's notes
POST   /api/notes          → Create note (enforces 5-note limit for free)
GET    /api/notes/:id      → Get single note
PUT    /api/notes/:id      → Update note
DELETE /api/notes/:id      → Delete note
POST   /api/sync           → Bulk sync (offline → online reconciliation)
```

### User (authenticated)
```
GET    /api/me             → Current user profile + tier
PUT    /api/me/settings    → Update preferences
```

### Billing (authenticated)
```
POST   /api/billing/checkout    → Create Stripe checkout session
POST   /api/billing/portal      → Create Stripe customer portal link
POST   /api/billing/webhook     → Stripe webhook (unauthenticated, signature verified)
```

---

## 5. Security Requirements

### Authentication
- [ ] All `/api/*` routes require valid Firebase ID token
- [ ] Tokens verified server-side with Firebase Admin SDK
- [ ] Token expiration handled (refresh flow)
- [ ] CSRF protection on state-changing endpoints

### Authorization
- [ ] Users can only access their own data (Firestore rules + backend checks)
- [ ] Note limit enforced server-side (never trust client)
- [ ] Tier checked server-side before feature access

### Data Protection
- [ ] All traffic over HTTPS (Cloud Run default)
- [ ] Sensitive config in Secret Manager (Stripe keys, etc.)
- [ ] No PII in logs
- [ ] Input validation on all endpoints (sanitize, length limits)

### Billing Security
- [ ] Stripe webhooks verified with signature
- [ ] Checkout sessions created server-side only
- [ ] No price/product IDs from client (hardcoded server-side)

### Infrastructure
- [ ] Cloud Run with minimum permissions (principle of least privilege)
- [ ] Firestore security rules deployed and tested
- [ ] Rate limiting on auth endpoints
- [ ] Dependency scanning in CI (npm audit)

---

## 6. Project Structure

```
flownote/
├── frontend/                    # React SPA
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginButton.tsx
│   │   │   │   └── UserMenu.tsx
│   │   │   ├── billing/
│   │   │   │   ├── UpgradePrompt.tsx
│   │   │   │   └── AdBanner.tsx
│   │   │   └── sync/
│   │   │       └── SyncStatus.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useSync.ts
│   │   │   └── useSubscription.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── notes.ts
│   │   │   └── billing.ts
│   │   └── ...existing files
│   └── tests/
│       └── ...
│
├── backend/                     # Express API
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── app.ts              # Express app setup
│   │   ├── config/
│   │   │   └── index.ts        # Environment config
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Firebase token verification
│   │   │   ├── rateLimit.ts    # Rate limiting
│   │   │   └── validate.ts     # Input validation
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── notes.ts
│   │   │   ├── user.ts
│   │   │   └── billing.ts
│   │   ├── services/
│   │   │   ├── firebase.ts     # Firebase Admin SDK
│   │   │   ├── firestore.ts    # Database operations
│   │   │   └── stripe.ts       # Stripe operations
│   │   └── types/
│   │       └── index.ts
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/
│
├── docker-compose.yml           # Local development
├── docker-compose.prod.yml      # Production-like testing
├── cloudbuild.yaml              # GCP CI/CD
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Firestore indexes
└── docs/
    └── plans/
        └── this file
```

---

## 7. Docker Configuration

### docker-compose.yml (Local Development)

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "4000:80"
    environment:
      - VITE_API_URL=http://localhost:8080
      - VITE_FIREBASE_CONFIG=${FIREBASE_CONFIG}
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PORT=8080
      - FIRESTORE_EMULATOR_HOST=firebase:8081
      - FIREBASE_AUTH_EMULATOR_HOST=firebase:9099
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - firebase

  firebase:
    image: node:20-alpine
    working_dir: /app
    command: npx firebase emulators:start --project=demo-flownote
    ports:
      - "8081:8081"   # Firestore
      - "9099:9099"   # Auth
      - "4001:4000"   # Emulator UI
    volumes:
      - ./firebase.json:/app/firebase.json
      - ./firestore.rules:/app/firestore.rules
```

### Backend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 8080
USER node
CMD ["node", "dist/index.js"]
```

---

## 8. Testing Strategy (TDD)

### Backend Tests

```
backend/tests/
├── unit/
│   ├── middleware/
│   │   ├── auth.test.ts        # Token verification
│   │   └── validate.test.ts    # Input validation
│   ├── services/
│   │   ├── firestore.test.ts   # DB operations (mocked)
│   │   └── stripe.test.ts      # Billing logic (mocked)
│   └── routes/
│       ├── notes.test.ts       # Note CRUD logic
│       └── billing.test.ts     # Checkout/webhook logic
├── integration/
│   ├── auth.test.ts            # Full auth flow with emulator
│   ├── notes.test.ts           # CRUD with Firestore emulator
│   └── billing.test.ts         # Stripe webhook handling
└── security/
    ├── injection.test.ts       # SQL/NoSQL injection attempts
    ├── auth-bypass.test.ts     # Unauthorized access attempts
    └── rate-limit.test.ts      # Rate limiting verification
```

### Frontend Tests

```
frontend/tests/
├── unit/
│   ├── hooks/
│   │   ├── useAuth.test.ts
│   │   └── useSync.test.ts
│   └── components/
│       ├── LoginButton.test.tsx
│       └── UpgradePrompt.test.tsx
└── integration/
    └── sync-flow.test.ts       # Full sync cycle
```

### Test Commands

```bash
# Backend
cd backend && npm test              # All tests
cd backend && npm run test:unit     # Unit only
cd backend && npm run test:int      # Integration (needs emulators)
cd backend && npm run test:security # Security tests

# Frontend
cd frontend && npm test             # All tests
```

---

## 9. Implementation Phases

### Phase 1: Project Restructure
- Move existing code to `frontend/`
- Create `backend/` scaffold with Express + TypeScript
- Set up Docker Compose with Firebase emulators
- Verify local dev workflow

### Phase 2: Authentication
- Firebase Auth setup (Google + GitHub)
- Backend auth middleware
- Frontend login/logout UI
- User document creation

### Phase 3: Note Sync
- Backend CRUD endpoints
- Frontend sync hooks
- Offline queue + merge logic
- Conflict resolution

### Phase 4: Billing
- Stripe setup ($0.99/mo product)
- Checkout + webhooks
- Tier enforcement
- Customer portal

### Phase 5: Ads
- AdSense integration
- Free tier ad display
- Non-intrusive placement

### Phase 6: GCP Deployment
- Cloud Build pipeline
- Cloud Run + Cloud Storage
- Production Firebase setup
- Domain configuration

---

## 10. Work Stories

See `.beads/` for trackable implementation stories.

### Story Overview

| ID | Story | Dependencies | Parallelizable |
|----|-------|--------------|----------------|
| 1 | Project Restructure | None | No (foundational) |
| 2 | Backend Scaffold | 1 | Yes |
| 3 | Firebase Emulator Setup | 1 | Yes |
| 4 | Auth Middleware (Backend) | 2, 3 | Yes |
| 5 | Auth UI (Frontend) | 1, 3 | Yes |
| 6 | Notes API (Backend) | 4 | Yes |
| 7 | Sync Hooks (Frontend) | 5, 6 | Yes |
| 8 | Billing API (Backend) | 4 | Yes |
| 9 | Billing UI (Frontend) | 5, 8 | Yes |
| 10 | Ads Integration | 5 | Yes |
| 11 | GCP Deployment | All | No (final) |

### Parallel Execution Groups

```
Group A (Foundation):     [1] Project Restructure
                              ↓
Group B (Infrastructure): [2] Backend Scaffold  ║  [3] Firebase Emulators
                              ↓                      ↓
Group C (Auth):           [4] Auth Middleware   ║  [5] Auth UI
                              ↓                      ↓
Group D (Features):       [6] Notes API         ║  [8] Billing API  ║  [10] Ads
                              ↓                      ↓
Group E (Integration):    [7] Sync Hooks        ║  [9] Billing UI
                              ↓
Group F (Deploy):         [11] GCP Deployment
```
