/**
 * FlowNote Backend Type Definitions
 */

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version?: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
}

// Placeholder types for future implementation
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface Note {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
