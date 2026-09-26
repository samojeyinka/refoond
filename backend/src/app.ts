import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env';
import { globalRateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './utils/http';
import { AppError, errorCodes } from './utils/errors';
import { apiDocsRouter } from './docs';
import routes from './routes';

/** Whether an `Origin` header points at this very server. */
function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The widget is embedded on other origins, so resource policy stays open.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // This service only ever returns JSON, so nothing here is a document the
      // browser renders. Locking the policy down anyway is free and means that
      // if an HTML route is ever added it cannot be used to frame or script us.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'none'"],
        },
      },
    }),
  );

  const allowedOrigins = new Set<string>([...env.corsOrigin, env.clientUrl, env.serverUrl]);

  /**
   * The backend serves the API and its own Swagger UI, and browsers send an
   * `Origin` header even on same-origin POSTs. So the backend has to accept its
   * own origin, whatever host it is reached by (localhost, 127.0.0.1, a LAN IP,
   * a deployed domain), alongside the configured clients.
   *
   * A disallowed origin is rejected outright rather than merely stripped of its
   * CORS headers: hiding the response still runs the request, which would let
   * another site drive this cookie-authenticated API on a visitor's behalf.
   */
  app.use((req, _res, next) => {
    const origin = req.headers.origin;
    if (origin === undefined || allowedOrigins.has(origin) || isSameOrigin(origin, req.headers.host)) {
      next();
      return;
    }
    next(new AppError(403, 'Origin not allowed', errorCodes.FORBIDDEN));
  });

  // Every request that reaches this point is from an allowed origin.
  app.use(cors({ origin: true, credentials: true }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Interactive docs, mounted before the rate limiter so browsing the spec is
  // never throttled. The API itself still sits behind the limit.
  app.use(apiDocsRouter);

  app.use(globalRateLimit);
  if (!env.isProduction) {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
      });
      next();
    });
  }

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' },
    });
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
