import { Check, Info, MinusCircle, X } from 'lucide-react';
import { cn } from '../lib/cn';
import type { RefundRuleOutcome, RuleTraceEntry } from '../api/types';

const OUTCOME_META: Record<
  RefundRuleOutcome,
  { label: string; icon: typeof Check; accent: string; iconClassName: string }
> = {
  PASS: {
    label: 'Passed',
    icon: Check,
    accent: 'border-emerald-500/60',
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  FAIL: {
    label: 'Blocked',
    icon: X,
    accent: 'border-red-500/70',
    iconClassName: 'text-red-600 dark:text-red-400',
  },
  ADJUST: {
    label: 'Adjusted',
    icon: MinusCircle,
    accent: 'border-amber-500/70',
    iconClassName: 'text-amber-600 dark:text-amber-400',
  },
  INFO: {
    label: 'Context',
    icon: Info,
    accent: 'border-zinc-300 dark:border-zinc-700',
    iconClassName: 'text-zinc-400 dark:text-zinc-500',
  },
};


export function RuleTrace({ entries, className }: { entries: RuleTraceEntry[]; className?: string }) {
  if (!entries.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No policy evaluation was recorded.</p>;
  }

  return (
    <ol className={cn('space-y-1.5', className)}>
      {entries.map((entry, index) => {
        const meta = OUTCOME_META[entry.outcome];
        const Icon = meta.icon;
        return (
          <li key={`${entry.title}-${index}`} className={cn('flex gap-2.5 border-l-2 py-0.5 pl-3', meta.accent)}>
            <Icon className={cn('mt-[3px] size-3.5 shrink-0', meta.iconClassName)} aria-label={meta.label} />
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
