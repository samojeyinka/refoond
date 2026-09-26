import { Schema, model, type InferSchemaType } from 'mongoose';
import { ORDER_STATUSES } from '../constants';

const orderItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sku: { type: String, required: true, trim: true, uppercase: true },
    category: { type: String, required: true, trim: true, default: 'general' },
    unitAmountCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    finalSale: { type: Boolean, default: false },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'PAID' },
    currency: { type: String, default: 'USD' },
    subtotalCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, default: 0, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    refundedCents: { type: Number, default: 0, min: 0 },
    channel: { type: String, default: 'web' },
    couponCode: { type: String, default: '' },
    placedAt: { type: Date, required: true },
    deliveredAt: { type: Date, default: null },
    items: { type: [orderItemSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, placedAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export const OrderModel = model('Order', orderSchema);
