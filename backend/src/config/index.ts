import type { AppConfig } from '../types/index.js';

/**
 * Application configuration loaded from environment variables.
 * Never store secrets directly in code - always use environment variables.
 */
export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
