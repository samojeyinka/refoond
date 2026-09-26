import type { HTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading', className, ...props }: SpinnerProps) {
  const sizes = { sm: 'size-4', md: 'size-6', lg: 'size-8' };

  return (
    <span {...props} role="status" aria-label={label} className={cn('inline-flex items-center gap-2', className)}>
      <LoaderCircle className={cn('animate-spin text-brand-600 dark:text-brand-400', sizes[size])} aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
