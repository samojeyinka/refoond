import { nanoid } from 'nanoid';
import type { FilterQuery } from 'mongoose';
import type { RefundReason } from '../../constants';
import { OrderModel } from '../../models/order.model';
import { RefundMessageModel, RefundRequestModel } from '../../models/refundRequest.model';
import { UserModel } from '../../models/user.model';
import { AppError, errorCodes } from '../../utils/errors';
import { formatCents } from '../../utils/money';
import { toObjectId } from '../../utils/ids';
import { buildAiAudit, clampAssistantReply, type AiAudit, type AiAuditInput, type AiClassification } from './ai/refundAi';
import {
  evaluateRefundPolicy,
  HUMAN_REVIEW_THRESHOLD_CENTS,
  POLICY_VERSION,
  RETURN_WINDOW_DAYS,
  type PolicyContext,
  type PolicyDecision,
  type PolicyOrder,
} from './policy/policy';
import { sanitizeUntrustedText } from './security/injection';

const MS_PER_DAY = 86_400_000;
const MAX_REASON_LENGTH = 2_000;

export interface CreateRefundInput {
  customerId: string;
  orderNumber: string;
  reason: RefundReason;
  requestedCents: number;
  customerMessage: string;
  claimedItemNames: string[];
}

export interface AppendMessageInput {
  requestId: string;
  author: 'CUSTOMER' | 'ADMIN' | 'AI';
  authorId: string;
  authorName?: string;
  body: string;
}

export interface AppendAssistantMessageInput {
  requestId: string;
  authorId: string;
  body: string;
  meta?: AiAuditInput;
}

interface LeanOrder {
  _id: unknown;
  orderNumber: string;
  customerId: unknown;
  status: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  refundedCents: number;
  placedAt: Date;
  deliveredAt: Date | null;
  items: { name: string; category: string; unitAmountCents: number; quantity: number; finalSale: boolean }[];
}

interface LeanRefundRequest {
  _id: unknown;
  reference: string;
  customerId: unknown;
  customerEmail: string;
  orderId: unknown;
  orderNumber: string;
  reason: RefundReason;
  requestedCents: number;
  approvedCents: number;
  eligibleCents: number;
  currency: string;
  customerMessage: string;
  claimedItemNames: string[];
  decision: PolicyDecision['decision'];
  decisionReason: string;
  flags: string[];
  ruleTrace: { ruleId: string; title: string; outcome: string; detail: string; policyRef: string }[];
  policyVersion: string;
  aiReply: string;
  aiMeta: {
    provider?: string;
    model?: string;
    latencyMs?: number;
    promptVersion?: string;
    inputChars?: number;
    injectionFlags?: string[];
    usedFallback?: boolean;
    classification?: AiClassification | null;
  };
  finalOutcome: 'APPROVED' | 'DENIED' | null;
  adminNote: string;
  reviewedBy: unknown;
  reviewedByName: string;
  reviewedAt: Date | null;
  readMarks?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

function id(value: unknown): string {
  return String(value);
}

function toPolicyOrder(order: LeanOrder): PolicyOrder {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    placedAt: new Date(order.placedAt),
    deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
    items: order.items.map((item) => ({
      name: item.name,
      category: item.category,
      unitAmountCents: item.unitAmountCents,
      quantity: item.quantity,
      finalSale: item.finalSale,
    })),
  };
}

async function loadOwnedOrder(customerId: string, orderNumber: string): Promise<LeanOrder> {
  const order = (await OrderModel.findOne({
    orderNumber: orderNumber.trim().toUpperCase(),
    customerId,
  }).lean()) as LeanOrder | null;

  if (!order) {
    throw new AppError(
      404,
      `No order ${orderNumber} was found on your account. Check the order number and try again.`,
      errorCodes.NOT_FOUND,
    );
  }

  return order;
}

async function buildPolicyContext(
  order: LeanOrder,
  input: { reason: RefundReason; requestedCents: number; customerMessage: string; claimedItemNames: string[] },
  customerId: string,
  excludeRequestId?: string,
): Promise<PolicyContext> {
  const [user, orderCount, priorRefundCount, priorRequestsOnOrder] = await Promise.all([
    UserModel.findById(customerId).lean(),
    OrderModel.countDocuments({ customerId }),
    RefundRequestModel.countDocuments({
      customerId,
      decision: 'APPROVED',
      ...(excludeRequestId ? { _id: { $ne: excludeRequestId } } : {}),
    }),
    RefundRequestModel.countDocuments({
      orderId: order._id,
      ...(excludeRequestId ? { _id: { $ne: excludeRequestId } } : {}),
    }),
  ]);

  const createdAt = user?.createdAt ? new Date(user.createdAt).getTime() : Date.now();

  return {
    order: toPolicyOrder(order),
    request: {
      reason: input.reason,
      requestedCents: input.requestedCents,
      customerMessage: input.customerMessage.slice(0, MAX_REASON_LENGTH),
      claimedItemNames: input.claimedItemNames.slice(0, 12),
    },
    customer: {
      id: customerId,
      email: user?.email ?? '',
      accountAgeDays: Math.max(0, Math.floor((Date.now() - createdAt) / MS_PER_DAY)),
      orderCount,
      priorRefundCount,
    },
    priorRequestsOnOrder,
    now: new Date(),
  };
}

function decisionStatus(request: LeanRefundRequest): 'COMPLETED' | 'AWAITING_REVIEW' | 'RESOLVED' {
  if (request.decision !== 'ESCALATED') return 'COMPLETED';
  return request.finalOutcome ? 'RESOLVED' : 'AWAITING_REVIEW';
}

interface MessagePreview {
  author: string;
  authorName?: string;
  body: string;
  createdAt: Date;
}

export function toRefundRequestDto(
  request: LeanRefundRequest,
  extras: {
    order?: LeanOrder;
    messages?: MessagePreview[];
    /** Newest message in the thread, so a list can show what changed. */
    lastMessage?: MessagePreview | null;
    /** Messages from the other side that this viewer has not opened yet. */
    unreadCount?: number;
  } = {},
): Record<string, unknown> {
  return {
    id: id(request._id),
    reference: request.reference,
    orderId: id(request.orderId),
    orderNumber: request.orderNumber,
    order: extras.order
      ? {
          orderNumber: extras.order.orderNumber,
          status: extras.order.status,
          placedAt: extras.order.placedAt,
          deliveredAt: extras.order.deliveredAt,
          currency: extras.order.currency,
          totalCents: extras.order.totalCents,
          items: extras.order.items,
        }
      : null,
    reason: request.reason,
    requestedCents: request.requestedCents,
    approvedCents: request.approvedCents,
    requestedAmount: formatCents(request.requestedCents, request.currency),
    approvedAmount: formatCents(request.approvedCents, request.currency),
    currency: request.currency,
    decision: request.decision,
    status: decisionStatus(request),
    decisionReason: request.decisionReason,
    flags: request.flags,
    /** Staff-only convenience field; the customer can already read it from /auth/me. */
    customerEmail: request.customerEmail,
    policyVersion: request.policyVersion,
    ruleTrace: request.ruleTrace,
    aiReply: request.aiReply,
    aiMeta: {
      provider: request.aiMeta?.provider ?? 'none',
      model: request.aiMeta?.model ?? 'none',
      latencyMs: request.aiMeta?.latencyMs ?? 0,
      promptVersion: request.aiMeta?.promptVersion ?? '',
      usedFallback: request.aiMeta?.usedFallback ?? true,
      injectionFlags: request.aiMeta?.injectionFlags ?? [],
      classification: request.aiMeta?.classification ?? null,
    },
    finalOutcome: request.finalOutcome,
    adminNote: request.adminNote,
    reviewedBy: request.reviewedBy ? id(request.reviewedBy) : null,
    reviewedByName: request.reviewedByName,
    reviewedAt: request.reviewedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    messages: (extras.messages ?? []).map((message) => ({
      author: message.author,
      authorName: message.authorName ?? '',
      body: message.body,
      createdAt: message.createdAt,
    })),
    lastMessage: extras.lastMessage
      ? {
          author: extras.lastMessage.author,
          authorName: extras.lastMessage.authorName ?? '',
          body: extras.lastMessage.body,
          createdAt: extras.lastMessage.createdAt,
        }
      : null,
    unreadCount: extras.unreadCount ?? 0,
  };
}

export async function listOrdersForCustomer(customerId: string) {
  const orders = (await OrderModel.find({ customerId }).sort({ placedAt: -1 }).lean()) as unknown as LeanOrder[];
  return orders.map((order) => ({
    id: id(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    deliveredAt: order.deliveredAt,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    total: formatCents(order.totalCents, order.currency),
    refundedCents: order.refundedCents,
    refunded: formatCents(order.refundedCents, order.currency),
    items: order.items,
  }));
}

export async function createRefundRequest(input: CreateRefundInput) {
  const order = await loadOwnedOrder(input.customerId, input.orderNumber);
  const ctx = await buildPolicyContext(order, input, input.customerId);
  const decision = evaluateRefundPolicy(ctx);
  const customer = await UserModel.findById(input.customerId).select('fullName').lean();

  const sanitized = sanitizeUntrustedText(input.customerMessage);

  const request = (await RefundRequestModel.create({
    reference: `RF-${nanoid(8).toUpperCase()}`,
    customerId: input.customerId,
    customerEmail: ctx.customer.email,
    orderId: order._id,
    orderNumber: order.orderNumber,
    reason: input.reason,
    requestedCents: input.requestedCents,
    approvedCents: decision.approvedCents,
    eligibleCents: decision.eligibleCents,
    currency: order.currency,
    customerMessage: sanitized.text,
    claimedItemNames: input.claimedItemNames.slice(0, 12),
    decision: decision.decision,
    decisionReason: decision.reason,
    flags: decision.flags,
    ruleTrace: decision.trace,
    policyVersion: decision.policyVersion,
    aiReply: '',
    aiMeta: buildAiAudit({}),
  })) as unknown as LeanRefundRequest;

  // The assistant reply is generated in the browser and posted back through
  // appendAssistantMessage, so nothing is written here.
  const messages = await RefundMessageModel.create([
    { requestId: request._id, author: 'CUSTOMER', authorName: customer?.fullName ?? '', body: sanitized.text || '(no description provided)' },
    {
      requestId: request._id,
      author: 'SYSTEM',
      body: `Decision: ${decision.decision} (${decision.reason})`,
      metadata: sanitized.flags.length > 0 ? { injectionFlags: sanitized.flags } : null,
    },
  ]);

  if (decision.decision === 'APPROVED' && decision.approvedCents > 0) {
    order.refundedCents = Math.min(order.subtotalCents, order.refundedCents + decision.approvedCents);
    if (order.refundedCents >= order.subtotalCents) order.status = 'RETURNED';
    await OrderModel.updateOne({ _id: order._id }, { $set: { refundedCents: order.refundedCents, status: order.status } });
  }

  const leanMessages = messages.map((message) => ({
    author: String(message.author),
    authorName: message.authorName ?? '',
    body: message.body,
    createdAt: new Date(message.createdAt as Date),
  }));

  return toRefundRequestDto(request, { order, messages: leanMessages });
}

async function loadRequest(
  requestId: string,
  extra: { customerId?: string; decision?: string } = {},
): Promise<LeanRefundRequest> {
  const objectId = toObjectId(requestId);
  if (!objectId) {
    throw new AppError(404, 'Refund request not found', errorCodes.NOT_FOUND);
  }

  const filter: FilterQuery<unknown> = { _id: objectId };
  if (extra.customerId) {
    const customerObjectId = toObjectId(extra.customerId);
    if (!customerObjectId) {
      throw new AppError(401, 'Invalid session identity', errorCodes.UNAUTHORIZED);
    }
    filter.customerId = customerObjectId;
  }
  if (extra.decision) {
    filter.decision = extra.decision;
  }

  const request = (await RefundRequestModel.findOne(filter).lean()) as LeanRefundRequest | null;
  if (!request) {
    throw new AppError(404, 'Refund request not found', errorCodes.NOT_FOUND);
  }
  return request;
}

export async function getRefundRequest(
  requestId: string,
  customerId?: string,
  viewer?: { id: string; role: 'CUSTOMER' | 'ADMIN' },
) {
  const request = await loadRequest(requestId, { customerId });
  const [order, messages] = await Promise.all([
    OrderModel.findById(request.orderId).lean() as unknown as Promise<LeanOrder | null>,
    RefundMessageModel.find({ requestId: request._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const thread: MessagePreview[] = messages.map((message) => ({
    author: String(message.author),
    authorName: message.authorName ?? '',
    body: message.body,
    createdAt: new Date(message.createdAt as Date),
  }));
  // A customer reading their own case is the viewer by definition. Staff pass
  // themselves explicitly, because they may read a case they do not own.
  const viewerId = viewer?.id ?? customerId;
  const viewerRole = viewer?.role ?? (customerId ? 'CUSTOMER' : undefined);
  return toRefundRequestDto(request, {
    order: order ?? undefined,
    messages: thread,
    lastMessage: pickPreview(thread),
    unreadCount: countUnread(thread, request, viewerId, viewerRole),
  });
}

/** Roles that count as "the other side" for a given viewer. */
function ownAuthor(role: 'CUSTOMER' | 'ADMIN'): string {
  return role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
}

/**
 * Messages the viewer has not opened yet: anything from the other side, newer
 * than their read mark. Your own messages never count as unread to you, and
 * neither do SYSTEM records, which are machine-generated decision log lines
 * rather than turns anyone is waiting on.
 *
 * Shared by the list and the detail getters so a single request reports the
 * same count whichever endpoint the UI happened to call.
 */
function countUnread(
  thread: MessagePreview[],
  request: { readMarks?: Record<string, string> },
  viewerId?: string,
  viewerRole?: 'CUSTOMER' | 'ADMIN',
): number {
  if (!viewerId || !viewerRole) return 0;
  const mine = ownAuthor(viewerRole);
  const readMark = request.readMarks?.[viewerId];
  const readAt = readMark ? new Date(readMark).getTime() : 0;
  return thread.filter(
    (message) =>
      message.author !== mine && message.author !== 'SYSTEM' && message.createdAt.getTime() > readAt,
  ).length;
}

/**
 * Newest message worth previewing. SYSTEM decision lines are skipped because the
 * list already shows the decision and its reason on the card, so surfacing the
 * raw log line again is noise. Falls back to the true newest if a thread has
 * nothing but system records.
 */
function pickPreview(thread: MessagePreview[]): MessagePreview | null {
  if (!thread.length) return null;
  for (let index = thread.length - 1; index >= 0; index -= 1) {
    const message = thread[index];
    if (message && message.author !== 'SYSTEM') return message;
  }
  return thread[thread.length - 1] ?? null;
}

export async function listRefundRequests(options: {
  customerId?: string;
  decision?: string;
  limit?: number;
  viewerId?: string;
  viewerRole?: 'CUSTOMER' | 'ADMIN';
}) {
  const customerObjectId = options.customerId ? toObjectId(options.customerId) : null;
  if (options.customerId && !customerObjectId) {
    throw new AppError(401, 'Invalid session identity', errorCodes.UNAUTHORIZED);
  }

  const filter: FilterQuery<unknown> = {};
  // Aggregate does not go through schema casting, so the ObjectId must be explicit.
  if (customerObjectId) filter.customerId = customerObjectId;
  if (options.decision) filter.decision = options.decision;

  const requests = (await RefundRequestModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(options.limit ?? 50, 200))
    .lean()) as unknown as LeanRefundRequest[];

  const counts = await RefundRequestModel.aggregate<{ _id: string; count: number }>([
    { $match: customerObjectId ? { customerId: customerObjectId } : {} },
    { $group: { _id: '$decision', count: { $sum: 1 } } },
  ]);

  // One extra round trip feeds both the preview line and the unread badge.
  const requestIds = requests.map((request) => id(request._id));
  const threadMessages = requestIds.length
    ? await RefundMessageModel.find({ requestId: { $in: requestIds } })
        .sort({ createdAt: 1 })
        .select('requestId author authorName body createdAt')
        .lean()
    : [];

  const byRequest = new Map<string, MessagePreview[]>();
  for (const message of threadMessages) {
    const key = id(message.requestId);
    const list = byRequest.get(key);
    const preview: MessagePreview = {
      author: String(message.author),
      authorName: message.authorName ?? '',
      body: message.body,
      createdAt: new Date(message.createdAt as Date),
    };
    if (list) list.push(preview);
    else byRequest.set(key, [preview]);
  }

  return {
    summary: {
      total: counts.reduce((sum, entry) => sum + entry.count, 0),
      approved: counts.find((entry) => entry._id === 'APPROVED')?.count ?? 0,
      denied: counts.find((entry) => entry._id === 'DENIED')?.count ?? 0,
      escalated: counts.find((entry) => entry._id === 'ESCALATED')?.count ?? 0,
    },
    requests: requests.map((request) => {
      const thread = byRequest.get(id(request._id)) ?? [];
      return toRefundRequestDto(request, {
        lastMessage: pickPreview(thread),
        unreadCount: countUnread(thread, request, options.viewerId, options.viewerRole),
      });
    }),
  };
}

/**
 * Records that a viewer has opened the thread, which clears their unread badge.
 * The marker only moves forward so a slow request cannot un-read a thread.
 */
export async function markRequestSeen(input: { requestId: string; userId: string; role: 'CUSTOMER' | 'ADMIN' }) {
  const request = await loadRequest(input.requestId);
  if (input.role === 'CUSTOMER' && id(request.customerId) !== input.userId) {
    throw new AppError(404, 'Refund request not found', errorCodes.NOT_FOUND);
  }
  const now = new Date();
  const previous = request.readMarks?.[input.userId];
  if (previous && new Date(previous).getTime() >= now.getTime()) return;

  await RefundRequestModel.updateOne(
    { _id: request._id },
    { $set: { [`readMarks.${input.userId}`]: now.toISOString() } },
  );
}

export async function appendMessage(input: AppendMessageInput) {
  const request = await loadRequest(input.requestId);
  const isCustomer = input.author === 'CUSTOMER';
  if (isCustomer && id(request.customerId) !== input.authorId) {
    throw new AppError(404, 'Refund request not found', errorCodes.NOT_FOUND);
  }

  const sanitized = sanitizeUntrustedText(input.body);
  // Whoever replies should be shown by name on the other side. Callers that
  // already hold the session may pass it; the socket path does not, so resolve
  // it here to keep both routes identical.
  let authorName = (input.authorName ?? '').trim().slice(0, 120);
  if (!authorName && (input.author === 'ADMIN' || input.author === 'CUSTOMER')) {
    const sender = await UserModel.findById(input.authorId).select('fullName').lean();
    authorName = sender?.fullName ?? '';
  }
  const created = await RefundMessageModel.create({
    requestId: request._id,
    author: input.author,
    authorName,
    body: sanitized.text,
  });

  return {
    message: {
      author: input.author,
      authorName,
      body: sanitized.text,
      createdAt: new Date(created.createdAt as Date),
    },
    aiReply: null,
  };
}

/**
 * Stores a reply that the assistant produced in the browser. The UI has already
 * rendered it by the time this runs, so this is pure persistence plus audit
 * metadata. No text is generated or altered here beyond length clamping.
 */
export async function appendAssistantMessage(input: AppendAssistantMessageInput) {
  const request = await loadRequest(input.requestId);
  const isCustomer = id(request.customerId) === input.authorId;
  if (!isCustomer) {
    throw new AppError(404, 'Refund request not found', errorCodes.NOT_FOUND);
  }

  const body = clampAssistantReply(input.body);
  if (!body) {
    throw new AppError(422, 'Assistant reply was empty', errorCodes.VALIDATION_ERROR);
  }

  const audit = buildAiAudit(input.meta ?? {});

  const created = await RefundMessageModel.create({
    requestId: request._id,
    author: 'AI',
    body,
    metadata: { model: audit.model, latencyMs: audit.latencyMs, promptVersion: audit.promptVersion },
  });

  await RefundRequestModel.updateOne(
    { _id: request._id },
    { $set: { aiReply: body.slice(0, 2_000), aiMeta: audit } },
  );

  return {
    message: { author: 'AI' as const, authorName: '', body, createdAt: new Date(created.createdAt as Date) },
    aiMeta: audit satisfies AiAudit,
  };
}

export async function resolveEscalatedRequest(input: {
  requestId: string;
  adminId: string;
  outcome: 'APPROVED' | 'DENIED';
  note: string;
}) {
  const request = await loadRequest(input.requestId, { decision: 'ESCALATED' });
  if (request.finalOutcome) {
    throw new AppError(409, 'This request has already been reviewed', errorCodes.CONFLICT);
  }

  const approvedCents = input.outcome === 'APPROVED' ? request.requestedCents : 0;
  const reviewer = await UserModel.findById(input.adminId).select('fullName').lean();

  const updated = (await RefundRequestModel.findByIdAndUpdate(
    request._id,
    {
      $set: {
        finalOutcome: input.outcome,
        approvedCents,
        adminNote: input.note.slice(0, 1_000),
        reviewedBy: input.adminId,
        reviewedByName: reviewer?.fullName ?? '',
        reviewedAt: new Date(),
      },
    },
    { new: true },
  ).lean()) as unknown as LeanRefundRequest;

  await RefundMessageModel.create({
    requestId: request._id,
    author: 'ADMIN',
    authorName: reviewer?.fullName ?? '',
    body: `Reviewed by support: ${input.outcome}. ${input.note}`.trim(),
  });

  if (input.outcome === 'APPROVED' && approvedCents > 0) {
    await OrderModel.updateOne(
      { _id: request.orderId },
      { $inc: { refundedCents: approvedCents } },
    );
  }

  return toRefundRequestDto(updated);
}

export function policySummary() {
  return {
    policyVersion: POLICY_VERSION,
    returnWindowDays: RETURN_WINDOW_DAYS,
    humanReviewThresholdCents: HUMAN_REVIEW_THRESHOLD_CENTS,
    humanReviewThreshold: formatCents(HUMAN_REVIEW_THRESHOLD_CENTS),
    rules: [
      { id: 'R1', title: 'Order already refunded', effect: 'DENY', reference: 'policy/2.1' },
      { id: 'R2', title: 'Order cancelled or already returned', effect: 'DENY', reference: 'policy/2.2' },
      { id: 'R3', title: `Older than ${RETURN_WINDOW_DAYS} days`, effect: 'DENY', reference: 'policy/2.3' },
      { id: 'R4', title: 'Refund amount must be greater than zero', effect: 'DENY', reference: 'policy/2.4' },
      { id: 'R5', title: 'Claimed items not present on the order', effect: 'ESCALATE', reference: 'policy/3.2' },
      { id: 'R6', title: 'All claimed items are final sale', effect: 'DENY', reference: 'policy/2.5' },
      { id: 'R7', title: 'Final sale value excluded from refund', effect: 'ADJUST', reference: 'policy/2.5' },
      { id: 'R8', title: 'Refund capped at eligible item value', effect: 'ADJUST', reference: 'policy/2.6' },
      { id: 'R10', title: 'Repeated requests on the same order', effect: 'ESCALATE', reference: 'policy/4.1' },
      { id: 'R11', title: 'Policy-bypass language detected', effect: 'ESCALATE', reference: 'policy/5.1' },
      { id: 'R12', title: 'Above automatic approval limit', effect: 'ESCALATE', reference: 'policy/3.1' },
      { id: 'R13', title: 'High refund volume on the account', effect: 'ESCALATE', reference: 'policy/4.2' },
      { id: 'R14', title: 'High value request from a new account', effect: 'ESCALATE', reference: 'policy/4.3' },
    ],
  };
}
