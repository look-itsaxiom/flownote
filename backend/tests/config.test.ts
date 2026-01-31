import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load PORT from environment variable', async () => {
    process.env.PORT = '3000';
    const { config } = await import('../src/config/index.js');
    expect(config.port).toBe(3000);
  });

  it('should default PORT to 8080 if not set', async () => {
    delete process.env.PORT;
    const { config } = await import('../src/config/index.js');
    expect(config.port).toBe(8080);
  });

  it('should load NODE_ENV from environment variable', async () => {
    process.env.NODE_ENV = 'production';
    const { config } = await import('../src/config/index.js');
    expect(config.nodeEnv).toBe('production');
  });

  it('should default NODE_ENV to development if not set', async () => {
    delete process.env.NODE_ENV;
    const { config } = await import('../src/config/index.js');
    expect(config.nodeEnv).toBe('development');
  });

  it('should load CORS_ORIGIN from environment variable', async () => {
    process.env.CORS_ORIGIN = 'https://myapp.com';
    const { config } = await import('../src/config/index.js');
    expect(config.corsOrigin).toBe('https://myapp.com');
  });

  it('should default CORS_ORIGIN to localhost:5173 for development', async () => {
    delete process.env.CORS_ORIGIN;
    const { config } = await import('../src/config/index.js');
    expect(config.corsOrigin).toBe('http://localhost:5173');
  });

  it('should load FIREBASE_PROJECT_ID from environment variable', async () => {
    process.env.FIREBASE_PROJECT_ID = 'my-firebase-project';
    const { config } = await import('../src/config/index.js');
    expect(config.firebase.projectId).toBe('my-firebase-project');
  });

  it('should default FIREBASE_PROJECT_ID to flownote-dev', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    const { config } = await import('../src/config/index.js');
    expect(config.firebase.projectId).toBe('flownote-dev');
  });

  it('should load FIREBASE_AUTH_EMULATOR_HOST from environment variable', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    const { config } = await import('../src/config/index.js');
    expect(config.firebase.authEmulatorHost).toBe('localhost:9099');
  });

  it('should default FIREBASE_AUTH_EMULATOR_HOST to undefined', async () => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const { config } = await import('../src/config/index.js');
    expect(config.firebase.authEmulatorHost).toBeUndefined();
  });
});
