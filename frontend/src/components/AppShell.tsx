import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Package, ReceiptText, Scale, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/cn';

export default function AppShell() {
  const { me, isAdmin, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const links = isAdmin
    ? [{ to: '/admin', label: 'Review queue', icon: Scale }]
    : [
        { to: '/orders', label: 'My orders', icon: Package },
        { to: '/refunds', label: 'My refunds', icon: ReceiptText },
      ];

  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center">
            <span className="font-brand text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
              refoond
            </span>
          </NavLink>

          <nav className="ml-4 flex items-center gap-1.5" aria-label="Main">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>


          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle colour theme">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar name={me?.fullName ?? 'User'} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{me?.fullName}</p>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {isAdmin ? 'Support staff' : 'Customer'}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-200/80 py-4 dark:border-zinc-800/80">
        <p className="mx-auto w-full max-w-7xl px-4 text-xs font-medium text-zinc-500 sm:px-6 dark:text-zinc-400">
          refoond · customer support refund system.
        </p>
      </footer>

    </div>
  );
}
