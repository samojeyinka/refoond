import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5050),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SERVER_URL: z.string().default('http://localhost:5050'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_MAX_AGE: z.coerce.number().default(60 * 60 * 24 * 7),
  COOKIE_SECURE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  mongodbUri: parsed.data.MONGODB_URI,
  jwtSecret: parsed.data.JWT_SECRET,
  clientUrl: parsed.data.CLIENT_URL,
  serverUrl: parsed.data.SERVER_URL,
  corsOrigin: parsed.data.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  cookieMaxAge: parsed.data.COOKIE_MAX_AGE,
  cookieSecure: parsed.data.COOKIE_SECURE === 'true' || (parsed.data.NODE_ENV === 'production' && parsed.data.COOKIE_SECURE !== 'false'),
  isProduction: parsed.data.NODE_ENV === 'production',
} as const;

export const isTest = env.nodeEnv === 'test';