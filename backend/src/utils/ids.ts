import { Types } from 'mongoose';

export function isObjectId(value: unknown): boolean {
  return typeof value === 'string' && Types.ObjectId.isValid(value) && new Types.ObjectId(value).toHexString() === value;
}

export function toObjectId(value: string): Types.ObjectId | null {
  return isObjectId(value) ? new Types.ObjectId(value) : null;
}
