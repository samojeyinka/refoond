import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { RefundRequestModel } from '../models/refundRequest.model';
import { verifyToken } from '../middleware/auth';
import { toObjectId } from '../utils/ids';
import { appendAssistantMessage, appendMessage } from '../modules/refunds/refunds.service';
import { REFUND_REASONS, type Role } from '../constants';

interface Principal {
  userId: string;
  role: Role;
}

const refundIdSchema = z.object({ requestId: z.string().min(1) });
const messageSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().min(1).max(2_000),
  clientId: z.string().max(100).optional(),
});

const aiMessageSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().min(1).max(4_000),
  clientId: z.string().max(100).optional(),
  meta: z
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
          confidence: z.number().min(0).max(1).optional(),
          summary: z.string().max(400).optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

async function authenticate(token: string | undefined): Promise<Principal | null> {
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const [user, session] = await Promise.all([
      UserModel.findById(payload.sub).lean(),
      SessionModel.findOne({ _id: payload.sid, active: true }).lean(),
    ]);
    if (!user || !session) return null;
    return { userId: user._id.toString(), role: user.role };
  } catch {
    return null;
  }
}

async function authorizeRequest(principal: Principal, requestId: string): Promise<boolean> {
  const objectId = toObjectId(requestId);
  if (!objectId) return false;
  if (principal.role === 'ADMIN') {
    const exists = await RefundRequestModel.findById(objectId).select('_id').lean();
    return Boolean(exists);
  }
  const exists = await RefundRequestModel.findOne({ _id: objectId, customerId: principal.userId })
    .select('_id')
    .lean();
  return Boolean(exists);
}

function requestRoom(requestId: string): string {
  return `refund:${requestId}`;
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = (socket.handshake.auth?.['token'] as string | undefined) || cookies['wn_token'];
    const principal = await authenticate(token);
    if (!principal) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data['principal'] = principal;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const principal = socket.data['principal'] as Principal;
    socket.emit('connection:ready', { role: principal.role, connectedAt: new Date().toISOString() });
    if (principal.role === 'ADMIN') socket.join('refund:queue');

    socket.on('refund:join', async (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = refundIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
        return;
      }
      if (!(await authorizeRequest(principal, parsed.data.requestId))) {
        ack?.({ ok: false, error: 'FORBIDDEN' });
        return;
      }
      socket.join(requestRoom(parsed.data.requestId));
      ack?.({ ok: true, requestId: parsed.data.requestId });
    });

    socket.on('refund:leave', async (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = refundIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
        return;
      }
      socket.leave(requestRoom(parsed.data.requestId));
      ack?.({ ok: true });
    });

    socket.on('refund:message', async (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
        return;
      }
      const { requestId, body, clientId } = parsed.data;
      if (!(await authorizeRequest(principal, requestId))) {
        ack?.({ ok: false, error: 'FORBIDDEN' });
        return;
      }

      const author = principal.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
      const result = await appendMessage({
        requestId,
        author,
        authorId: principal.userId,
        body,
      });

      const envelope = { requestId, clientId: clientId ?? null, ...result };
      ack?.({ ok: true, ...envelope });
      socket.to(requestRoom(requestId)).emit('refund:message', envelope);
      // Staff join 'refund:queue' the moment they connect, which happens before
      // they open any drawer, so this is the dependable way to reach a console
      // that has a thread open. Without it a customer message is only picked up
      // on the admin's next refetch.
      io.to('refund:queue').emit('refund:activity', { requestId, message: result.message });
    });

    socket.on('refund:ai_message', async (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = aiMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
        return;
      }
      const { requestId, body, meta, clientId } = parsed.data;
      if (principal.role !== 'CUSTOMER') {
        ack?.({ ok: false, error: 'FORBIDDEN' });
        return;
      }
      if (!(await authorizeRequest(principal, requestId))) {
        ack?.({ ok: false, error: 'FORBIDDEN' });
        return;
      }

      // The reply was generated in the browser and is only being stored here.
      const result = await appendAssistantMessage({
        requestId,
        authorId: principal.userId,
        body,
        meta,
      });

      const envelope = { requestId, clientId: clientId ?? null, ...result, aiReply: null };
      ack?.({ ok: true, ...envelope });
      socket.to(requestRoom(requestId)).emit('refund:message', envelope);
    });

    socket.on('refund:typing', async (payload: unknown) => {
      const parsed = z
        .object({ requestId: z.string().min(1), typing: z.boolean() })
        .safeParse(payload);
      if (!parsed.success) return;
      if (!(await authorizeRequest(principal, parsed.data.requestId))) return;
      socket.to(requestRoom(parsed.data.requestId)).emit('refund:typing', {
        requestId: parsed.data.requestId,
        role: principal.role,
        typing: parsed.data.typing,
      });
    });
  });

  return io;
}
