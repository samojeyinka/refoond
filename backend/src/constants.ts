export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CONVERSATION_STATUSES = ['NEW', 'OPEN', 'PENDING', 'RESOLVED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CONVERSATION_CHANNELS = ['widget', 'api', 'email'] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export const CONVERSATION_MODES = ['ai', 'human'] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export const SENDER_TYPES = ['customer', 'agent', 'ai', 'system'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const MESSAGE_TYPES = ['text', 'note', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const AGENT_PREFERENCES = ['any', 'female', 'male'] as const;
export type AgentPreference = (typeof AGENT_PREFERENCES)[number];

export const ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REFUND_REASONS = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'NOT_DELIVERED',
  'LATE_DELIVERY',
  'CHANGED_MIND',
  'OTHER',
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const REFUND_DECISIONS = ['APPROVED', 'DENIED', 'ESCALATED'] as const;
export type RefundDecision = (typeof REFUND_DECISIONS)[number];

export const REFUND_RULE_OUTCOMES = ['PASS', 'FAIL', 'ADJUST', 'INFO'] as const;
export type RefundRuleOutcome = (typeof REFUND_RULE_OUTCOMES)[number];

export const REFUND_MESSAGE_AUTHORS = ['CUSTOMER', 'AI', 'ADMIN', 'SYSTEM'] as const;
export type RefundMessageAuthor = (typeof REFUND_MESSAGE_AUTHORS)[number];

export const REFUND_FLAGS = [
  'HIGH_VALUE',
  'INJECTION_ATTEMPT',
  'CONFLICTING_CLAIM',
  'DUPLICATE_REQUEST',
  'NEW_ACCOUNT',
  'REPEAT_REFUNDER',
  'FINAL_SALE_EXCLUDED',
  'AMOUNT_REDUCED',
  'AMOUNT_ABOVE_ORDER',
] as const;
export type RefundFlag = (typeof REFUND_FLAGS)[number];

export const KNOWLEDGE_STATUSES = ['created', 'processing', 'ready', 'failed'] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const AUTOMATION_TRIGGERS = [
  'conversation.created',
  'message.received',
  'conversation.assigned',
  'conversation.resolved',
  'customer.created',
  'tag.added',
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTIONS = [
  'add_tag',
  'remove_tag',
  'assign_team',
  'assign_agent',
  'change_status',
  'send_message',
  'notify_agents',
  'trigger_webhook',
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number];

export const WEBHOOK_EVENTS = [
  'conversation.created',
  'conversation.updated',
  'conversation.resolved',
  'message.created',
  'customer.created',
  'automation.triggered',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const CUSTOMER_EVENT_TYPES = [
  'customer.created',
  'conversation.started',
  'message.sent',
  'agent.assigned',
  'tag.added',
  'conversation.resolved',
  'rating.submitted',
  'custom',
] as const;
export type CustomerEventType = (typeof CUSTOMER_EVENT_TYPES)[number];

export const DEFAULT_TEAM = 'Default';