import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Tooltip({ content, children, className }: { content: string; children: ReactNode; className?: string }) {
  const tooltipId = useId();

  return (
    <span className={cn('group relative inline-flex', className)} tabIndex={0} aria-describedby={tooltipId}>
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block group-focus:block dark:bg-zinc-100 dark:text-zinc-950"
      >
        {content}
      </span>
    </span>
  );
}
