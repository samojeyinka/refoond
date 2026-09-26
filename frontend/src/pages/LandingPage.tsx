import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  ChevronRight,
  FileSearch,
  MessageSquare,
  Moon,
  Scale,
  ShieldCheck,
  Sun,
  Timer,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAsyncData } from '../hooks/useAsyncData';
import * as refundsApi from '../api/refunds';

const CATEGORIES = ['All', 'Auto Approval', 'Human Handoff', 'Audit Trail'];

const HIGHLIGHTS = [
  {
    tag: 'CONSISTENT',
    icon: Scale,
    title: 'The same answer every time',
    body: 'A fixed set of rules decides every refund. Gemini writes the explanation, but it never changes the outcome.',
  },
  {
    tag: 'AUDITABLE',
    icon: FileSearch,
    title: 'Every decision is auditable',
    body: 'Each request stores the full reasoning, the rules version, and the AI metadata so reviewers see exact justification.',
  },
  {
    tag: 'AI ASSISTED',
    icon: Bot,
    title: 'Replies that follow the rules',
    body: 'The assistant drafts customer explanations based strictly on rule outcomes while treating input text as untrusted data.',
  },
  {
    tag: 'SECURITY',
    icon: ShieldCheck,
    title: 'Prompt-injection aware',
    body: 'Policy-bypass attempts are flagged server-side and automatically routed to human staff for manual review.',
  },
  {
    tag: 'AUTOMATION',
    icon: Timer,
    title: 'Instant for eligible cases',
    body: 'Routine refunds below the review threshold settle in seconds. High-value or flagged requests escalate automatically.',
  },
  {
    tag: 'HANDOFF',
    icon: MessageSquare,
    title: 'Live human collaboration',
    body: 'Every request includes a real-time messaging thread where support staff review the same reasoning the customer saw.',
  },
];

export default function LandingPage() {
  const { dark, toggleTheme } = useTheme();
  const { me, isAdmin } = useAuth();
  const policy = useAsyncData(() => refundsApi.getPolicy(), []);
  const [activeCategory, setActiveCategory] = useState('All');

  // Signed-in visitors keep the landing page, so the primary action becomes a
  // link into the surface they actually work in.
  const dashboardPath = isAdmin ? '/admin' : '/orders';

  const filteredHighlights = HIGHLIGHTS.filter((item) => {
    return (
      activeCategory === 'All' ||
      (activeCategory === 'Auto Approval' && item.tag === 'AUTOMATION') ||
      (activeCategory === 'Human Handoff' && item.tag === 'HANDOFF') ||
      (activeCategory === 'Audit Trail' && item.tag === 'AUDITABLE')
    );
  });


  return (
    <div className="min-h-dvh bg-[#fcfcfd] text-zinc-950 dark:bg-[#09090b] dark:text-zinc-50">
      {/* Header Navigation */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-[#fcfcfd]/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090b]/90">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center">
            <span className="font-brand text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              refoond
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {me ? (
              <Link to={dashboardPath}>
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex">
                  <Button variant="secondary" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
          <h1 className="font-brand mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-zinc-950 sm:text-6xl dark:text-zinc-50">
            Build AI Refund Systems <br className="hidden sm:inline" />
            For Your Business
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            Automate customer support refund decisions with a fixed set of refund rules.
            AI classifies and explains outcomes without changing the outcome.
          </p>

          {/* Stats Bar */}
          {policy.data ? (
            <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Return Window', value: `${policy.data.returnWindowDays} Days` },
                { label: 'Auto-Approved Limit', value: policy.data.humanReviewThreshold },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-zinc-200/80 bg-white p-5 text-left shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="font-brand mt-1 text-2xl font-extrabold text-zinc-950 dark:text-zinc-50">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Filter Pills Navigation */}
        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {CATEGORIES.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section id="features-grid" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHighlights.map(({ tag, icon: Icon, title, body }) => (
              <div
                key={title}
                className="group flex flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/60"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                      <Icon className="size-5" />
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {tag}
                    </span>
                  </div>

                  <h3 className="font-brand mt-5 text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
                </div>

                <div className="mt-6 pt-4">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950 hover:underline dark:text-zinc-100"
                  >
                    Learn more <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Banner */}
          <div className="mt-16 rounded-3xl border border-zinc-900 bg-zinc-950 p-8 text-white sm:p-12 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-brand text-2xl font-bold tracking-tight sm:text-3xl text-white">
                  Ready to test refoond?
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Log in with pre-seeded demo accounts or create a new customer account instantly.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {me ? (
                  <Link to={dashboardPath}>
                    <Button size="lg" className="border-white bg-white text-zinc-950 hover:bg-zinc-200">
                      Go to dashboard <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup">
                      <Button size="lg" className="border-white bg-white text-zinc-950 hover:bg-zinc-200">
                        Start a request <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button size="lg" variant="secondary" className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700">
                        Sign in to demo
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/80 py-8 dark:border-zinc-800/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Link to="/" className="font-brand text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            refoond
          </Link>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            refoond · human-centered refund management.
          </p>
        </div>
      </footer>
    </div>
  );
}
