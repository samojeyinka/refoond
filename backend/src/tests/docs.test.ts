import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express, Router } from 'express';
import { createApp } from '../app';
import { connectDatabase, disconnectDatabase } from '../database/mongo';
import apiRouter from '../routes';

let app: Express;
let mongo: MongoMemoryServer;

/** Minimal shape of the parts of the spec these tests assert on. */
interface Spec {
  openapi: string;
  info: { title: string; version: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, { type: string; in?: string; name?: string }>;
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('refoond-docs-test');
  await connectDatabase();
  app = createApp();
}, 60_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo.stop();
});

/**
 * Express encodes a mount path as a regexp source such as
 * `^\/auth\/?(?=\/|$)`. Recover the readable path from it.
 */
function mountPath(regexpSource: string | undefined): string {
  if (!regexpSource) return '';
  const cleaned = regexpSource
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/')
    .replace(/\/$/, '');
  return cleaned === '' ? '' : cleaned;
}

/** Every `METHOD /path` the mounted API router serves. */
function registeredRoutes(router: Router, prefix: string): string[] {
  const found: string[] = [];
  const stack = (router as unknown as { stack?: unknown[] }).stack ?? [];

  for (const layer of stack as Array<Record<string, any>>) {
    if (layer.route) {
      const methods = layer.route.methods as Record<string, boolean>;
      for (const method of Object.keys(methods)) {
        if (methods[method]) found.push(`${method.toUpperCase()} ${toSpecPath(prefix + layer.route.path)}`);
      }
      continue;
    }
    if (layer.name === 'router' && layer.handle?.stack) {
      found.push(...registeredRoutes(layer.handle as Router, `${prefix}${mountPath(layer.regexp?.source)}`));
    }
  }
  return found;
}

/** Express writes `:requestId`, OpenAPI writes `{requestId}`. Compare like for like. */
function toSpecPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

describe('swagger docs', () => {
  it('serves the interactive UI', async () => {
    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });

  /**
   * The API runs under `default-src 'none'`, which would block the docs page.
   * Assert both halves: the exception is granted to the docs, and nowhere else.
   * Scripts stay un-inlined, because swagger-ui-express ships them as files.
   */
  it('relaxes CSP for the docs page only', async () => {
    const docs = await request(app).get('/api-docs/');
    const docsCsp = String(docs.headers['content-security-policy']);
    expect(docsCsp).toContain("default-src 'self'");
    expect(docsCsp).toContain("script-src 'self'");
    expect(docsCsp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(docsCsp).toContain("style-src 'self' 'unsafe-inline'");
    expect(docsCsp).toContain("frame-ancestors 'none'");

    const api = await request(app).get('/api/v1/refunds/policy');
    expect(String(api.headers['content-security-policy'])).toContain("default-src 'none'");
  });

  it('serves the raw spec as JSON', async () => {
    const response = await request(app).get('/api-docs.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
  });

  it('declares the session cookie as the security scheme', async () => {
    const response = await request(app).get('/api-docs.json');
    const spec = response.body as Spec;
    // The name must match the cookie the auth flow actually sets.
    expect(spec.components.securitySchemes.cookieAuth).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'wn_token',
    });
  });

  it('derives its server URL from the environment', async () => {
    const response = await request(app).get('/api-docs.json');
    const spec = response.body as Spec;
    expect(spec.servers[0]?.url).toMatch(/\/api\/v1$/);
  });

  /**
   * The spec is hand-maintained, so this is the guard that stops it drifting:
   * every route the app serves must be documented, and every documented path
   * must exist. A new endpoint without a spec entry fails here.
   */
  it('documents exactly the routes the app serves', async () => {
    const response = await request(app).get('/api-docs.json');
    const spec = response.body as Spec;

    const documented = new Set<string>();
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const method of Object.keys(operations)) {
        documented.add(`${method.toUpperCase()} /api/v1${path}`);
      }
    }

    const actual = new Set(registeredRoutes(apiRouter, '/api/v1'));

    const undocumented = [...actual].filter((route) => !documented.has(route)).sort();
    const phantom = [...documented].filter((route) => !actual.has(route)).sort();

    expect({ undocumented, phantom }).toEqual({ undocumented: [], phantom: [] });
  });

  it('resolves every internal $ref in the spec', async () => {
    const response = await request(app).get('/api-docs.json');
    const spec = response.body as Spec;
    const serialized = JSON.stringify(spec);

    const refs = [...serialized.matchAll(/"#\/([^"]+)"/g)].map((match) => match[1] as string);
    expect(refs.length).toBeGreaterThan(0);

    const dangling: string[] = [];
    for (const ref of new Set(refs)) {
      const resolved = ref
        .split('/')
        .reduce<unknown>(
          (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
          spec,
        );
      if (resolved === undefined) dangling.push(ref);
    }
    expect(dangling).toEqual([]);
  });
});
