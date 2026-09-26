import type { RefundReason } from '../../../constants';

/**
 * The assistant now generates every customer-facing reply in the browser and
 * posts the result back for storage. The backend keeps the deterministic policy
 * engine, the sanitiser and persistence only, so there is no canned reply text
 * left here to fall back to.
 */
export const PROMPT_VERSION = 'refund-assistant-frontend-v1';

export interface AiClassification {
  intent: 'REFUND_REQUEST' | 'STATUS_CHECK' | 'OTHER';
  detectedReason: RefundReason | 'UNKNOWN' | null;
  claimedItemNames: string[];
  isDispute: boolean;
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  requestedHuman: boolean;
  confidence: number;
  summary: string;
}

export interface AiAudit {
  provider: string;
  model: string;
  latencyMs: number;
  promptVersion: string;
  inputChars: number;
  injectionFlags: string[];
  usedFallback: boolean;
  classification: AiClassification | null;
  error?: string;
}

export interface AiAuditInput {
  model?: string;
  latencyMs?: number;
  classification?: Partial<AiClassification> | null;
}

export const MAX_ASSISTANT_REPLY_CHARS = 4_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function buildAiAudit(input: AiAuditInput): AiAudit {
  const partial = input.classification ?? {};
  const detected = partial.detectedReason ?? null;
  const claimed = Array.isArray(partial.claimedItemNames)
    ? partial.claimedItemNames.filter((item): item is string => typeof item === 'string').slice(0, 12)
    : [];

  const classification: AiClassification | null =
    partial.intent || detected || partial.isDispute !== undefined
      ? {
          intent: partial.intent ?? 'OTHER',
          detectedReason: detected,
          claimedItemNames: claimed,
          isDispute: partial.isDispute === true,
          urgency: partial.urgency ?? 'NORMAL',
          requestedHuman: partial.requestedHuman === true,
          confidence: clamp(partial.confidence ?? 0.5, 0, 1),
          summary: (partial.summary ?? '').slice(0, 400),
        }
      : null;

  return {
    provider: 'gemini',
    model: (input.model ?? '').slice(0, 80),
    latencyMs: clamp(input.latencyMs ?? 0, 0, 120_000),
    promptVersion: PROMPT_VERSION,
    inputChars: 0,
    injectionFlags: [],
    usedFallback: false,
    classification,
  };
}

export function clampAssistantReply(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_ASSISTANT_REPLY_CHARS);
}
