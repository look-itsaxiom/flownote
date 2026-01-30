import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '../types/index.js';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 * Returns the current health status of the API
 */
router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
