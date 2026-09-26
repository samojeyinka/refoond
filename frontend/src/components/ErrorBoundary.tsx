import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Refoond render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center dark:border-red-900 dark:bg-zinc-950">
            <AlertTriangle className="mx-auto size-9 text-red-600 dark:text-red-400" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Refoond hit an unexpected error</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{this.state.error.message}</p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reload
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
