import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { SwaggerUiOptions } from 'swagger-ui-express';
import { env } from './config/env';
import openapiDocument from './openapi.json';

export const API_DOCS_PATH = '/api-docs';

/**
 * The spec mirrors `src/routes/index.ts` and the module routers. Its `servers`
 * block is rewritten at runtime, because the public URL comes from the
 * environment rather than being hard-coded in the JSON.
 */
const document = {
  ...openapiDocument,
  servers: [{ url: `${env.serverUrl}/api/v1`, description: `${env.nodeEnv} server` }],
};

const options: SwaggerUiOptions = {
  customSiteTitle: 'Refoond API docs',
  swaggerOptions: {
    // Keeps the cookie session alive across page reloads in the UI.
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 1,
  },
};

export const apiDocsRouter = Router();

/**
 * The API is served under a `default-src 'none'` policy, which would block the
 * docs page. swagger-ui-express serves its init script and bundle as separate
 * files, so scripts need not be inlined; only the two `<style>` blocks it emits
 * do. Every other Helmet header still applies, and this exception is scoped to
 * this route.
 */
const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

apiDocsRouter.use(API_DOCS_PATH, (_req, res, next) => {
  res.setHeader('Content-Security-Policy', DOCS_CSP);
  next();
});

apiDocsRouter.use(API_DOCS_PATH, swaggerUi.serve, swaggerUi.setup(document, options));

/** The raw spec, so tooling and tests can fetch and assert on it. */
apiDocsRouter.get(`${API_DOCS_PATH}.json`, (_req, res) => {
  res.json(document);
});
