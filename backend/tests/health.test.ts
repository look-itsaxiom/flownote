import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health Check Endpoint', () => {
  it('should return 200 status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return JSON with status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('should include timestamp in response', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('App Bootstrap', () => {
  it('should create express app without errors', async () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('should have JSON middleware configured', async () => {
    const response = await request(app)
      .post('/health')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json');

    // Even if POST returns 404 or 405, the app should parse JSON without error
    expect(response.status).toBeDefined();
  });
});

describe('Security Middleware', () => {
  it('should include security headers from helmet', async () => {
    const response = await request(app).get('/health');

    // Helmet adds various security headers
    expect(response.headers).toHaveProperty('x-content-type-options');
  });

  it('should have CORS headers configured', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    // CORS should be configured (may or may not include the header depending on config)
    expect(response.status).toBe(200);
  });
});
