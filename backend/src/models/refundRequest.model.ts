import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  REFUND_DECISIONS,
  REFUND_MESSAGE_AUTHORS,
  REFUND_REASONS,
  REFUND_RULE_OUTCOMES,
} from '../constants';

const ruleTraceSchema = new Schema(
  {
    ruleId: { type: String, required: true },
    title: { type: String, required: true },
    outcome: { type: String, enum: REFUND_RULE_OUTCOMES, required: true },
    detail: { type: String, required: true },
    policyRef: { type: String, required: true },
  },
  { _id: false },
);

const aiMetaSchema = new Schema(
  {
    model: { type: String, default: '' },
    provider: { type: String, default: '' },
    latencyMs: { type: Number, default: 0 },
    promptVersion: { type: String, default: '' },
    inputChars: { type: Number, default: 0 },
    injectionFlags: { type: [String], default: [] },
    usedFallback: { type: Boolean, default: false },
    classification: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const refundRequestSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true, uppercase: true, trim: true },
    reason: { type: String, enum: REFUND_REASONS, required: true },
    requestedCents: { type: Number, required: true, min: 0 },
    approvedCents: { type: Number, default: 0, min: 0 },
    eligibleCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    customerMessage: { type: String, default: '', maxlength: 2000 },
    claimedItemNames: { type: [String], default: [] },
    decision: { type: String, enum: REFUND_DECISIONS, required: true, index: true },
    decisionReason: { type: String, required: true },
    flags: { type: [String], default: [] },
    ruleTrace: { type: [ruleTraceSchema], default: [] },
    policyVersion: { type: String, required: true },
    aiReply: { type: String, default: '' },
    aiMeta: { type: aiMetaSchema, default: () => ({}) },
    finalOutcome: { type: String, enum: ['APPROVED', 'DENIED'], default: null },
    adminNote: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    /**
     * Per-viewer read markers, keyed by user id. Stored as a plain object rather
     * than a Map so lean queries and JSON serialisation stay predictable.
     */
    readMarks: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

refundRequestSchema.index({ customerId: 1, createdAt: -1 });
refundRequestSchema.index({ decision: 1, createdAt: -1 });

export type RefundRequest = InferSchemaType<typeof refundRequestSchema>;
export const RefundRequestModel = model('RefundRequest', refundRequestSchema);

const refundMessageSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'RefundRequest', required: true },
    author: { type: String, enum: REFUND_MESSAGE_AUTHORS, required: true },
    // Display name of whoever wrote it, so an agent reply shows a real person
    // rather than a generic role label.
    authorName: { type: String, default: '', maxlength: 120 },
    body: { type: String, required: true, maxlength: 4000 },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

refundMessageSchema.index({ requestId: 1, createdAt: 1 });

export type RefundMessage = InferSchemaType<typeof refundMessageSchema>;
export const RefundMessageModel = model('RefundMessage', refundMessageSchema);
