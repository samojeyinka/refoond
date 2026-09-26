import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SelectProps<T extends string> {
  value: T | '';
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  placement?: 'top' | 'bottom';
  'aria-label'?: string;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select an option',
  error,
  disabled,
  className,
  buttonClassName,
  placement = 'bottom',
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-option-${activeIndex}`)}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, id, open]);

  const show = (startIndex: number) => {
    setOpen(true);
    setActiveIndex(Math.max(0, Math.min(startIndex, options.length - 1)));
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      show(open ? activeIndex + 1 : Math.max(0, options.findIndex((option) => option.value === value)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      show(open ? activeIndex - 1 : Math.max(0, options.findIndex((option) => option.value === value)));
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      {label ? <span className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={error ? true : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else show(Math.max(0, options.findIndex((option) => option.value === value)));
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-left text-sm text-zinc-950 outline-none transition-colors hover:border-zinc-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:disabled:bg-zinc-900',
          !selected && !value && 'text-zinc-500 dark:text-zinc-400',
          error && 'border-red-500 dark:border-red-500',
          buttonClassName,
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={id}
          className={cn(
            'absolute z-50 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
            placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {options.length === 0 ? <li className="px-3 py-2 text-sm text-zinc-500">No options available</li> : null}
          {options.map((option, index) => (
            <li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm focus:outline-none',
                  index === activeIndex ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-transparent',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{option.label}</span>
                  {option.description ? <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span> : null}
                </span>
                {option.value === value ? <Check className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
