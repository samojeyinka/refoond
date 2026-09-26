import { Badge } from './ui/Badge';
import { cn } from '../lib/cn';
import type { RefundDecision, RefundStatus } from '../api/types';

const DECISION_STYLES: Record<RefundDecision, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
  APPROVED: { label: 'Approved', variant: 'success' },
  DENIED: { label: 'Denied', variant: 'danger' },
  ESCALATED: { label: 'Needs review', variant: 'warning' },
};

const STATUS_STYLES: Record<RefundStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  COMPLETED: { label: 'Completed', variant: 'success' },
  AWAITING_REVIEW: { label: 'Awaiting review', variant: 'warning' },
  RESOLVED: { label: 'Resolved', variant: 'info' },
};

export function DecisionBadge({ decision, className }: { decision: RefundDecision; className?: string }) {
  const style = DECISION_STYLES[decision];
  return (
    <Badge variant={style.variant} className={className}>
      {style.label}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: RefundStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant={style.variant} className={className}>
      {style.label}
    </Badge>
  );
}

export function FlagBadge({ flag, className }: { flag: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        className,
      )}
    >
      {flag.replace(/_/g, ' ')}
    </span>
  );
}
