import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, Scale, ShieldCheck } from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

const points = [
  {
    icon: Scale,
    title: 'The rules decide',
    description: 'Approval, denial, and escalation come from a fixed set of rules, never from a model guess.',
  },
  {
    icon: FileSearch,
    title: 'You see the reasoning',
    description: 'Every request lists each rule that fired, so the outcome is never a black box.',
  },
  {
    icon: ShieldCheck,
    title: 'A human is always reachable',
    description: 'High value, unusual, or disputed requests are handed to a reviewer with the full audit trail.',
  },
];

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)] dark:bg-zinc-950">
      <section
        className="hidden border-r border-zinc-800 bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between"
        aria-label="refoond introduction"
      >

        <Link to="/" className="flex items-center gap-3">
          <span className="font-brand text-3xl font-extrabold tracking-tight text-white">refoond</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-brand text-3xl font-extrabold leading-tight tracking-tight">
            The same answer for every customer.
          </h2>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title: pointTitle, description: pointDescription }) => (
              <li key={pointTitle} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">{pointTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{pointDescription}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-zinc-500">refoond · customer support refund system.</p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Link to="/" className="font-brand text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
              refoond
            </Link>
          </div>

          <header>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
          </header>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-7 text-center text-sm text-zinc-500 dark:text-zinc-400">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
