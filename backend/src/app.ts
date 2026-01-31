import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import healthRouter from './routes/health.js';
import notesRouter from './routes/notes.js';
import billingRouter from './routes/billing.js';
import { authMiddleware } from './middleware/auth.js';
import { initializeFirebase } from './services/firebase.js';

// Initialize Firebase Admin SDK
initializeFirebase();

/**
 * Create and configure the Express application
 */
export const app: Express = express();

// Security middleware - Helmet adds various HTTP headers for security
app.use(helmet());

// CORS configuration - allowlist frontend origin
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Rate limiting - protect against brute force and DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// IMPORTANT: Stripe webhook needs raw body for signature verification
// Must be registered BEFORE express.json() middleware
// The webhook route handler uses express.raw() internally
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(healthRouter);
app.use('/api/notes', authMiddleware, notesRouter);
// Billing routes (checkout and portal require auth, webhook does not)
app.use(billingRouter);
