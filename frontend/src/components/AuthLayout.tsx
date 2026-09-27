import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, Moon, Scale, ShieldCheck, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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
  const { dark, toggleTheme } = useTheme();
  const { me, isAdmin } = useAuth();
  const dashboardPath = isAdmin ? '/admin' : '/orders';

  return (
    <div className="auth-page min-h-dvh bg-[#f4f0e8] text-[#1d241f] dark:bg-[#111713] dark:text-[#f5f1e9]">
      <header className="auth-enter relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-9 lg:px-14">
        <Link to="/" className="font-brand text-2xl font-black tracking-[-0.09em]">
          refoond<span className="text-[#e86438]">.</span>
        </Link>
        <div className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.16em] md:flex">
          <Link to="/#how-it-works" className="transition hover:text-[#e86438]">How it works</Link>
          <Link to="/#why-refoond" className="transition hover:text-[#e86438]">Why refoond</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-full border border-[#1d241f]/15 dark:border-white/15">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {me ? (
            <Link to={dashboardPath}><Button size="sm" className="rounded-full bg-[#1d241f] px-5 text-white hover:bg-[#e86438] dark:bg-[#f5f1e9] dark:text-[#1d241f]">Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm" className="rounded-full">Sign in</Button></Link>
              <Link to="/signup"><Button size="sm" className="rounded-full bg-[#1d241f] px-5 text-white hover:bg-[#e86438] dark:bg-[#f5f1e9] dark:text-[#1d241f]">Get started</Button></Link>
            </>
          )}
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-76px)] lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section
        className="auth-panel-enter relative hidden overflow-hidden bg-[#1d241f] p-10 text-white lg:flex lg:flex-col lg:justify-between"
        aria-label="refoond introduction"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center opacity-25 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1d241f]/45 via-[#1d241f]/75 to-[#1d241f]" />
        <p className="relative text-[11px] font-extrabold uppercase tracking-[.2em] text-[#efa484]">The calmer way to handle returns</p>
        <div className="relative max-w-md">
          <h2 className="font-brand text-5xl font-black leading-[.9] tracking-[-.06em]">
            A decision<br />you can <i className="font-serif font-normal">stand</i><br />behind.
          </h2>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title: pointTitle, description: pointDescription }) => (
              <li key={pointTitle} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">{pointTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-[#c4c9c3]">{pointDescription}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#9ca69d]">refoond · customer support refund system.</p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <header className="auth-enter auth-enter-delay-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#e86438]">Welcome to refoond</p>
            <h1 className="font-brand mt-3 text-4xl font-black tracking-[-.055em] text-[#1d241f] dark:text-white">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#657068] dark:text-[#c4c9c3]">{description}</p>
          </header>
          <div className="auth-enter auth-enter-delay-2 mt-8">{children}</div>
          {footer ? <div className="auth-enter auth-enter-delay-3 mt-7 text-center text-sm text-[#657068] dark:text-[#c4c9c3]">{footer}</div> : null}
        </div>
      </section>
      </main>
    </div>
  );
}
