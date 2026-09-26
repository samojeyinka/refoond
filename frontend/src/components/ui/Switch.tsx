import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({ checked, onChange, label, description, disabled, 'aria-label': ariaLabel }: SwitchProps) {
  const accessibleLabel = ariaLabel ?? label;
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      {label || description ? (
        <span>
          {label ? <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span> : null}
          {description ? <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</span> : null}
        </span>
      ) : <span />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={accessibleLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-offset-zinc-950',
          checked ? 'border-brand-600 bg-brand-600' : 'border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
