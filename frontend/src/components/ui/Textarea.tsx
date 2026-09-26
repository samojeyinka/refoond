import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, error, hint, className, rows = 4, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const description = [error ? errorId : '', hint ? hintId : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label ? <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</label> : null}
      <textarea
        {...props}
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={description}
        className={cn(
          'w-full resize-y rounded-xl border border-zinc-300/80 bg-white px-3.5 py-3 text-sm text-zinc-950 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 dark:disabled:bg-zinc-900',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500',
          className,
        )}

      />
      {hint && !error ? <p id={hintId} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      {error ? <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
});
