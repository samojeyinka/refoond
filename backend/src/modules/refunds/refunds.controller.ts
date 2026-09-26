import type { Request, Response } from 'express';
import { z } from 'zod';
import { REFUND_DECISIONS, REFUND_REASONS } from '../../constants';
import { ok } from '../../utils/http';
import type { AuthedRequest } from '../../types/request';
import {
  appendAssistantMessage,
  appendMessage,
  createRefundRequest,
  getRefundRequest,
  listOrdersForCustomer,
  listRefundRequests,
  markRequestSeen,
  policySummary,
  resolveEscalatedRequest,
} from './refunds.service';
import type { AiAuditInput } from './ai/refundAi';

const orderNumberSchema = z.string().min(4).max(40);

export const listMyOrdersSchema = z.object({
  query: z.object({}).passthrough().optional(),
});

export const listMyRequestsSchema = z.object({
  query: z
    .object({
      decision: z.enum(REFUND_DECISIONS).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .optional(),
});

export const createRefundSchema = z.object({
  body: z.object({
    orderNumber: orderNumberSchema,
    reason: z.enum(REFUND_REASONS),
    requestedAmount: z.number().positive().max(100_000),
    claimedItemNames: z.array(z.string().min(1).max(160)).max(12).optional(),
    message: z.string().min(1).max(2_000),
  }),
});

export const requestIdSchema = z.object({
  params: z.object({ requestId: z.string().min(1) }),
});

export const sendMessageSchema = z.object({
  params: z.object({ requestId: z.string().min(1) }),
  body: z.object({ body: z.string().min(1).max(2_000) }),
});

const aiMetaSchema = z
  .object({
    model: z.string().max(80).optional(),
    latencyMs: z.number().min(0).max(120_000).optional(),
    classification: z
      .object({
        intent: z.enum(['REFUND_REQUEST', 'STATUS_CHECK', 'OTHER']).optional(),
        detectedReason: z.enum([...REFUND_REASONS, 'UNKNOWN']).optional(),
        claimedItemNames: z.array(z.string().max(160)).max(12).optional(),
        isDispute: z.boolean().optional(),
        urgency: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
        requestedHuman: z.boolean().optional(),
        confidence: z.number().min(0).max(1).optional(),
        summary: z.string().max(400).optional(),
      })
      .nullable()
      .optional(),
  })
  .optional();

export const sendAiMessageSchema = z.object({
  params: z.object({ requestId: z.string().min(1) }),
  body: z.object({ body: z.string().min(1).max(4_000), meta: aiMetaSchema }),
});

export const adminListSchema = z.object({
  query: z
    .object({
      decision: z.enum(REFUND_DECISIONS).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .optional(),
});

export const resolveSchema = z.object({
  params: z.object({ requestId: z.string().min(1) }),
  body: z.object({
    outcome: z.enum(['APPROVED', 'DENIED']),
    note: z.string().min(1).max(1_000),
  }),
});

function centsFrom(amount: number): number {
  return Math.round(amount * 100);
}

export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  ok(res, { orders: await listOrdersForCustomer(authed.user.id) });
}

export async function listMyRequests(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const query = req.query as { decision?: string; limit?: number };
  ok(
    res,
    await listRefundRequests({
      customerId: authed.user.id,
      decision: query.decision,
      limit: query.limit,
      viewerId: authed.user.id,
      viewerRole: 'CUSTOMER',
    }),
  );
}

/** Clears the viewer's unread badge once they have opened the thread. */
export async function markSeen(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  await markRequestSeen({
    requestId,
    userId: authed.user.id,
    role: authed.user.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
  });
  ok(res, { seen: true });
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const body = req.body as {
    orderNumber: string;
    reason: (typeof REFUND_REASONS)[number];
    requestedAmount: number;
    claimedItemNames?: string[];
    message: string;
  };

  const result = await createRefundRequest({
    customerId: authed.user.id,
    orderNumber: body.orderNumber,
    reason: body.reason,
    requestedCents: centsFrom(body.requestedAmount),
    customerMessage: body.message,
    claimedItemNames: body.claimedItemNames ?? [],
  });

  ok(res, result, 201);
}

export async function getRequest(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  const isAdmin = authed.user.role === 'ADMIN';
  ok(res, await getRefundRequest(requestId, isAdmin ? undefined : authed.user.id));
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  const { body } = req.body as { body: string };
  const author = authed.user.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

    const result = await appendMessage({
      requestId,
      author,
      authorId: authed.user.id,
      authorName: authed.user.fullName,
      body,
    });
  const request = await getRefundRequest(requestId, author === 'CUSTOMER' ? authed.user.id : undefined);
  ok(res, { ...result, request });
}

export async function sendAiMessage(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  const { body, meta } = req.body as { body: string; meta?: AiAuditInput };

  const result = await appendAssistantMessage({
    requestId,
    authorId: authed.user.id,
    body,
    meta,
  });

  ok(res, result, 201);
}

export async function adminListRequests(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const query = req.query as { decision?: string; limit?: number };
  ok(
    res,
    await listRefundRequests({
      decision: query.decision,
      limit: query.limit,
      viewerId: authed.user.id,
      viewerRole: 'ADMIN',
    }),
  );
}

export async function adminGetRequest(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  // The reviewer is the viewer here, so unread counts are per staff member
  // rather than always zero.
  ok(
    res,
    await getRefundRequest(requestId, undefined, { id: authed.user.id, role: 'ADMIN' }),
  );
}

export async function adminResolveRequest(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  const { requestId } = req.params as { requestId: string };
  const { outcome, note } = req.body as { outcome: 'APPROVED' | 'DENIED'; note: string };

  ok(
    res,
    await resolveEscalatedRequest({ requestId, adminId: authed.user.id, outcome, note }),
  );
}

export async function getPolicy(_req: Request, res: Response): Promise<void> {
  ok(res, policySummary());
}
