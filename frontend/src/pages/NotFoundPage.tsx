import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-white px-5 text-center dark:bg-zinc-950">
      <div className="flex size-12 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 dark:border-zinc-800">
        <Compass className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          That page does not exist. Your orders and refund requests are one click away.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link to="/">
          <Button variant="secondary">Go home</Button>
        </Link>
        <Link to="/refunds">
          <Button>My refunds</Button>
        </Link>
      </div>
    </main>
  );
}
