import type { RefundDecision, RefundFlag, RefundReason, RefundRuleOutcome } from '../../../constants';
import { formatCents } from '../../../utils/money';
import { detectInjectionAttempts } from '../security/injection';

export const POLICY_VERSION = '2026-02-01';
export const RETURN_WINDOW_DAYS = 30;
export const HUMAN_REVIEW_THRESHOLD_CENTS = 50_000;
export const NEW_ACCOUNT_DAYS = 2;
export const NEW_ACCOUNT_REVIEW_CENTS = 20_000;
export const REPEAT_REFUND_LIMIT = 3;
export const MAX_DUPLICATE_REQUESTS = 1;

const MS_PER_DAY = 86_400_000;

export interface PolicyOrderItem {
  name: string;
  category: string;
  unitAmountCents: number;
  quantity: number;
  finalSale: boolean;
}

export interface PolicyOrder {
  orderNumber: string;
  status: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  refundedCents: number;
  placedAt: Date;
  deliveredAt: Date | null;
  items: PolicyOrderItem[];
}

export interface PolicyRequest {
  reason: RefundReason;
  requestedCents: number;
  customerMessage: string;
  claimedItemNames: string[];
}

export interface PolicyCustomer {
  id: string;
  email: string;
  accountAgeDays: number;
  orderCount: number;
  priorRefundCount: number;
}

export interface PolicyContext {
  order: PolicyOrder;
  request: PolicyRequest;
  customer: PolicyCustomer;
  priorRequestsOnOrder: number;
  now: Date;
}

export interface RuleTrace {
  ruleId: string;
  title: string;
  outcome: RefundRuleOutcome;
  detail: string;
  policyRef: string;
}

export interface PolicyDecision {
  decision: RefundDecision;
  approvedCents: number;
  eligibleCents: number;
  requestedCents: number;
  reason: string;
  flags: RefundFlag[];
  trace: RuleTrace[];
  policyVersion: string;
  evaluatedAt: string;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function itemSubtotalCents(item: PolicyOrderItem): number {
  return item.unitAmountCents * item.quantity;
}

function money(cents: number, currency: string): string {
  return formatCents(cents, currency);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function resolveClaimedItems(order: PolicyOrder, request: PolicyRequest): PolicyOrderItem[] {
  if (request.claimedItemNames.length === 0) return order.items;
  const wanted = request.claimedItemNames.map(normalize);
  return order.items.filter((item) => wanted.includes(normalize(item.name)));
}

export function evaluateRefundPolicy(ctx: PolicyContext): PolicyDecision {
  const { order, request, customer } = ctx;
  const trace: RuleTrace[] = [];
  const flags = new Set<RefundFlag>();
  const record = (entry: RuleTrace): void => {
    trace.push(entry);
  };

  const ageDays = daysBetween(order.deliveredAt ?? order.placedAt, ctx.now);
  const claimedItems = resolveClaimedItems(order, request);
  const claimedMatched = claimedItems.length > 0;
  const eligibleItems = claimedMatched ? claimedItems.filter((item) => !item.finalSale) : [];
  const excludedItems = claimedMatched ? claimedItems.filter((item) => item.finalSale) : [];
  const eligibleCents = eligibleItems.reduce((sum, item) => sum + itemSubtotalCents(item), 0);
  const excludedCents = excludedItems.reduce((sum, item) => sum + itemSubtotalCents(item), 0);

  record({
    ruleId: 'R0',
    title: 'Order and request summary',
    outcome: 'INFO',
    detail: `Order ${order.orderNumber} placed ${order.placedAt.toISOString().slice(0, 10)}, ${ageDays} day(s) since ${
      order.deliveredAt ? 'delivery' : 'order'
    }. Requested ${money(request.requestedCents, order.currency)} of ${money(order.subtotalCents, order.currency)} item value across ${
      claimedMatched ? claimedItems.length : order.items.length
    } line item(s) for reason ${request.reason}.`,
    policyRef: 'policy/v1',
  });

  const terminal = (
    decision: RefundDecision,
    ruleId: string,
    title: string,
    detail: string,
    policyRef: string,
    reason: string,
  ): PolicyDecision => {
    record({ ruleId, title, outcome: 'FAIL', detail, policyRef });
    return {
      decision,
      approvedCents: decision === 'APPROVED' ? eligibleCents : 0,
      eligibleCents,
      requestedCents: request.requestedCents,
      reason,
      flags: [...flags],
      trace,
      policyVersion: POLICY_VERSION,
      evaluatedAt: ctx.now.toISOString(),
    };
  };

  if (order.refundedCents >= order.subtotalCents && order.subtotalCents > 0) {
    return terminal(
      'DENIED',
      'R1',
      'Order already refunded',
      `Order ${order.orderNumber} has already been refunded in full (${money(order.refundedCents, order.currency)}).`,
      'policy/2.1',
      'This order has already been fully refunded, so no further refund can be issued.',
    );
  }

  if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
    return terminal(
      'DENIED',
      'R2',
      'Order not refundable in current state',
      `Order ${order.orderNumber} is in state ${order.status}.`,
      'policy/2.2',
      `This order is already ${order.status.toLowerCase()}, so it cannot be refunded again.`,
    );
  }

  if (ageDays > RETURN_WINDOW_DAYS) {
    return terminal(
      'DENIED',
      'R3',
      'Return window expired',
      `Order is ${ageDays} days old; the return window is ${RETURN_WINDOW_DAYS} days from ${
        order.deliveredAt ? 'delivery' : 'order date'
      }.`,
      'policy/2.3',
      `Our return window is ${RETURN_WINDOW_DAYS} days. This order is ${ageDays} days old, so it is outside the window.`,
    );
  }

  if (request.requestedCents <= 0) {
    return terminal(
      'DENIED',
      'R4',
      'Invalid refund amount',
      'Requested amount must be greater than zero.',
      'policy/2.4',
      'The requested refund amount must be greater than zero.',
    );
  }

  if (!claimedMatched) {
    flags.add('CONFLICTING_CLAIM');
    return terminal(
      'ESCALATED',
      'R5',
      'Claimed items not present on order',
      `Claimed item(s) ${request.claimedItemNames.join(', ')} do not appear on order ${order.orderNumber}.`,
      'policy/3.2',
      'The items you listed are not on this order, so a human reviewer needs to check the details.',
    );
  }

  if (eligibleCents === 0) {
    return terminal(
      'DENIED',
      'R6',
      'Final sale items are not refundable',
      `All claimed line item(s) are marked final sale (${money(excludedCents, order.currency)}).`,
      'policy/2.5',
      'The items on this order are final sale and cannot be refunded.',
    );
  }

  if (excludedCents > 0) {
    flags.add('FINAL_SALE_EXCLUDED');
    record({
      ruleId: 'R7',
      title: 'Final sale items excluded',
      outcome: 'ADJUST',
      detail: `Excluded ${excludedCents === 0 ? 'no' : money(excludedCents, order.currency)} of final sale item value from the refundable amount.`,
      policyRef: 'policy/2.5',
    });
  }

  const cappedCents = Math.min(request.requestedCents, eligibleCents);
  if (cappedCents < request.requestedCents) {
    flags.add('AMOUNT_REDUCED');
    record({
      ruleId: 'R8',
      title: 'Refund capped at eligible item value',
      outcome: 'ADJUST',
      detail: `Requested ${money(request.requestedCents, order.currency)} reduced to ${money(cappedCents, order.currency)} (eligible item value). Shipping and taxes are non-refundable.`,
      policyRef: 'policy/2.6',
    });
  }

  if (request.requestedCents > order.totalCents) {
    flags.add('AMOUNT_ABOVE_ORDER');
  }

  if (request.claimedItemNames.length === 0) {
    record({
      ruleId: 'R9',
      title: 'No specific items claimed',
      outcome: 'INFO',
      detail: 'Customer did not identify specific line items; the whole order was evaluated.',
      policyRef: 'policy/2.2',
    });
  }

  if (ctx.priorRequestsOnOrder > MAX_DUPLICATE_REQUESTS) {
    flags.add('DUPLICATE_REQUEST');
    return terminal(
      'ESCALATED',
      'R10',
      'Repeated refund requests on the same order',
      `There are already ${ctx.priorRequestsOnOrder} prior request(s) for order ${order.orderNumber}.`,
      'policy/4.1',
      'We already have other refund requests open for this order, so a specialist is reviewing it.',
    );
  }

  const injectionFlags = detectInjectionAttempts(request.customerMessage);
  if (injectionFlags.length > 0) {
    flags.add('INJECTION_ATTEMPT');
    return terminal(
      'ESCALATED',
      'R11',
      'Message contained policy-bypass language',
      `Detected: ${injectionFlags.join(', ')}.`,
      'policy/5.1',
      'Your message contained instructions that conflict with our refund policy, so a human reviewer is handling this request.',
    );
  }

  if (cappedCents > HUMAN_REVIEW_THRESHOLD_CENTS) {
    flags.add('HIGH_VALUE');
    return terminal(
      'ESCALATED',
      'R12',
      'Refund above automatic approval limit',
      `Refund of ${money(cappedCents, order.currency)} exceeds the ${money(HUMAN_REVIEW_THRESHOLD_CENTS, order.currency)} automatic approval limit.`,
      'policy/3.1',
      `Refunds above ${money(HUMAN_REVIEW_THRESHOLD_CENTS, order.currency)} need a human approval, and yours has been sent to our team.`,
    );
  }

  if (customer.priorRefundCount >= REPEAT_REFUND_LIMIT) {
    flags.add('REPEAT_REFUNDER');
    return terminal(
      'ESCALATED',
      'R13',
      'High refund volume on the account',
      `Account has ${customer.priorRefundCount} prior refunds (limit ${REPEAT_REFUND_LIMIT}).`,
      'policy/4.2',
      'Your account has several refunds on record, so a specialist is reviewing this request personally.',
    );
  }

  if (customer.accountAgeDays <= NEW_ACCOUNT_DAYS && cappedCents >= NEW_ACCOUNT_REVIEW_CENTS) {
    flags.add('NEW_ACCOUNT');
    return terminal(
      'ESCALATED',
      'R14',
      'High-value request from a new account',
      `Account is ${customer.accountAgeDays} day(s) old and the request is ${money(cappedCents, order.currency)}.`,
      'policy/4.3',
      'Because your account is new and the amount is high, a specialist is confirming this request.',
    );
  }

  record({
    ruleId: 'R15',
    title: 'All policy checks passed',
    outcome: 'PASS',
    detail: `Eligible for ${money(cappedCents, order.currency)}: inside the ${RETURN_WINDOW_DAYS}-day window, ${
      excludedCents > 0
        ? `${money(excludedCents, order.currency)} of final sale value excluded, `
        : 'no final sale items claimed, '
    }below the ${money(HUMAN_REVIEW_THRESHOLD_CENTS, order.currency)} review limit, and no risk signals detected.`,
    policyRef: 'policy/2.2',
  });

  return {
    decision: 'APPROVED',
    approvedCents: cappedCents,
    eligibleCents,
    requestedCents: request.requestedCents,
    reason:
      excludedCents > 0
        ? `Approved for ${money(cappedCents, order.currency)}. Final sale items were excluded from the refundable amount.`
        : `Approved for ${money(cappedCents, order.currency)} under the standard return policy.`,
    flags: [...flags],
    trace,
    policyVersion: POLICY_VERSION,
    evaluatedAt: ctx.now.toISOString(),
  };
}
