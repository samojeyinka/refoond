export type Role = 'CUSTOMER' | 'ADMIN';
export type RefundDecision = 'APPROVED' | 'DENIED' | 'ESCALATED';
export type RefundStatus = 'AWAITING_REVIEW' | 'COMPLETED' | 'RESOLVED';
export type RefundRuleOutcome = 'PASS' | 'FAIL' | 'ADJUST' | 'INFO';
export type RefundMessageAuthor = 'CUSTOMER' | 'AI' | 'ADMIN' | 'SYSTEM';

export type RefundReason =
  | 'DAMAGED'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'NOT_DELIVERED'
  | 'LATE_DELIVERY'
  | 'CHANGED_MIND';

export const REFUND_REASONS: ReadonlyArray<{ value: RefundReason; label: string }> = [
  { value: 'DAMAGED', label: 'Item arrived damaged' },
  { value: 'WRONG_ITEM', label: 'Wrong item sent' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'NOT_DELIVERED', label: 'Never arrived' },
  { value: 'LATE_DELIVERY', label: 'Arrived too late' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
];

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface OrderItem {
  name: string;
  sku: string;
  category: string;
  unitAmountCents: number;
  quantity: number;
  finalSale: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  total: string;
  refundedCents: number;
  refunded: string;
  couponCode?: string;
  placedAt: string;
  deliveredAt: string | null;
  items: OrderItem[];
}

export interface RuleTraceEntry {
  ruleId: string;
  title: string;
  outcome: RefundRuleOutcome;
  detail: string;
  policyRef: string;
}

export interface AiClassification {
  intent: string;
  detectedReason: RefundReason | 'UNKNOWN' | null;
  claimedItemNames: string[];
  isDispute: boolean;
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  confidence: number;
  summary: string;
  requestedHuman: boolean;
}

export interface RefundAiMeta {
  provider: string;
  model: string;
  latencyMs: number;
  promptVersion: string;
  usedFallback: boolean;
  injectionFlags: string[];
  classification: AiClassification | null;
}

export interface RefundMessage {
  author: RefundMessageAuthor;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface RefundRequestSummary {
  total: number;
  approved: number;
  denied: number;
  escalated: number;
}

export interface RefundRequest {
  id: string;
  reference: string;
  orderId: string;
  orderNumber: string;
  order: Pick<Order, 'orderNumber' | 'status' | 'placedAt' | 'deliveredAt' | 'currency' | 'totalCents' | 'items'> | null;
  reason: RefundReason;
  requestedCents: number;
  approvedCents: number;
  requestedAmount: string;
  approvedAmount: string;
  currency: string;
  decision: RefundDecision;
  status: RefundStatus;
  decisionReason: string;
  flags: string[];
  policyVersion: string;
  ruleTrace: RuleTraceEntry[];
  aiReply: string;
  aiMeta: RefundAiMeta;
  finalOutcome: 'APPROVED' | 'DENIED' | null;
  adminNote: string;
  reviewedBy: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  customerEmail?: string;
  lastMessage?: RefundMessage | null;
  unreadCount?: number;
  createdAt: string;
  messages?: RefundMessage[];
}

export interface PolicyRule {
  id: string;
  title: string;
  effect: 'DENY' | 'ESCALATE' | 'ADJUST';
  reference: string;
}

export interface PolicySummary {
  policyVersion: string;
  returnWindowDays: number;
  humanReviewThresholdCents: number;
  humanReviewThreshold: string;
  rules: PolicyRule[];
}
