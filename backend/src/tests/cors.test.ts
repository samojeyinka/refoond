import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../app';
import { connectDatabase, disconnectDatabase } from '../database/mongo';

let app: Express;
let mongo: MongoMemoryServer;

const CREDENTIALS = { email: 'admin@refoond.dev', password: 'Password123!' };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('refoond-cors-test');
  await connectDatabase();
  app = createApp();
}, 60_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo.stop();
});

/** POST /auth/login with a given Origin, which browsers always send on POST. */
function loginFrom(origin?: string) {
  const req = request(app).post('/api/v1/auth/login').send(CREDENTIALS);
  if (origin !== undefined) req.set('Origin', origin);
  return req;
}

describe('cors policy', () => {
  /**
   * The regression that shipped with the Swagger UI: browsers attach an Origin
   * header even to same-origin POSTs, and the backend was rejecting its own
   * origin, so logging in from /api-docs failed with "Origin not allowed".
   */
  it('allows the backend own origin', async () => {
    const response = await loginFrom('http://localhost:5050');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  /**
   * Whatever host the docs are reached by must work, even one that appears in
   * no config, because the browser's Origin matches the host being requested.
   */
  it('allows the same origin on a host that is not configured', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Host', 'refoond.internal:5050')
      .set('Origin', 'http://refoond.internal:5050')
      .send(CREDENTIALS);
    expect(response.status).toBe(200);
  });

  it('rejects a mismatched origin even on an allowed host', async () => {
    // A page served from 127.0.0.1:5050 posting to localhost:5050. Browsers see
    // those as distinct origins, so the allowed host does not launder it.
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Host', 'localhost:5050')
      .set('Origin', 'http://127.0.0.1:5050')
      .send(CREDENTIALS);
    expect(response.status).toBe(403);
  });

  it('allows the configured frontend origin', async () => {
    const response = await loginFrom('http://localhost:5173');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('allows credentialed requests from an allowed origin', async () => {
    const response = await loginFrom('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows clients that send no Origin at all', async () => {
    const response = await loginFrom();
    expect(response.status).toBe(200);
  });

  /**
   * Stripping the CORS headers is not enough: the request would still run and
   * still create a session, letting any site drive the API for a logged-in
   * visitor. A disallowed origin must be rejected before the route is reached.
   */
  it('rejects a disallowed origin without running the request', async () => {
    const response = await loginFrom('http://evil.example');
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a disallowed origin on reads too', async () => {
    const response = await request(app).get('/api/v1/refunds/policy').set('Origin', 'http://evil.example');
    expect(response.status).toBe(403);
  });

  it('rejects a subdomain of an allowed origin', async () => {
    const response = await loginFrom('http://localhost:5173.evil.example');
    expect(response.status).toBe(403);
  });
});
