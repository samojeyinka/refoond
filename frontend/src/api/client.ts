type ErrorPayload = {
  code?: string;
  message?: string;
  details?: unknown;
};

type ErrorEnvelope = {
  success: false;
  error?: ErrorPayload;
  message?: string;
  code?: string;
  details?: unknown;
};

type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return isRecord(value) && value.success === true && 'data' in value;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return isRecord(value) && value.success === false;
}

function configuredOrigin(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) return '';
  return configured.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code = 'REQUEST_FAILED', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function apiUrl(path: string): string {
  return `${configuredOrigin()}${path}`;
}

export function socketUrl(): string | undefined {
  return configuredOrigin() || undefined;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || isErrorEnvelope(payload)) {
    const envelope = isErrorEnvelope(payload) ? payload : null;
    const nested = envelope?.error;
    const message = nested?.message ?? envelope?.message ?? `Request failed with status ${response.status}`;
    const code = nested?.code ?? envelope?.code ?? 'REQUEST_FAILED';
    const details = nested?.details ?? envelope?.details;
    throw new ApiError(message, response.status, code, details);
  }

  if (isSuccessEnvelope<T>(payload)) return payload.data;

  throw new ApiError('The server returned an invalid response', response.status, 'INVALID_RESPONSE');
}
