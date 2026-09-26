import { Schema, model, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    lastActiveAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, active: 1 });
sessionSchema.index({ tokenHash: 1 }, { unique: true });

export type Session = InferSchemaType<typeof sessionSchema>;
export const SessionModel = model('Session', sessionSchema);