import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: DependencyList) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: null, loading: true });

  useEffect(() => {
    let active = true;
    setState({ data: undefined, error: null, loading: true });
    void loaderRef.current()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) setState({ data: undefined, error: errorMessage(error), loading: false });
      });
    return () => {
      active = false;
    };
  }, [...dependencies, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, reload };
}
