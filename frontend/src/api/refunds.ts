import { apiRequest } from './client';
import type {
  Order,
  PolicySummary,
  RefundDecision,
  RefundMessage,
  RefundRequest,
  RefundRequestSummary,
  RefundReason,
} from './types';

export function getPolicy(): Promise<PolicySummary> {
  return apiRequest<PolicySummary>('/api/v1/refunds/policy');
}

export function listMyOrders(): Promise<{ orders: Order[] }> {
  return apiRequest<{ orders: Order[] }>('/api/v1/refunds/orders');
}

export function listMyRequests(decision?: RefundDecision): Promise<{
  summary: RefundRequestSummary;
  requests: RefundRequest[];
}> {
  const query = decision ? `?decision=${decision}` : '';
  return apiRequest<{ summary: RefundRequestSummary; requests: RefundRequest[] }>(
    `/api/v1/refunds/requests${query}`,
  );
}

export interface CreateRefundInput {
  orderNumber: string;
  reason: RefundReason;
  requestedAmount: number;
  claimedItemNames: string[];
  message: string;
}

export function createRefundRequest(input: CreateRefundInput): Promise<RefundRequest> {
  return apiRequest<RefundRequest>('/api/v1/refunds/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getRefundRequest(id: string): Promise<RefundRequest> {
  return apiRequest<RefundRequest>(`/api/v1/refunds/requests/${id}`);
}


export function markRequestSeen(id: string): Promise<{ seen: boolean }> {
  return apiRequest(`/api/v1/refunds/requests/${id}/seen`, { method: 'POST' });
}

export function sendRefundMessage(
  id: string,
  body: string,
): Promise<{
  message: RefundMessage;
  aiReply: RefundMessage | null;
  request: RefundRequest;
}> {
  return apiRequest(`/api/v1/refunds/requests/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export interface AssistantMessageMeta {
  model?: string;
  latencyMs?: number;
  classification?: {
    intent?: 'REFUND_REQUEST' | 'STATUS_CHECK' | 'OTHER';
    detectedReason?: RefundReason | 'UNKNOWN';
    claimedItemNames?: string[];
    isDispute?: boolean;
    urgency?: 'LOW' | 'NORMAL' | 'HIGH';
    requestedHuman?: boolean;
    confidence?: number;
    summary?: string;
  } | null;
}


export function saveAssistantMessage(
  id: string,
  body: string,
  meta?: AssistantMessageMeta,
): Promise<{ message: RefundMessage; aiMeta: RefundRequest['aiMeta'] }> {
  return apiRequest(`/api/v1/refunds/requests/${id}/ai-messages`, {
    method: 'POST',
    body: JSON.stringify({ body, meta }),
  });
}

export function listAllRequests(decision?: RefundDecision): Promise<{
  summary: RefundRequestSummary;
  requests: RefundRequest[];
}> {
  const query = decision ? `?decision=${decision}` : '';
  return apiRequest<{ summary: RefundRequestSummary; requests: RefundRequest[] }>(
    `/api/v1/refunds/admin/requests${query}`,
  );
}

export function getAdminRequest(id: string): Promise<RefundRequest> {
  return apiRequest<RefundRequest>(`/api/v1/refunds/admin/requests/${id}`);
}

export function resolveRequest(
  id: string,
  outcome: 'APPROVED' | 'DENIED',
  note: string,
): Promise<RefundRequest> {
  return apiRequest<RefundRequest>(`/api/v1/refunds/admin/requests/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ outcome, note }),
  });
}
