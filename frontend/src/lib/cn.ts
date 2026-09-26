import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';

export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
