import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry: () => void;
}

export function ErrorState({ title = 'Could not load this section', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
      <AlertCircle className="size-8 text-red-600 dark:text-red-400" aria-hidden="true" />
      <h3 className="mt-4 text-sm font-semibold text-red-950 dark:text-red-100">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-red-700 dark:text-red-300">{message}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
